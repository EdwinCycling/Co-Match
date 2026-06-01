import { postToServerFunction } from '../lib/serverApi';

type AdminWriteResponse = {
  ok: boolean;
  id?: string;
  status?: 'OPEN' | 'REPLIED';
  deleted?: boolean;
  isActive?: boolean;
  isSuspended?: boolean;
  credits?: number;
};

export type GiftWritePayload = {
  giftId?: string;
  title: string;
  message: string;
  type: 'new' | 'improvement';
  targetAudience: 'all' | 'huis_zoeker' | 'huis_aanbieder';
  startDate: string;
  isHighPriority: boolean;
  imageUrl: string;
};

export type ExpertLinkWritePayload = {
  linkId?: string;
  title: string;
  url: string;
  country: string;
  category: string;
  order_index: number;
  description: string;
  linkType: 'lead' | 'info';
  isActive: boolean;
};

type AdminMessageWritePayload = {
  messageId?: string;
  text: string;
  targetAudience: string;
  type: string;
  startDate: string;
  endDate: string | null;
  isDisabled: boolean;
};

function postAdminWrite<TResponse = AdminWriteResponse>(action: string, payload: Record<string, unknown> = {}) {
  return postToServerFunction<TResponse>('admin-writes', {
    action,
    ...payload,
  }, {
    forceRefreshToken: true,
  });
}

export async function updateContactRequestStatus(requestId: string, status: 'OPEN' | 'REPLIED') {
  return postAdminWrite('update-contact-request-status', {
    requestId,
    status,
  });
}

export async function saveGift(payload: GiftWritePayload) {
  return postAdminWrite('save-gift', payload);
}

export async function deleteGift(giftId: string) {
  return postAdminWrite('delete-gift', {
    giftId,
  });
}

export async function saveExpertLink(payload: ExpertLinkWritePayload) {
  return postAdminWrite('save-expert-link', payload);
}

export async function deleteExpertLink(linkId: string) {
  return postAdminWrite('delete-expert-link', {
    linkId,
  });
}

export async function reorderExpertLinks(currentId: string, currentOrder: number, targetId: string, targetOrder: number) {
  return postAdminWrite('reorder-expert-links', {
    currentId,
    currentOrder,
    targetId,
    targetOrder,
  });
}

export async function toggleAdminUserStatus(userId: string, isSuspended: boolean) {
  return postAdminWrite('toggle-admin-user-status', {
    userId,
    isSuspended,
  });
}

export async function addAdminUserCredits(userId: string, amount: number) {
  return postAdminWrite<AdminWriteResponse>('add-admin-user-credits', {
    userId,
    amount,
  });
}

export async function bulkAddAdminUserCredits(userIds: string[], amount: number) {
  return postAdminWrite('bulk-add-admin-user-credits', {
    userIds,
    amount,
  });
}

export async function saveAdminMessage(payload: AdminMessageWritePayload) {
  return postAdminWrite('save-admin-message', payload);
}

export async function deleteAdminMessage(messageId: string) {
  return postAdminWrite('delete-admin-message', {
    messageId,
  });
}

export async function saveAdminStopConfig(config: Record<string, unknown>) {
  return postAdminWrite('save-admin-stop-config', {
    config,
  });
}

export async function saveAdminAiSettings(settings: Record<string, unknown>) {
  return postAdminWrite('save-admin-ai-settings', {
    settings,
  });
}

export async function saveAdminExchangeRates(rates: Record<string, number>) {
  return postAdminWrite('save-admin-exchange-rates', {
    rates,
  });
}

export async function removeAdminPropertyPhoto(propertyId: string, photoId: string) {
  return postAdminWrite('remove-admin-property-photo', {
    propertyId,
    photoId,
  });
}

export async function saveAdminPropertyImages(propertyId: string, images: Array<Record<string, unknown>>, teaserImageId: string) {
  return postAdminWrite('save-admin-property-images', {
    propertyId,
    images,
    teaserImageId,
  });
}

export async function setAdminUserSuspension(userId: string, isSuspended: boolean) {
  return postAdminWrite('set-admin-user-suspension', {
    userId,
    isSuspended,
  });
}

export async function updateAdminProperty(propertyId: string, property: Record<string, unknown>) {
  return postAdminWrite('update-admin-property', {
    propertyId,
    property,
  });
}

export async function toggleAdminPropertyStatus(propertyId: string, isActive: boolean) {
  return postAdminWrite<AdminWriteResponse>('toggle-admin-property-status', {
    propertyId,
    isActive,
  });
}

export async function deleteAdminProperty(propertyId: string) {
  return postAdminWrite<AdminWriteResponse>('delete-admin-property', {
    propertyId,
  });
}

export async function setAdminVerificationDecision(userId: string, decision: 'APPROVED' | 'REJECTED') {
  return postAdminWrite('set-admin-verification-decision', {
    userId,
    decision,
  });
}

export async function createAdminMockProperties() {
  return postAdminWrite('create-admin-mock-properties');
}

export async function clearAdminProperties() {
  return postAdminWrite('clear-admin-properties');
}
