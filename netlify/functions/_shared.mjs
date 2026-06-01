import { GoogleGenAI } from '@google/genai';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  REGION_RESTRICTION_STATUS,
  buildRegionalRestrictionBody,
  getBlockCategory,
  getClientIpFromHeaders,
  getCountryCodeFromHeaders,
  isBlockedCountryCode,
} from '../../shared/regionBlockConfig.mjs';

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

export function getAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function serverTimestamp() {
  return FieldValue.serverTimestamp();
}

export function arrayUnion(...values) {
  return FieldValue.arrayUnion(...values);
}

export function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

export function enforceRegionalAccess(event) {
  const countryCode = getCountryCodeFromHeaders(event.headers);
  if (!isBlockedCountryCode(countryCode)) {
    return null;
  }

  console.warn('[security][region-blocked]', JSON.stringify({
    countryCode,
    category: getBlockCategory(countryCode),
    ip: getClientIpFromHeaders(event.headers),
    path: event.path || 'unknown',
    method: event.httpMethod || 'unknown',
  }));

  return json(REGION_RESTRICTION_STATUS, buildRegionalRestrictionBody(), {
    'X-Robots-Tag': 'noindex, nofollow',
  });
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
  const auth = getAdminAuth();
  const token = getBearerToken(event);
  const decoded = await auth.verifyIdToken(token);
  const userSnap = await getDb().collection('users').doc(decoded.uid).get();

  if (userSnap.exists && userSnap.data()?.isSuspended === true) {
    throw new Error('Error: Account disabled.');
  }

  return decoded;
}

export function hasAdminClaim(decoded) {
  if (!decoded) {
    return false;
  }

  if (decoded.admin === true) {
    return true;
  }

  if (decoded.role === 'admin') {
    return true;
  }

  if (Array.isArray(decoded.roles) && decoded.roles.includes('admin')) {
    return true;
  }

  return false;
}

export function getEffectiveRole(decoded, fallbackRole) {
  if (hasAdminClaim(decoded)) {
    return 'admin';
  }

  return fallbackRole;
}

function limitString(value, maxLength = 200) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLength);
}

function getCleanPublicFirstName(...candidates) {
  for (const candidate of candidates) {
    const value = limitString(candidate, 200);
    if (!value) {
      continue;
    }

    const base = value.includes('@') ? value.split('@')[0] : value;
    const cleaned = base
      .replace(/[0-9]/g, ' ')
      .replace(/[._-]/g, ' ')
      .trim();
    const firstWord = cleaned.split(/\s+/)[0];

    if (!firstWord) {
      continue;
    }

    return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
  }

  return '';
}

function getPublicDisplayName({ providerData, seekerData, userData, existingData, fallbackFirstName }) {
  const providerName = [limitString(providerData?.firstName, 100), limitString(providerData?.lastName, 100)]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (providerName) {
    return providerName;
  }

  const seekerNickname = limitString(seekerData?.nickname, 100);
  if (seekerNickname) {
    return seekerNickname;
  }

  const userDisplayName = limitString(userData?.displayName, 200);
  if (userDisplayName) {
    return userDisplayName;
  }

  const existingDisplayName = limitString(existingData?.displayName, 200);
  if (existingDisplayName) {
    return existingDisplayName;
  }

  return fallbackFirstName || 'Co-Match Member';
}

function getVerificationLevel(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(5, Math.floor(parsed));
}

export async function syncPublicProfile(db, uid) {
  const safeUid = limitString(uid, 128);
  if (!safeUid) {
    throw new Error('Error: Missing user id for public profile sync.');
  }

  const publicProfileRef = db.collection('public_profiles').doc(safeUid);
  const [userSnap, providerSnap, seekerSnap, publicProfileSnap] = await Promise.all([
    db.collection('users').doc(safeUid).get(),
    db.collection('providers').doc(safeUid).get(),
    db.collection('seeker_profiles').doc(safeUid).get(),
    publicProfileRef.get(),
  ]);

  const userData = userSnap.exists ? userSnap.data() || {} : {};
  const providerData = providerSnap.exists ? providerSnap.data() || {} : {};
  const seekerData = seekerSnap.exists ? seekerSnap.data() || {} : {};
  const existingData = publicProfileSnap.exists ? publicProfileSnap.data() || {} : {};

  const fallbackFirstName = getCleanPublicFirstName(
    providerData.firstName,
    seekerData.firstName,
    userData.firstName,
    userData.displayName,
    userData.email,
    existingData.firstName
  );
  const displayName = getPublicDisplayName({
    providerData,
    seekerData,
    userData,
    existingData,
    fallbackFirstName,
  });
  const nickname = limitString(seekerData.nickname || existingData.nickname, 100);
  const photoUrl = limitString(
    providerData.photoUrl ||
      seekerData.photo_url ||
      seekerData.photoURL ||
      userData.photoURL ||
      existingData.photoUrl,
    2000
  );
  const role = limitString(userData.role || existingData.role || 'unassigned', 40) || 'unassigned';

  const resolvedFirstName =
    fallbackFirstName ||
    getCleanPublicFirstName(displayName) ||
    getCleanPublicFirstName(existingData.firstName);

  const nextPublicProfile = {
    uid: safeUid,
    role,
    displayName,
    photoUrl,
    verificationLevel: getVerificationLevel(userData.verificationLevel, getVerificationLevel(existingData.verificationLevel, 1)),
    updatedAt: serverTimestamp(),
    ...(resolvedFirstName ? { firstName: resolvedFirstName } : {}),
    ...(nickname ? { nickname } : {}),
  };

  await publicProfileRef.set(nextPublicProfile, { merge: true });
  return nextPublicProfile;
}

export async function requireAdmin(event) {
  const decoded = await requireUser(event);
  if (!hasAdminClaim(decoded)) {
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
  const blockedResponse = enforceRegionalAccess(event);
  if (blockedResponse) {
    return blockedResponse;
  }

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

function sanitizeRateLimitSegment(value) {
  return String(value || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 120);
}

export async function enforceRateLimit({
  scope,
  identifier,
  maxRequests,
  windowMs,
  errorMessage,
}) {
  if (!scope || !identifier) {
    throw new Error('Error: Invalid rate limit configuration.');
  }

  const db = getDb();
  const now = Date.now();
  const windowStartMs = Math.floor(now / windowMs) * windowMs;
  const docId = [
    sanitizeRateLimitSegment(scope),
    sanitizeRateLimitSegment(identifier),
    String(windowStartMs),
  ].join('__');
  const rateLimitRef = db.collection('rate_limits').doc(docId);

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(rateLimitRef);
    const currentCount = snapshot.exists ? Number(snapshot.data()?.count || 0) : 0;

    if (currentCount >= maxRequests) {
      throw new Error(errorMessage || 'Error: Rate limit exceeded.');
    }

    transaction.set(
      rateLimitRef,
      {
        scope,
        identifier: sanitizeRateLimitSegment(identifier),
        count: currentCount + 1,
        maxRequests,
        windowMs,
        windowStartMs,
        updatedAt: serverTimestamp(),
        expiresAtMs: windowStartMs + windowMs * 2,
      },
      { merge: true }
    );
  });
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
