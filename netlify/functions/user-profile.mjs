import { enforceRateLimit, ensurePost, getDb, getEffectiveRole, handleOptions, json, parseBody, requireUser, serverTimestamp, syncPublicProfile, withErrorHandling } from './_shared.mjs';
import { getClientIpFromHeaders } from '../../shared/regionBlockConfig.mjs';

const ALLOWED_SELF_ROLES = new Set(['huis_zoeker', 'huis_aanbieder']);
const ALLOWED_THEMES = new Set(['rustic', 'nordic', 'midnight', 'terracotta', 'royal', 'candy', 'forest', 'digital', 'sunset', 'industrial', 'vintage']);
const ALLOWED_UNITS = new Set(['metric', 'imperial']);
const ALLOWED_DATE_FORMATS = new Set(['DD/MM/YYYY', 'MM/DD/YYYY']);
const ALLOWED_TIME_FORMATS = new Set(['12h', '24h']);
const ALLOWED_CHAT_MAIL_OPTIONS = new Set(['only_first_chat_ever', 'each_seeker_first_chat', 'always']);

function normalizeString(value, maxLength = 100) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLength);
}

function normalizeBoolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeNumber(value, fallback = null, { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = {}) {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function getSafeRole(currentRole, user) {
  if (ALLOWED_SELF_ROLES.has(currentRole)) {
    return currentRole;
  }

  return getEffectiveRole(user, 'unassigned');
}

function sanitizeSettingsPayload(body) {
  const theme = normalizeString(body.theme, 40);
  const unit = normalizeString(body.unit, 20);
  const dateFormat = normalizeString(body.dateFormat, 20);
  const timeFormat = normalizeString(body.timeFormat, 10);
  const currency = normalizeString(body.currency, 10).toUpperCase();
  const providerChatMailAlertOption = normalizeString(body.providerChatMailAlertOption, 40);
  const language = normalizeString(body.language, 20);
  const smartMatchAlertHour = normalizeNumber(body.smartMatchAlertHour, null, { min: 0, max: 23 });

  if (!ALLOWED_THEMES.has(theme)) {
    throw new Error('Error: Invalid theme setting.');
  }

  if (!ALLOWED_UNITS.has(unit)) {
    throw new Error('Error: Invalid unit setting.');
  }

  if (!ALLOWED_DATE_FORMATS.has(dateFormat)) {
    throw new Error('Error: Invalid date format setting.');
  }

  if (!ALLOWED_TIME_FORMATS.has(timeFormat)) {
    throw new Error('Error: Invalid time format setting.');
  }

  if (!currency || currency.length > 5) {
    throw new Error('Error: Invalid currency setting.');
  }

  if (!ALLOWED_CHAT_MAIL_OPTIONS.has(providerChatMailAlertOption)) {
    throw new Error('Error: Invalid provider chat alert setting.');
  }

  if (!language) {
    throw new Error('Error: Invalid language setting.');
  }

  return {
    theme,
    unit,
    dateFormat,
    timeFormat,
    currency,
    newsletterEnabled: normalizeBoolean(body.newsletterEnabled, true),
    smartMatchAlertEnabled: normalizeBoolean(body.smartMatchAlertEnabled, false),
    smartMatchAlertHour,
    chatMailAlertEnabled: normalizeBoolean(body.chatMailAlertEnabled, true),
    providerChatMailAlertOption,
    language,
  };
}

function assignDistributedAlertHourFromDocs(usersSnap) {
  const hourCounts = Array.from({ length: 24 }, () => 0);

  usersSnap.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const hour = Number(data.smartMatchAlertHour);
    if (!Number.isNaN(hour) && hour >= 0 && hour < 24) {
      hourCounts[hour] += 1;
    }
  });

  const minCount = Math.min(...hourCounts);
  const bestHours = hourCounts
    .map((count, index) => ({ count, index }))
    .filter((entry) => entry.count === minCount)
    .map((entry) => entry.index);

  return bestHours[Math.floor(Math.random() * bestHours.length)];
}

function buildDisabledSystemMessage() {
  return {
    senderId: 'system',
    text: 'Account disabled',
    isSystem: true,
    translationKey: 'chat.account_disabled_system',
    createdAt: new Date(),
  };
}

async function disableOwnedProperties(db, userId) {
  const propertiesSnap = await db.collection('properties').where('ownerId', '==', userId).get();

  for (const propertyDoc of propertiesSnap.docs) {
    await propertyDoc.ref.update({
      isActive: false,
      ownerSuspended: true,
      updatedAt: serverTimestamp(),
    });
  }
}

async function appendDisabledSystemMessageToChats(db, userId) {
  const [seekerChatsSnap, providerChatsSnap] = await Promise.all([
    db.collection('chats').where('seekerId', '==', userId).where('status', '==', 'active').get(),
    db.collection('chats').where('providerId', '==', userId).where('status', '==', 'active').get(),
  ]);
  const seenChatIds = new Set();
  const chats = [...seekerChatsSnap.docs, ...providerChatsSnap.docs].filter((docSnap) => {
    if (seenChatIds.has(docSnap.id)) {
      return false;
    }

    seenChatIds.add(docSnap.id);
    return true;
  });

  for (const chatDoc of chats) {
    const chatData = chatDoc.data() || {};
    const messages = Array.isArray(chatData.messages) ? chatData.messages : [];
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

    if (lastMessage?.translationKey === 'chat.account_disabled_system') {
      continue;
    }

    await chatDoc.ref.update({
      messages: [...messages, buildDisabledSystemMessage()],
      updatedAt: serverTimestamp(),
    });
  }
}

async function disableAccountData(db, user) {
  const userId = user.uid;
  const userRef = db.collection('users').doc(userId);
  const [userSnap, providerSnap, seekerProfileSnap] = await Promise.all([
    userRef.get(),
    db.collection('providers').doc(userId).get(),
    db.collection('seeker_profiles').doc(userId).get(),
  ]);

  if (!userSnap.exists) {
    throw new Error('Error: User not found.');
  }

  await userRef.set({
    isSuspended: true,
    disabledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  if (providerSnap.exists) {
    await providerSnap.ref.set({
      isSuspended: true,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  if (seekerProfileSnap.exists) {
    await seekerProfileSnap.ref.set({
      isSuspended: true,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  await disableOwnedProperties(db, userId);
  await appendDisabledSystemMessageToChats(db, userId);
}

export const handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  const postResponse = ensurePost(event);
  if (postResponse) return postResponse;

  return withErrorHandling(async () => {
    const user = await requireUser(event);
    const body = parseBody(event);
    const { action, role, language } = body;
    const clientIp = getClientIpFromHeaders(event.headers);
    const db = getDb();
    const userRef = db.collection('users').doc(user.uid);
    const userSnap = await userRef.get();

    await enforceRateLimit({
      scope: 'user_profile_ip',
      identifier: clientIp,
      maxRequests: 20,
      windowMs: 5 * 60 * 1000,
      errorMessage: 'Error: Too many profile requests from this network location.',
    });

    await enforceRateLimit({
      scope: 'user_profile_user',
      identifier: `${user.uid}:${action || 'sync'}`,
      maxRequests: action === 'set-role' ? 5 : 15,
      windowMs: 5 * 60 * 1000,
      errorMessage: 'Error: Too many profile requests. Please wait before trying again.',
    });

    if (action === 'assign-alert-hour') {
      const usersSnap = await db.collection('users').where('smartMatchAlertEnabled', '==', true).get();
      const hour = assignDistributedAlertHourFromDocs(usersSnap);

      return json(200, { hour });
    }

    if (action === 'set-role') {
      if (!ALLOWED_SELF_ROLES.has(role)) {
        return json(400, { error: 'Error: Invalid role selection.' });
      }

      const nextRole = getSafeRole(role, user);
      await userRef.set({
        uid: user.uid,
        email: user.email || '',
        displayName: user.name || user.email || 'Gebruiker',
        photoURL: user.picture || '',
        hasProfile: true,
        role: nextRole,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await syncPublicProfile(db, user.uid);

      return json(200, { role: nextRole });
    }

    if (action === 'set-language') {
      const nextLanguage = normalizeString(language, 20);
      if (!nextLanguage) {
        return json(400, { error: 'Error: Invalid language selection.' });
      }

      await Promise.all([
        userRef.set({
          language: nextLanguage,
          updatedAt: serverTimestamp(),
        }, { merge: true }),
        userRef.collection('settings').doc('preferences').set({
          language: nextLanguage,
          updatedAt: serverTimestamp(),
        }, { merge: true }),
      ]);

      return json(200, { ok: true, language: nextLanguage });
    }

    if (action === 'disable-account') {
      await disableAccountData(db, user);
      return json(200, { ok: true });
    }

    if (action === 'save-settings') {
      const settings = sanitizeSettingsPayload(body);
      let assignedHour = settings.smartMatchAlertHour;

      if (settings.smartMatchAlertEnabled && assignedHour === null) {
        const usersSnap = await db.collection('users').where('smartMatchAlertEnabled', '==', true).get();
        assignedHour = assignDistributedAlertHourFromDocs(usersSnap);
      }

      const settingsPayload = {
        ...settings,
        smartMatchAlertHour: assignedHour,
        updatedAt: serverTimestamp(),
      };

      await Promise.all([
        userRef.collection('settings').doc('preferences').set(settingsPayload, { merge: true }),
        userRef.set({
          smartMatchAlertEnabled: settings.smartMatchAlertEnabled,
          smartMatchAlertHour: assignedHour,
          chatMailAlertEnabled: settings.chatMailAlertEnabled,
          providerChatMailAlertOption: settings.providerChatMailAlertOption,
          language: settings.language,
          updatedAt: serverTimestamp(),
        }, { merge: true }),
      ]);

      return json(200, {
        ok: true,
        smartMatchAlertHour: assignedHour,
      });
    }

    const existing = userSnap.exists ? userSnap.data() || {} : {};
    const safeRole = getSafeRole(existing.role, user);
    const nextData = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.name || user.email || 'Nieuwe Gebruiker',
      photoURL: user.picture || '',
      hasProfile: existing.hasProfile === true,
      role: safeRole,
      updatedAt: serverTimestamp(),
    };

    if (!userSnap.exists) {
      await userRef.set({
        ...nextData,
        createdAt: serverTimestamp(),
        credits: 100,
        max_properties: 3,
      }, { merge: true });
      await syncPublicProfile(db, user.uid);

      return json(200, {
        role: safeRole,
        credits: 100,
        hasProfile: false,
      });
    }

    await userRef.set(nextData, { merge: true });
    await syncPublicProfile(db, user.uid);

    return json(200, {
      role: safeRole,
      credits: Number(existing.credits || 0),
      hasProfile: existing.hasProfile === true,
    });
  });
};
