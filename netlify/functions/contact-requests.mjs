import {
  enforceRateLimit,
  ensurePost,
  getDb,
  handleOptions,
  json,
  parseBody,
  requireUser,
  serverTimestamp,
  withErrorHandling,
} from './_shared.mjs';
import { getClientIpFromHeaders } from '../../shared/regionBlockConfig.mjs';

const ALLOWED_REQUEST_TYPES = new Set(['general', 'limit_upgrade']);

function normalizeText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function buildTitle(requestType, title) {
  if (requestType === 'limit_upgrade') {
    return 'Upgrade: Extra Properties Request';
  }

  return title;
}

export const handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  const postResponse = ensurePost(event);
  if (postResponse) return postResponse;

  return withErrorHandling(async () => {
    const user = await requireUser(event);
    const body = parseBody(event);
    const requestType = normalizeText(body.requestType || 'general');
    const title = normalizeText(body.title);
    const message = normalizeText(body.message);
    const clientIp = getClientIpFromHeaders(event.headers);

    if (!ALLOWED_REQUEST_TYPES.has(requestType)) {
      return json(400, { error: 'Error: Invalid contact request type.' });
    }

    if (requestType === 'general' && (title.length === 0 || title.length > 50)) {
      return json(400, { error: 'Error: Invalid contact request title.' });
    }

    if (message.length === 0 || message.length > 2000) {
      return json(400, { error: 'Error: Invalid contact request message.' });
    }

    await enforceRateLimit({
      scope: 'contact_request_ip',
      identifier: clientIp,
      maxRequests: 5,
      windowMs: 60 * 60 * 1000,
      errorMessage: 'Error: Too many contact requests from this network location.',
    });

    await enforceRateLimit({
      scope: 'contact_request_user',
      identifier: user.uid,
      maxRequests: 2,
      windowMs: 60 * 1000,
      errorMessage: 'Error: Too many contact requests. Please wait before trying again.',
    });

    const db = getDb();

    await db.collection('contact_requests').add({
      uid: user.uid,
      email: user.email || '',
      title: buildTitle(requestType, title),
      message,
      createdAt: serverTimestamp(),
      status: 'OPEN',
      type: requestType,
    });

    return json(200, { ok: true });
  });
};
