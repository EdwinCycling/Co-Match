import { GoogleGenAI } from '@google/genai';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getPrivateKey() {
  const privateKey = getRequiredEnv('FIREBASE_ADMIN_PRIVATE_KEY');
  return privateKey.replace(/\\n/g, '\n');
}

function getFirebaseAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  return initializeApp({
    credential: cert({
      projectId: getRequiredEnv('FIREBASE_ADMIN_PROJECT_ID'),
      clientEmail: getRequiredEnv('FIREBASE_ADMIN_CLIENT_EMAIL'),
      privateKey: getPrivateKey(),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

export function getDb() {
  const databaseId = getRequiredEnv('FIREBASE_FIRESTORE_DATABASE_ID');
  return getFirestore(getFirebaseAdminApp(), databaseId);
}

export function serverTimestamp() {
  return FieldValue.serverTimestamp();
}

export function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

export function parseBody(event) {
  if (!event.body) {
    return {};
  }

  try {
    return JSON.parse(event.body);
  } catch {
    throw new Error('Invalid JSON body.');
  }
}

export function getBearerToken(event) {
  const header = event.headers?.authorization || event.headers?.Authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new Error('Error: Missing authentication token.');
  }

  return header.slice('Bearer '.length).trim();
}

export async function requireUser(event) {
  const auth = getAuth(getFirebaseAdminApp());
  const token = getBearerToken(event);
  return auth.verifyIdToken(token);
}

export async function requireAdmin(event) {
  const decoded = await requireUser(event);
  if (decoded.email !== 'edwin@editsolutions.nl') {
    throw new Error('Error: Admin access is required.');
  }

  return decoded;
}

export function createGeminiClient() {
  return new GoogleGenAI({
    apiKey: getRequiredEnv('GEMINI_API_KEY'),
  });
}

export function getGeoapifyApiKey() {
  return getRequiredEnv('GEOAPIFY_API_KEY');
}

export function handleOptions(event) {
  if (event.httpMethod === 'OPTIONS') {
    return json(200, { ok: true });
  }

  return null;
}

export function ensurePost(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Error: Method not allowed.' });
  }

  return null;
}

export async function withErrorHandling(fn) {
  try {
    return await fn();
  } catch (error) {
    console.error(error);
    return json(500, {
      error: error instanceof Error ? error.message : 'Error: Unknown server error.',
    });
  }
}
