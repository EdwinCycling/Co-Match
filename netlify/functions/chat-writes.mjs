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

function normalizeString(value, maxLength = 1000) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLength);
}

function normalizeBoolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeNumber(value, fallback = 0, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numeric));
}

async function getChat(db, chatId) {
  const chatRef = db.collection('chats').doc(chatId);
  const chatSnap = await chatRef.get();

  if (!chatSnap.exists) {
    throw new Error('Error: Chat not found.');
  }

  return {
    chatRef,
    chatData: chatSnap.data() || {},
  };
}

function isParticipant(chatData, userId) {
  return chatData.providerId === userId || chatData.seekerId === userId;
}

function isProvider(chatData, userId) {
  return chatData.providerId === userId;
}

function isSeeker(chatData, userId) {
  return chatData.seekerId === userId;
}

function buildMessage(senderId, text, extra = {}) {
  return {
    senderId,
    text,
    createdAt: new Date(),
    ...extra,
  };
}

async function toggleFavorite(db, userId, body) {
  const propertyId = normalizeString(body.propertyId, 120);
  const shouldFavorite = normalizeBoolean(body.shouldFavorite, true);
  const seekerProfileRef = db.collection('seeker_profiles').doc(userId);
  const seekerProfileSnap = await seekerProfileRef.get();
  const seekerProfileData = seekerProfileSnap.exists ? seekerProfileSnap.data() || {} : {};
  const currentFavorites = Array.isArray(seekerProfileData.favorites) ? seekerProfileData.favorites : [];
  const nextFavorites = shouldFavorite
    ? [...new Set([...currentFavorites, propertyId])]
    : currentFavorites.filter((favoriteId) => favoriteId !== propertyId);

  await seekerProfileRef.set({
    favorites: nextFavorites,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return json(200, { ok: true, favorites: nextFavorites });
}

async function sendSeekerChatMessage(db, userId, body, options = {}) {
  const propertyId = normalizeString(body.propertyId, 120);
  const text = normalizeString(body.text, 500);
  const audioUrl = normalizeString(body.audioUrl, 2000000);
  const autoFavorite = normalizeBoolean(body.autoFavorite, true);
  const isAudio = normalizeBoolean(options.isAudio, false);
  const propertyRef = db.collection('properties').doc(propertyId);
  const chatId = `${userId}_${propertyId}`;
  const chatRef = db.collection('chats').doc(chatId);

  if (!propertyId) {
    return json(400, { error: 'Error: Invalid property.' });
  }

  if (!text) {
    return json(400, { error: 'Error: Message is empty.' });
  }

  if (isAudio && !audioUrl) {
    return json(400, { error: 'Error: Missing audio payload.' });
  }

  const result = await db.runTransaction(async (transaction) => {
    const [propertySnap, chatSnap, seekerProfileSnap] = await Promise.all([
      transaction.get(propertyRef),
      transaction.get(chatRef),
      transaction.get(db.collection('seeker_profiles').doc(userId)),
    ]);

    if (!propertySnap.exists) {
      throw new Error('Error: Property not found.');
    }

    const propertyData = propertySnap.data() || {};
    const maxInquiries = normalizeNumber(propertyData.maxInquiries, 10, 1, 50);
    const currentInquiries = normalizeNumber(propertyData.currentInquiries, 0, 0, 9999);
    const seekerProfileData = seekerProfileSnap.exists ? seekerProfileSnap.data() || {} : {};
    const currentFavorites = Array.isArray(seekerProfileData.favorites) ? seekerProfileData.favorites : [];

    const newMessage = buildMessage(userId, text, {
      read: false,
      ...(isAudio ? { audioUrl, hasAudio: true } : {}),
    });

    if (!chatSnap.exists) {
      if (currentInquiries >= maxInquiries) {
        return { error: 'Error: This property has reached the maximum number of inquiries.' };
      }

      transaction.set(chatRef, {
        seekerId: userId,
        propertyId,
        providerId: normalizeString(propertyData.ownerId, 120),
        lastSenderId: userId,
        status: 'active',
        messages: [newMessage],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const nextInquiryCount = currentInquiries + 1;
      transaction.update(propertyRef, {
        currentInquiries: nextInquiryCount,
        status: nextInquiryCount >= maxInquiries ? 'paused' : normalizeString(propertyData.status, 40) || 'available',
        updatedAt: serverTimestamp(),
      });

      if (autoFavorite && !currentFavorites.includes(propertyId)) {
        transaction.set(db.collection('seeker_profiles').doc(userId), {
          favorites: [...new Set([...currentFavorites, propertyId])],
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      return { created: true };
    }

    const chatData = chatSnap.data() || {};
    if (!isSeeker(chatData, userId)) {
      throw new Error('Error: Access denied.');
    }

    const messages = Array.isArray(chatData.messages) ? chatData.messages : [];
    if (messages.length >= 50) {
      return { error: 'Error: Maximum number of messages reached for this chat.' };
    }

    let consecutiveSeekerMessages = 0;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.senderId === userId) {
        consecutiveSeekerMessages += 1;
        continue;
      }

      break;
    }

    if (consecutiveSeekerMessages >= 3) {
      return { error: 'Error: Message limit reached until the provider replies.' };
    }

    transaction.update(chatRef, {
      lastSenderId: userId,
      messages: [...messages, newMessage],
      updatedAt: serverTimestamp(),
    });

    if (autoFavorite && !currentFavorites.includes(propertyId)) {
      transaction.set(db.collection('seeker_profiles').doc(userId), {
        favorites: [...new Set([...currentFavorites, propertyId])],
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    return { created: false };
  });

  if (result?.error) {
    return json(400, { error: result.error });
  }

  return json(200, { ok: true, chatId, created: result?.created || false });
}

async function markChatRead(db, userId, body) {
  const chatId = normalizeString(body.chatId, 120);
  const { chatRef, chatData } = await getChat(db, chatId);

  if (!isParticipant(chatData, userId)) {
    throw new Error('Error: Access denied.');
  }

  const messages = Array.isArray(chatData.messages) ? chatData.messages : [];
  let changed = false;
  const nextMessages = messages.map((message) => {
    if (message?.senderId !== userId && !message?.read) {
      changed = true;
      return { ...message, read: true };
    }

    return message;
  });

  if (changed) {
    await chatRef.update({
      messages: nextMessages,
      updatedAt: serverTimestamp(),
    });
  }

  return json(200, { ok: true });
}

async function sendProviderMessage(db, userId, body) {
  const chatId = normalizeString(body.chatId, 120);
  const text = normalizeString(body.text, 500);
  const { chatRef, chatData } = await getChat(db, chatId);

  if (!isProvider(chatData, userId)) {
    throw new Error('Error: Access denied.');
  }

  const messages = Array.isArray(chatData.messages) ? chatData.messages : [];
  if (!text) {
    return json(400, { error: 'Error: Message is empty.' });
  }

  if (messages.length >= 50) {
    return json(400, { error: 'Error: Maximum number of messages reached for this chat.' });
  }

  const nextMessages = [...messages, buildMessage(userId, text, { read: false })];

  await chatRef.update({
    lastSenderId: userId,
    messages: nextMessages,
    updatedAt: serverTimestamp(),
  });

  return json(200, { ok: true });
}

async function blockChat(db, userId, body) {
  const chatId = normalizeString(body.chatId, 120);
  const { chatRef, chatData } = await getChat(db, chatId);

  if (!isProvider(chatData, userId)) {
    throw new Error('Error: Access denied.');
  }

  await chatRef.update({
    status: 'blocked',
    updatedAt: serverTimestamp(),
  });

  return json(200, { ok: true });
}

async function toggleLinkedInShare(db, userId, body) {
  const chatId = normalizeString(body.chatId, 120);
  const shouldShare = normalizeBoolean(body.shouldShare, false);
  const linkedInUrl = normalizeString(body.linkedInUrl, 1000);
  const { chatRef, chatData } = await getChat(db, chatId);

  if (!isProvider(chatData, userId)) {
    throw new Error('Error: Access denied.');
  }

  const messages = Array.isArray(chatData.messages) ? chatData.messages : [];
  const update = {
    meta: {
      ...(typeof chatData.meta === 'object' && chatData.meta !== null ? chatData.meta : {}),
      isLinkedInShared: shouldShare,
      linkedInUrl: shouldShare ? linkedInUrl : null,
      sharedAt: shouldShare ? new Date() : null,
    },
    updatedAt: serverTimestamp(),
  };

  if (shouldShare) {
    update.messages = [
      ...messages,
      buildMessage('system', 'De aanbieder heeft zijn/haar LinkedIn profiel gedeeld.', { isSystem: true }),
    ];
  }

  await chatRef.update(update);
  return json(200, { ok: true });
}

async function terminateChat(db, userId, body) {
  const chatId = normalizeString(body.chatId, 120);
  const terminationText = normalizeString(body.terminationText, 300);
  const { chatRef, chatData } = await getChat(db, chatId);

  if (!isProvider(chatData, userId)) {
    throw new Error('Error: Access denied.');
  }

  const propertyId = normalizeString(chatData.propertyId, 120);
  const propertyRef = db.collection('properties').doc(propertyId);
  const propertySnap = await propertyRef.get();
  const propertyData = propertySnap.exists ? propertySnap.data() || {} : {};
  const messages = Array.isArray(chatData.messages) ? chatData.messages : [];

  await chatRef.update({
    status: 'terminated',
    updatedAt: serverTimestamp(),
    messages: [
      ...messages,
      buildMessage('system', terminationText, { isSystem: true }),
    ],
  });

  if (propertySnap.exists && propertyData.ownerId === userId) {
    await propertyRef.update({
      currentInquiries: Math.max(0, Number(propertyData.currentInquiries || 0) - 1),
      updatedAt: serverTimestamp(),
    });
  }

  return json(200, { ok: true });
}

async function terminateSeekerChat(db, userId, body) {
  const chatId = normalizeString(body.chatId, 120);
  const { chatRef, chatData } = await getChat(db, chatId);

  if (!isSeeker(chatData, userId)) {
    throw new Error('Error: Access denied.');
  }

  const propertyId = normalizeString(chatData.propertyId, 120);
  const propertyRef = db.collection('properties').doc(propertyId);
  const propertySnap = await propertyRef.get();
  const propertyData = propertySnap.exists ? propertySnap.data() || {} : {};

  await chatRef.update({
    status: 'terminated',
    updatedAt: serverTimestamp(),
  });

  if (propertySnap.exists) {
    await propertyRef.update({
      currentInquiries: Math.max(0, normalizeNumber(propertyData.currentInquiries, 0, 0, 9999) - 1),
      updatedAt: serverTimestamp(),
    });
  }

  return json(200, { ok: true });
}

async function proposeMeeting(db, userId, body) {
  const chatId = normalizeString(body.chatId, 120);
  const scheduledAtRaw = normalizeString(body.scheduledAt, 100);
  const systemText = normalizeString(body.systemText, 300);
  const { chatRef, chatData } = await getChat(db, chatId);

  if (!isProvider(chatData, userId)) {
    throw new Error('Error: Access denied.');
  }

  const scheduledAt = new Date(scheduledAtRaw);
  if (Number.isNaN(scheduledAt.getTime())) {
    return json(400, { error: 'Error: Invalid meeting date.' });
  }

  const messages = Array.isArray(chatData.messages) ? chatData.messages : [];

  await chatRef.update({
    meta: {
      ...(typeof chatData.meta === 'object' && chatData.meta !== null ? chatData.meta : {}),
      meeting: {
        status: 'proposed',
        scheduledAt,
        proposerId: userId,
        round: 1,
      },
    },
    messages: [
      ...messages,
      buildMessage('system', systemText, { isSystem: true }),
    ],
    updatedAt: serverTimestamp(),
  });

  return json(200, { ok: true });
}

async function respondToMeeting(db, userId, body) {
  const chatId = normalizeString(body.chatId, 120);
  const meetingAction = normalizeString(body.meetingAction, 30);
  const scheduledAtRaw = normalizeString(body.scheduledAt, 100);
  const systemText = normalizeString(body.systemText, 300);
  const { chatRef, chatData } = await getChat(db, chatId);

  if (!isParticipant(chatData, userId)) {
    throw new Error('Error: Access denied.');
  }

  const meta = typeof chatData.meta === 'object' && chatData.meta !== null ? chatData.meta : {};
  const currentMeeting = typeof meta.meeting === 'object' && meta.meeting !== null ? meta.meeting : {};
  const messages = Array.isArray(chatData.messages) ? chatData.messages : [];
  const nextMeta = { ...meta };

  if (meetingAction === 'accept') {
    nextMeta.meeting = {
      ...currentMeeting,
      status: 'accepted',
    };
  } else if (meetingAction === 'decline') {
    nextMeta.meeting = null;
  } else if (meetingAction === 'repropose') {
    const scheduledAt = new Date(scheduledAtRaw);
    if (Number.isNaN(scheduledAt.getTime())) {
      return json(400, { error: 'Error: Invalid meeting date.' });
    }

    const round = Math.min(3, Number(currentMeeting.round || 1) + 1);
    nextMeta.meeting = {
      ...currentMeeting,
      status: 'proposed',
      scheduledAt,
      proposerId: userId,
      round,
    };
  } else {
    return json(400, { error: 'Error: Invalid meeting action.' });
  }

  await chatRef.update({
    meta: nextMeta,
    messages: [
      ...messages,
      buildMessage('system', systemText, { isSystem: true }),
    ],
    updatedAt: serverTimestamp(),
  });

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
      scope: 'chat_writes_ip',
      identifier: clientIp,
      maxRequests: 120,
      windowMs: 60 * 60 * 1000,
      errorMessage: 'Error: Too many chat write attempts from this network location.',
    });

    await enforceRateLimit({
      scope: 'chat_writes_user',
      identifier: `${user.uid}:${action}`,
      maxRequests: 80,
      windowMs: 10 * 60 * 1000,
      errorMessage: 'Error: Too many chat write attempts. Please wait before trying again.',
    });

    if (action === 'mark-chat-read') return markChatRead(db, user.uid, body);
    if (action === 'toggle-favorite') return toggleFavorite(db, user.uid, body);
    if (action === 'send-seeker-message') return sendSeekerChatMessage(db, user.uid, body);
    if (action === 'send-seeker-audio') return sendSeekerChatMessage(db, user.uid, body, { isAudio: true });
    if (action === 'send-provider-message') return sendProviderMessage(db, user.uid, body);
    if (action === 'block-chat') return blockChat(db, user.uid, body);
    if (action === 'toggle-linkedin-share') return toggleLinkedInShare(db, user.uid, body);
    if (action === 'terminate-chat') return terminateChat(db, user.uid, body);
    if (action === 'terminate-seeker-chat') return terminateSeekerChat(db, user.uid, body);
    if (action === 'propose-meeting') return proposeMeeting(db, user.uid, body);
    if (action === 'respond-to-meeting') return respondToMeeting(db, user.uid, body);

    return json(400, { error: 'Error: Invalid chat write action.' });
  });
};
