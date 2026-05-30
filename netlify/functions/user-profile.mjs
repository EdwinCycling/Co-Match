import { ensurePost, getDb, handleOptions, json, parseBody, requireUser, serverTimestamp, withErrorHandling } from './_shared.mjs';

const ALLOWED_SELF_ROLES = new Set(['huis_zoeker', 'huis_aanbieder']);

function getSafeRole(currentRole, email) {
  if (email === 'edwin@editsolutions.nl') {
    return 'admin';
  }

  if (ALLOWED_SELF_ROLES.has(currentRole)) {
    return currentRole;
  }

  return 'unassigned';
}

export const handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  const postResponse = ensurePost(event);
  if (postResponse) return postResponse;

  return withErrorHandling(async () => {
    const user = await requireUser(event);
    const { action, role } = parseBody(event);
    const db = getDb();
    const userRef = db.collection('users').doc(user.uid);
    const userSnap = await userRef.get();

    if (action === 'assign-alert-hour') {
      const usersSnap = await db.collection('users').where('smartMatchAlertEnabled', '==', true).get();
      const hourCounts = Array.from({ length: 24 }, () => 0);

      usersSnap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const hour = Number(data.smartMatchAlertHour);
        if (!Number.isNaN(hour) && hour >= 0 && hour < 24) {
          hourCounts[hour] += 1;
        }
      });

      const minCount = Math.min(...hourCounts);
      const bestHours = hourCounts
        .map((count, index) => ({ count, index }))
        .filter((entry) => entry.count === minCount)
        .map((entry) => entry.index);
      const hour = bestHours[Math.floor(Math.random() * bestHours.length)];

      return json(200, { hour });
    }

    if (action === 'set-role') {
      if (!ALLOWED_SELF_ROLES.has(role)) {
        return json(400, { error: 'Error: Invalid role selection.' });
      }

      const nextRole = getSafeRole(role, user.email || '');
      await userRef.set({
        uid: user.uid,
        email: user.email || '',
        displayName: user.name || user.email || 'Gebruiker',
        photoURL: user.picture || '',
        hasProfile: true,
        role: nextRole,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      return json(200, { role: nextRole });
    }

    const existing = userSnap.exists ? userSnap.data() || {} : {};
    const safeRole = getSafeRole(existing.role, user.email || '');
    const nextData = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.name || user.email || 'Nieuwe Gebruiker',
      photoURL: user.picture || '',
      hasProfile: existing.hasProfile === true,
      role: safeRole,
      updatedAt: serverTimestamp(),
    };

    if (!userSnap.exists) {
      await userRef.set({
        ...nextData,
        createdAt: serverTimestamp(),
        credits: 100,
        max_properties: 3,
      }, { merge: true });

      return json(200, {
        role: safeRole,
        credits: 100,
        hasProfile: false,
      });
    }

    await userRef.set(nextData, { merge: true });

    return json(200, {
      role: safeRole,
      credits: Number(existing.credits || 0),
      hasProfile: existing.hasProfile === true,
    });
  });
};
