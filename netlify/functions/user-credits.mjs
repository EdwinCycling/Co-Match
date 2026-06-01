import { enforceRateLimit, ensurePost, getDb, handleOptions, json, parseBody, requireUser, serverTimestamp, withErrorHandling } from './_shared.mjs';

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function getProfileRef(db, uid, profileType) {
  if (profileType === 'seeker') {
    return db.collection('seeker_profiles').doc(uid);
  }

  if (profileType === 'provider') {
    return db.collection('providers').doc(uid);
  }

  return null;
}

export const handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  const postResponse = ensurePost(event);
  if (postResponse) return postResponse;

  return withErrorHandling(async () => {
    const user = await requireUser(event);
    const { action, amount, reason, profileType } = parseBody(event);
    const db = getDb();
    const userRef = db.collection('users').doc(user.uid);

    if (action === 'grant-completion-bonus') {
      const profileRef = getProfileRef(db, user.uid, profileType);
      if (!profileRef) {
        return json(400, { error: 'Error: Invalid completion bonus profile type.' });
      }

      const outcome = await db.runTransaction(async (transaction) => {
        const [userSnap, profileSnap] = await Promise.all([
          transaction.get(userRef),
          transaction.get(profileRef),
        ]);

        if (!userSnap.exists) {
          throw new Error('Error: User profile does not exist.');
        }

        if (!profileSnap.exists) {
          throw new Error('Error: Completion profile does not exist.');
        }

        const userData = userSnap.data() || {};
        const profileData = profileSnap.data() || {};
        const alreadyRewarded = userData.hasReceivedCompletionCredits === true;
        const isEligible = profileType === 'seeker'
          ? profileData.has_completed_minimal === true
          : typeof profileData.firstName === 'string' && profileData.firstName.trim().length > 0;

        if (!isEligible || alreadyRewarded) {
          return {
            rewarded: false,
            credits: Number(userData.credits || 0),
          };
        }

        const nextCredits = Number(userData.credits || 0) + 5;
        transaction.update(userRef, {
          credits: nextCredits,
          hasReceivedCompletionCredits: true,
          lastAdditionReason: `Profile completion bonus (${profileType})`,
          lastAdditionAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        return {
          rewarded: true,
          credits: nextCredits,
        };
      });

      return json(200, outcome);
    }

    if (action === 'buy-property-bundle') {
      const outcome = await db.runTransaction(async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) {
          throw new Error('Error: User profile does not exist.');
        }

        const userData = userSnap.data() || {};
        const currentCredits = Number(userData.credits || 0);
        const bundleCost = 25;
        if (currentCredits < bundleCost) {
          throw new Error('Error: Insufficient credits for property bundle.');
        }

        const nextCredits = currentCredits - bundleCost;
        const nextLimit = Number(userData.max_properties || 3) + 3;

        transaction.update(userRef, {
          credits: nextCredits,
          max_properties: nextLimit,
          lastDeductionReason: 'Purchased 3 extra properties bundle',
          lastDeductionAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        return {
          credits: nextCredits,
          maxProperties: nextLimit,
        };
      });

      return json(200, outcome);
    }

    if (action === 'deduct') {
      await enforceRateLimit({
        scope: 'user-credits-deduct',
        identifier: user.uid,
        maxRequests: 20,
        windowMs: 60 * 1000,
        errorMessage: 'Error: Too many credit deduction requests. Please try again in a minute.',
      });
      
      if (!isPositiveInteger(amount) || amount > 1000) {
        return json(400, { error: 'Error: Invalid credit amount.' });
      }

      if (typeof reason !== 'string' || reason.trim().length === 0 || reason.length > 300) {
        return json(400, { error: 'Error: Invalid credit reason.' });
      }

      const outcome = await db.runTransaction(async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) {
          throw new Error('Error: User profile does not exist.');
        }

        const userData = userSnap.data() || {};
        const currentCredits = Number(userData.credits || 0);
        if (currentCredits < amount) {
          throw new Error('Error: Insufficient credits for this action.');
        }

        const nextCredits = currentCredits - amount;
        transaction.update(userRef, {
          credits: nextCredits,
          lastDeductionReason: reason.trim(),
          lastDeductionAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        return {
          credits: nextCredits,
        };
      });

      return json(200, outcome);
    }

    return json(400, { error: 'Error: Invalid credit action.' });
  });
};
