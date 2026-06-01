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

type SaveProfileResponse = {
  ok: boolean;
};

type LanguageResponse = {
  ok: boolean;
  language: string;
};

type SaveSettingsResponse = {
  ok: boolean;
  smartMatchAlertHour: number | null;
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

export async function updateUserLanguage(language: string): Promise<LanguageResponse> {
  return postToServerFunction<LanguageResponse>('user-profile', {
    action: 'set-language',
    language,
  });
}

export async function disableCurrentUserAccount(): Promise<SaveProfileResponse> {
  return postToServerFunction<SaveProfileResponse>('user-profile', {
    action: 'disable-account',
  });
}

export async function saveUserSettings(settings: {
  theme: string;
  unit: string;
  dateFormat: string;
  timeFormat: string;
  currency: string;
  newsletterEnabled: boolean;
  smartMatchAlertEnabled: boolean;
  smartMatchAlertHour: number | null;
  chatMailAlertEnabled: boolean;
  providerChatMailAlertOption: string;
  language: string;
}): Promise<SaveSettingsResponse> {
  return postToServerFunction<SaveSettingsResponse>('user-profile', {
    action: 'save-settings',
    ...settings,
  });
}

export async function saveSeekerProfile(profile: Record<string, unknown>, options: {
  language: string;
  theme: string;
  unit: string;
}): Promise<SaveProfileResponse> {
  return postToServerFunction<SaveProfileResponse>('profile-writes', {
    action: 'save-seeker-profile',
    profile,
    ...options,
  });
}

export async function saveProviderProfile(profile: Record<string, unknown>): Promise<SaveProfileResponse> {
  return postToServerFunction<SaveProfileResponse>('profile-writes', {
    action: 'save-provider-profile',
    profile,
  });
}
