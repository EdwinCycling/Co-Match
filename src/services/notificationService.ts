import { postToServerFunction } from '../lib/serverApi';

type NotificationWriteResponse = {
  ok: boolean;
};

export type SmartMatchAlertHistoryPayload = {
  userId: string;
  subject: string;
  html: string;
  matchesCount: number;
  matches: Array<{
    propertyId: string;
    title: string;
    price: string;
    location: string;
    score: number;
  }>;
  currentHour: number;
};

export type ChatEmailNotificationResult = {
  status: string;
  reason?: string;
};

export async function sendChatEmailNotification(payload: {
  chatId: string;
  messageText: string;
  siteUrl?: string;
}) {
  return postToServerFunction<ChatEmailNotificationResult>('notification-writes', {
    action: 'send-chat-email-notification',
    ...payload,
  });
}

export async function recordChatAlertSideEffects(payload: {
  chatId: string;
  subject: string;
  html: string;
  chatText: string;
  recipientName: string;
  chatSenderName: string;
  isProviderAlert?: boolean;
}) {
  return postToServerFunction<NotificationWriteResponse>('notification-writes', {
    action: 'record-chat-alert-side-effects',
    ...payload,
  });
}

export async function recordSmartMatchAlertHistory(payload: SmartMatchAlertHistoryPayload) {
  return postToServerFunction<NotificationWriteResponse>('notification-writes', {
    action: 'record-smart-match-alert-history',
    ...payload,
  });
}
