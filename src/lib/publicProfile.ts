import { doc, getDoc, type Firestore } from 'firebase/firestore';

export type PublicProfileCard = {
  id: string;
  displayName: string;
  firstName: string;
  photoUrl: string;
  verificationLevel: number;
  preferredLanguage?: string;
};

export function resolveProfileFirstName(
  data: { firstName?: string; nickname?: string; displayName?: string } | null | undefined,
  fallback: string
): string {
  if (data?.firstName?.trim()) {
    return data.firstName.trim();
  }

  if (data?.nickname?.trim()) {
    return data.nickname.trim().split(/\s+/)[0];
  }

  if (data?.displayName?.trim()) {
    return data.displayName.trim().split(/\s+/)[0];
  }

  return fallback;
}

export async function fetchPublicProfileCard(
  db: Firestore,
  userId: string,
  options: { fallbackRole?: 'provider' | 'seeker'; providerFallback?: string; seekerFallback?: string } = {}
): Promise<PublicProfileCard | null> {
  if (!userId) {
    return null;
  }

  const providerFallback = options.providerFallback || 'Aanbieder';
  const seekerFallback = options.seekerFallback || 'Woningzoeker';

  try {
    const publicSnap = await getDoc(doc(db, 'public_profiles', userId));
    if (publicSnap.exists()) {
      const data = publicSnap.data();
      const displayName = typeof data.displayName === 'string' ? data.displayName.trim() : '';

      return {
        id: userId,
        displayName: displayName || (options.fallbackRole === 'provider' ? providerFallback : seekerFallback),
        firstName: resolveProfileFirstName(data, options.fallbackRole === 'provider' ? providerFallback : seekerFallback),
        photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : '',
        verificationLevel: Number(data.verificationLevel) || 1,
        preferredLanguage: typeof data.preferredLanguage === 'string' ? data.preferredLanguage : undefined,
      };
    }
  } catch (error) {
    console.warn(`Could not load public profile for ${userId}`, error);
  }

  if (options.fallbackRole === 'provider') {
    try {
      const providerSnap = await getDoc(doc(db, 'providers', userId));
      if (providerSnap.exists()) {
        const data = providerSnap.data();
        const displayName =
          [data.firstName, data.lastName].filter(Boolean).join(' ').trim() ||
          (typeof data.companyName === 'string' ? data.companyName.trim() : '') ||
          providerFallback;

        return {
          id: userId,
          displayName,
          firstName: resolveProfileFirstName(
            {
              firstName: data.firstName,
              displayName,
            },
            providerFallback
          ),
          photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : '',
          verificationLevel: Number(data.verificationLevel) || 1,
          preferredLanguage: typeof data.preferredLanguage === 'string' ? data.preferredLanguage : undefined,
        };
      }
    } catch (error) {
      console.warn(`Could not load provider fallback profile for ${userId}`, error);
    }
  }

  if (options.fallbackRole === 'seeker') {
    try {
      const seekerSnap = await getDoc(doc(db, 'seeker_profiles', userId));
      if (seekerSnap.exists()) {
        const data = seekerSnap.data();
        const displayName = typeof data.nickname === 'string' ? data.nickname.trim() : seekerFallback;

        return {
          id: userId,
          displayName,
          firstName: resolveProfileFirstName(
            {
              firstName: data.firstName,
              nickname: data.nickname,
            },
            seekerFallback
          ),
          photoUrl:
            (typeof data.photo_url === 'string' && data.photo_url) ||
            (typeof data.photoURL === 'string' && data.photoURL) ||
            '',
          verificationLevel: Number(data.verificationLevel) || 1,
        };
      }
    } catch (error) {
      console.warn(`Could not load seeker fallback profile for ${userId}`, error);
    }
  }

  return null;
}
