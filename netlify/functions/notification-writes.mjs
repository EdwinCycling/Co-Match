import {
  arrayUnion,
  enforceRateLimit,
  ensurePost,
  getDb,
  hasAdminClaim,
  handleOptions,
  json,
  parseBody,
  requireUser,
  withErrorHandling,
} from './_shared.mjs';
import { getClientIpFromHeaders } from '../../shared/regionBlockConfig.mjs';
import { sendChatEmailNotification } from './chatEmailNotifications.mjs';

function normalizeString(value, maxLength = 1000) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLength);
}

function normalizeBoolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeNumber(value, fallback = 0, { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function normalizeMatchEntries(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, 10).map((entry) => ({
    propertyId: normalizeString(entry?.propertyId, 120),
    title: normalizeString(entry?.title, 200),
    price: normalizeString(entry?.price, 80),
    location: normalizeString(entry?.location, 200),
    score: normalizeNumber(entry?.score, 0, { min: 0, max: 100 }),
  }));
}

async function recordChatAlertSideEffects(db, userId, body) {
  const chatId = normalizeString(body.chatId, 120);
  const subject = normalizeString(body.subject, 300);
  const html = normalizeString(body.html, 200000);
  const chatText = normalizeString(body.chatText, 500);
  const recipientName = normalizeString(body.recipientName, 120);
  const chatSenderName = normalizeString(body.chatSenderName, 120);
  const isProviderAlert = normalizeBoolean(body.isProviderAlert, false);
  const cooldownField = isProviderAlert ? 'lastProviderChatMailSentAt' : 'lastChatMailSentAt';
  const chatRef = db.collection('chats').doc(chatId);
  const chatSnap = await chatRef.get();

  if (!chatSnap.exists) {
    throw new Error('Error: Chat not found.');
  }

  const chatData = chatSnap.data() || {};
  if (chatData.providerId !== userId && chatData.seekerId !== userId) {
    throw new Error('Error: Access denied.');
  }

  const recipientUserId = isProviderAlert ? chatData.providerId : chatData.seekerId;
  const recipientSnap = await db.collection('users').doc(recipientUserId).get();
  const recipientEmail = recipientSnap.exists
    ? normalizeString(recipientSnap.data()?.email, 254)
    : '';

  const nowIso = new Date().toISOString();
  const historyRef = db.collection('users').doc(userId).collection('settings').doc('alert_history');

  await historyRef.set({
    alerts: arrayUnion({
      subject,
      html,
      matchesCount: 1,
      createdAt: nowIso,
      isChatAlert: true,
      ...(isProviderAlert ? { isProviderAlert: true } : {}),
      chatSenderName,
      chatText,
      recipientName,
      recipientEmail,
    }),
  }, { merge: true });

  await chatRef.update({
    [cooldownField]: nowIso,
  });

  return json(200, { ok: true });
}

async function recordSmartMatchAlertHistory(db, body) {
  const targetUserId = normalizeString(body.userId, 120);
  const subject = normalizeString(body.subject, 300);
  const html = normalizeString(body.html, 200000);
  const matchesCount = normalizeNumber(body.matchesCount, 0, { min: 0, max: 10 });
  const currentHour = normalizeNumber(body.currentHour, -1, { min: -1, max: 23 });
  const matches = normalizeMatchEntries(body.matches);

  if (!targetUserId) {
    throw new Error('Error: Missing target user id.');
  }

  if (!subject || !html) {
    throw new Error('Error: Missing alert content.');
  }

  const userRef = db.collection('users').doc(targetUserId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new Error('Error: Target user not found.');
  }

  const nowIso = new Date().toISOString();
  const historyRef = userRef.collection('settings').doc('alert_history');

  await historyRef.set({
    alerts: arrayUnion({
      subject,
      html,
      matchesCount,
      matches,
      createdAt: nowIso,
      currentHour,
    }),
  }, { merge: true });

  return json(200, { ok: true });
}

export const handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  const postResponse = ensurePost(event);
  if (postResponse) return postResponse;

  return withErrorHandling(async () => {
    const user = await requireUser(event);
    const body = parseBody(event);
    const action = normalizeString(body.action, 60);
    const clientIp = getClientIpFromHeaders(event.headers);
    const db = getDb();

    await enforceRateLimit({
      scope: 'notification_writes_ip',
      identifier: clientIp,
      maxRequests: 120,
      windowMs: 60 * 60 * 1000,
      errorMessage: 'Error: Too many notification write attempts from this network location.',
    });

    await enforceRateLimit({
      scope: 'notification_writes_user',
      identifier: `${user.uid}:${action}`,
      maxRequests: 120,
      windowMs: 10 * 60 * 1000,
      errorMessage: 'Error: Too many notification write attempts. Please wait before trying again.',
    });

    if (action === 'record-chat-alert-side-effects') {
      return recordChatAlertSideEffects(db, user.uid, body);
    }

    if (action === 'send-chat-email-notification') {
      const result = await sendChatEmailNotification(db, user.uid, body);
      return json(200, result);
    }

    if (action === 'record-smart-match-alert-history') {
      if (!hasAdminClaim(user)) {
        throw new Error('Error: Admin access is required.');
      }

      return recordSmartMatchAlertHistory(db, body);
    }

    return json(400, { error: 'Error: Invalid notification write action.' });
  });
};
