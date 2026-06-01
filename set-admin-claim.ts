import 'dotenv/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getPrivateKey(): string {
  return getRequiredEnv('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n');
}

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  return initializeApp({
    credential: cert({
      projectId: getRequiredEnv('FIREBASE_ADMIN_PROJECT_ID'),
      clientEmail: getRequiredEnv('FIREBASE_ADMIN_CLIENT_EMAIL'),
      privateKey: getPrivateKey(),
    }),
  });
}

async function main() {
  const target = process.argv[2];

  if (!target) {
    throw new Error('Usage: npm run admin:claim -- <email-or-uid>');
  }

  const app = getAdminApp();
  const auth = getAuth(app);
  const db = getFirestore(app, getRequiredEnv('FIREBASE_FIRESTORE_DATABASE_ID'));
  const userRecord = target.includes('@')
    ? await auth.getUserByEmail(target)
    : await auth.getUser(target);

  const existingClaims = userRecord.customClaims || {};
  const existingRoles = Array.isArray(existingClaims.roles) ? existingClaims.roles : [];
  const nextClaims = {
    ...existingClaims,
    admin: true,
    role: 'admin',
    roles: Array.from(new Set([...existingRoles, 'admin'])),
  };

  await auth.setCustomUserClaims(userRecord.uid, nextClaims);
  await db.collection('users').doc(userRecord.uid).set(
    {
      uid: userRecord.uid,
      email: userRecord.email || '',
      role: 'admin',
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`Admin claims updated for ${userRecord.email || userRecord.uid}`);
  console.log('The user should sign out and sign in again to refresh the token.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
