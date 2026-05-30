import { postToServerFunction } from '../lib/serverApi';

type UserProfileSyncResponse = {
  role: string;
  credits: number;
  hasProfile: boolean;
};

type UserRoleResponse = {
  role: string;
};

type CompletionBonusResponse = {
  rewarded: boolean;
  credits: number;
};

type AlertHourResponse = {
  hour: number;
};

export async function syncUserProfile(): Promise<UserProfileSyncResponse> {
  return postToServerFunction<UserProfileSyncResponse>('user-profile', {
    action: 'sync',
  });
}

export async function updateUserRole(role: 'huis_zoeker' | 'huis_aanbieder'): Promise<UserRoleResponse> {
  return postToServerFunction<UserRoleResponse>('user-profile', {
    action: 'set-role',
    role,
  });
}

export async function grantCompletionBonus(profileType: 'seeker' | 'provider'): Promise<CompletionBonusResponse> {
  return postToServerFunction<CompletionBonusResponse>('user-credits', {
    action: 'grant-completion-bonus',
    profileType,
  });
}

export async function assignDistributedAlertHour(): Promise<number> {
  const response = await postToServerFunction<AlertHourResponse>('user-profile', {
    action: 'assign-alert-hour',
  });

  return response.hour;
}
