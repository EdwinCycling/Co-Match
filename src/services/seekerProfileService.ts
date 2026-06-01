import { postToServerFunction } from '../lib/serverApi';

type SeekerProfileActionResponse = {
  ok: boolean;
  favorites?: string[];
  unlocked_chats?: string[];
  unlocked_details?: string[];
  unlocked_matches?: string[];
  unlocked_all_options?: string[];
  city?: string;
  country?: string;
  harmony_index?: number;
  has_completed_cha?: boolean;
};

export async function toggleSeekerFavorite(propertyId: string, shouldFavorite: boolean) {
  return postToServerFunction<SeekerProfileActionResponse>('profile-writes', {
    action: 'toggle-seeker-favorite',
    propertyId,
    shouldFavorite,
  });
}

export async function grantSeekerAccess(propertyId: string, options: {
  favorite?: boolean;
  unlockChat?: boolean;
  unlockDetails?: boolean;
  unlockMatch?: boolean;
  unlockAllOptions?: boolean;
}) {
  return postToServerFunction<SeekerProfileActionResponse>('profile-writes', {
    action: 'grant-seeker-access',
    propertyId,
    ...options,
  });
}

export async function updateSeekerLocation(city: string, country: string) {
  return postToServerFunction<SeekerProfileActionResponse>('profile-writes', {
    action: 'update-seeker-location',
    city,
    country,
  });
}

export async function saveSeekerCha(harmonyIndex: number, harmonyAnswers: Record<string, unknown>) {
  return postToServerFunction<SeekerProfileActionResponse>('profile-writes', {
    action: 'save-seeker-cha',
    harmonyIndex,
    harmonyAnswers,
  });
}
