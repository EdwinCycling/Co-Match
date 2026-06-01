import {
  enforceRateLimit,
  ensurePost,
  getDb,
  handleOptions,
  json,
  parseBody,
  requireAdmin,
  serverTimestamp,
  syncPublicProfile,
  withErrorHandling,
} from './_shared.mjs';
import { getClientIpFromHeaders } from '../../shared/regionBlockConfig.mjs';

const CONTACT_REQUEST_STATUSES = new Set(['OPEN', 'REPLIED']);
const GIFT_TYPES = new Set(['new', 'improvement']);
const GIFT_AUDIENCES = new Set(['all', 'huis_zoeker', 'huis_aanbieder']);
const EXPERT_LINK_TYPES = new Set(['lead', 'info']);
const VERIFICATION_DECISIONS = new Set(['APPROVED', 'REJECTED']);
const ALLOWED_PROPERTY_IMAGE_CATEGORIES = new Set(['exterior', 'living', 'bedroom', 'kitchen', 'bathroom', 'other']);

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

function ensureValidDateString(value, fieldName) {
  const normalized = normalizeString(value, 40);
  const parsed = new Date(normalized);
  if (!normalized || Number.isNaN(parsed.getTime())) {
    throw new Error(`Error: Invalid ${fieldName}.`);
  }

  return normalized;
}

function ensureHttpUrl(value, fieldName) {
  const normalized = normalizeString(value, 4000);
  if (!normalized) {
    throw new Error(`Error: Missing ${fieldName}.`);
  }

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`Error: Invalid ${fieldName}.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Error: Invalid ${fieldName}.`);
  }

  return parsed.toString();
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneJsonValue(value) {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item)).filter((item) => item !== undefined);
  }

  if (!isPlainObject(value)) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entry]) => [key, cloneJsonValue(entry)])
      .filter(([, entry]) => entry !== undefined)
  );
}

function cloneJsonObject(value) {
  const cloned = cloneJsonValue(value);
  return isPlainObject(cloned) ? cloned : {};
}

function normalizeStringArray(value, maxItems = 250, maxItemLength = 120) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => typeof entry === 'string')
    .map((entry) => entry.trim().slice(0, maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

async function deleteRefsInChunks(db, refs, chunkSize = 400) {
  for (let index = 0; index < refs.length; index += chunkSize) {
    const batch = db.batch();
    refs.slice(index, index + chunkSize).forEach((ref) => {
      batch.delete(ref);
    });
    await batch.commit();
  }
}

function sanitizeAdminMessagePayload(body) {
  const text = normalizeString(body.text, 5000);
  const targetAudience = normalizeString(body.targetAudience, 30) || 'all';
  const type = normalizeString(body.type, 30) || 'info';
  const startDate = ensureValidDateString(body.startDate, 'message start date');
  const endDate = body.endDate ? ensureValidDateString(body.endDate, 'message end date') : null;

  if (!text) {
    throw new Error('Error: Missing message text.');
  }

  return {
    text,
    targetAudience,
    type,
    startDate,
    endDate,
    isDisabled: normalizeBoolean(body.isDisabled, false),
    updatedAt: serverTimestamp(),
  };
}

function sanitizeAdminPropertyPayload(body) {
  const property = cloneJsonObject(body.property);
  delete property.id;
  delete property.createdAt;
  delete property.updatedAt;

  return {
    ...property,
    updatedAt: serverTimestamp(),
  };
}

function sanitizeExchangeRatesPayload(body) {
  const rates = cloneJsonObject(body.rates);
  const sanitized = {};

  Object.entries(rates).forEach(([code, value]) => {
    const normalizedCode = normalizeString(code, 5).toUpperCase();
    const normalizedRate = normalizeNumber(value, NaN, { min: 0.000001, max: 1000000 });

    if (!normalizedCode || !Number.isFinite(normalizedRate)) {
      return;
    }

    sanitized[normalizedCode] = normalizedRate;
  });

  if (Object.keys(sanitized).length === 0) {
    throw new Error('Error: Missing exchange rates.');
  }

  return sanitized;
}

function sanitizePropertyImagesPayload(body) {
  if (!Array.isArray(body.images) || body.images.length === 0) {
    throw new Error('Error: Missing property images.');
  }

  return body.images
    .map((image) => {
      const entry = cloneJsonObject(image);
      const id = normalizeString(entry.id, 120);
      const url = ensureHttpUrl(entry.url, 'property image url');
      const category = normalizeString(entry.category, 30) || 'other';
      const description = normalizeString(entry.description, 300);

      if (!id) {
        throw new Error('Error: Invalid property image id.');
      }

      return {
        id,
        url,
        category: ALLOWED_PROPERTY_IMAGE_CATEGORIES.has(category) ? category : 'other',
        description,
      };
    })
    .slice(0, 24);
}

function sanitizeStopConfig(body) {
  const config = cloneJsonObject(body.config);

  return {
    isEnabled: normalizeBoolean(config.isEnabled, false),
    startDate: config.startDate ? ensureValidDateString(config.startDate, 'stop start date') : '',
    duration: normalizeString(config.duration, 20),
    message: normalizeString(config.message, 5000),
    updatedAt: serverTimestamp(),
  };
}

function sanitizeAiSettings(body) {
  const settings = cloneJsonObject(body.settings);

  return {
    role_instruction: normalizeString(settings.role_instruction, 50000),
    match_instruction: normalizeString(settings.match_instruction, 50000),
    makelaar_role_instruction: normalizeString(settings.makelaar_role_instruction, 50000),
    makelaar_report_instruction: normalizeString(settings.makelaar_report_instruction, 50000),
    updatedAt: serverTimestamp(),
  };
}

function sanitizeGiftPayload(body) {
  const title = normalizeString(body.title, 200);
  const message = normalizeString(body.message, 5000);
  const type = normalizeString(body.type, 30) || 'new';
  const targetAudience = normalizeString(body.targetAudience, 30) || 'all';
  const startDate = ensureValidDateString(body.startDate, 'gift start date');
  const imageUrl = normalizeString(body.imageUrl, 4000);

  if (!title || !message) {
    throw new Error('Error: Missing required gift fields.');
  }

  if (!GIFT_TYPES.has(type)) {
    throw new Error('Error: Invalid gift type.');
  }

  if (!GIFT_AUDIENCES.has(targetAudience)) {
    throw new Error('Error: Invalid gift target audience.');
  }

  return {
    title,
    message,
    type,
    targetAudience,
    startDate,
    isHighPriority: normalizeBoolean(body.isHighPriority, false),
    imageUrl,
    updatedAt: serverTimestamp(),
  };
}

function sanitizeExpertLinkPayload(body) {
  const title = normalizeString(body.title, 200);
  const country = normalizeString(body.country, 120);
  const category = normalizeString(body.category, 120);
  const description = normalizeString(body.description, 2000);
  const linkType = normalizeString(body.linkType, 30) || 'lead';

  if (!title || !country || !category) {
    throw new Error('Error: Missing required expert link fields.');
  }

  if (!EXPERT_LINK_TYPES.has(linkType)) {
    throw new Error('Error: Invalid expert link type.');
  }

  return {
    title,
    url: ensureHttpUrl(body.url, 'expert link url'),
    country,
    category,
    order_index: normalizeNumber(body.order_index, 0, { min: 0, max: 9999 }),
    description,
    linkType,
    isActive: normalizeBoolean(body.isActive, true),
    updatedAt: serverTimestamp(),
  };
}

async function updateContactRequestStatus(db, body) {
  const requestId = normalizeString(body.requestId, 120);
  const status = normalizeString(body.status, 20);

  if (!requestId) {
    throw new Error('Error: Missing contact request id.');
  }

  if (!CONTACT_REQUEST_STATUSES.has(status)) {
    throw new Error('Error: Invalid contact request status.');
  }

  const requestRef = db.collection('contact_requests').doc(requestId);
  const requestSnap = await requestRef.get();
  if (!requestSnap.exists) {
    throw new Error('Error: Contact request not found.');
  }

  await requestRef.update({
    status,
    updatedAt: serverTimestamp(),
  });

  return json(200, { ok: true, status });
}

async function saveGift(db, body) {
  const giftId = normalizeString(body.giftId, 120);
  const payload = sanitizeGiftPayload(body);

  if (giftId) {
    const giftRef = db.collection('gifts').doc(giftId);
    const giftSnap = await giftRef.get();
    if (!giftSnap.exists) {
      throw new Error('Error: Gift not found.');
    }

    await giftRef.update(payload);
    return json(200, { ok: true, id: giftId });
  }

  const giftRef = db.collection('gifts').doc();
  await giftRef.set({
    ...payload,
    createdAt: serverTimestamp(),
  });

  return json(200, { ok: true, id: giftRef.id });
}

async function deleteGift(db, body) {
  const giftId = normalizeString(body.giftId, 120);
  if (!giftId) {
    throw new Error('Error: Missing gift id.');
  }

  const giftRef = db.collection('gifts').doc(giftId);
  const giftSnap = await giftRef.get();
  if (!giftSnap.exists) {
    throw new Error('Error: Gift not found.');
  }

  await giftRef.delete();
  return json(200, { ok: true });
}

async function saveExpertLink(db, body) {
  const linkId = normalizeString(body.linkId, 120);
  const payload = sanitizeExpertLinkPayload(body);

  if (linkId) {
    const linkRef = db.collection('expert_links').doc(linkId);
    const linkSnap = await linkRef.get();
    if (!linkSnap.exists) {
      throw new Error('Error: Expert link not found.');
    }

    await linkRef.set(payload, { merge: true });
    return json(200, { ok: true, id: linkId });
  }

  const linkRef = db.collection('expert_links').doc();
  await linkRef.set({
    ...payload,
    createdAt: serverTimestamp(),
  });

  return json(200, { ok: true, id: linkRef.id });
}

async function deleteExpertLink(db, body) {
  const linkId = normalizeString(body.linkId, 120);
  if (!linkId) {
    throw new Error('Error: Missing expert link id.');
  }

  const linkRef = db.collection('expert_links').doc(linkId);
  const linkSnap = await linkRef.get();
  if (!linkSnap.exists) {
    throw new Error('Error: Expert link not found.');
  }

  await linkRef.delete();
  return json(200, { ok: true });
}

async function reorderExpertLinks(db, body) {
  const currentId = normalizeString(body.currentId, 120);
  const targetId = normalizeString(body.targetId, 120);
  const currentOrder = normalizeNumber(body.currentOrder, 0, { min: 0, max: 9999 });
  const targetOrder = normalizeNumber(body.targetOrder, 0, { min: 0, max: 9999 });

  if (!currentId || !targetId) {
    throw new Error('Error: Missing expert link reorder ids.');
  }

  await db.runTransaction(async (transaction) => {
    const currentRef = db.collection('expert_links').doc(currentId);
    const targetRef = db.collection('expert_links').doc(targetId);
    const [currentSnap, targetSnap] = await Promise.all([
      transaction.get(currentRef),
      transaction.get(targetRef),
    ]);

    if (!currentSnap.exists || !targetSnap.exists) {
      throw new Error('Error: Expert link not found.');
    }

    transaction.update(currentRef, {
      order_index: targetOrder,
      updatedAt: serverTimestamp(),
    });
    transaction.update(targetRef, {
      order_index: currentOrder,
      updatedAt: serverTimestamp(),
    });
  });

  return json(200, { ok: true });
}

async function toggleAdminUserStatus(db, body) {
  const userId = normalizeString(body.userId, 120);
  const isSuspended = normalizeBoolean(body.isSuspended, false);

  if (!userId) {
    throw new Error('Error: Missing user id.');
  }

  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new Error('Error: User not found.');
  }

  await userRef.update({
    isSuspended,
    updatedAt: serverTimestamp(),
  });

  return json(200, { ok: true, isSuspended });
}

async function addAdminUserCredits(db, body) {
  const userId = normalizeString(body.userId, 120);
  const amount = normalizeNumber(body.amount, 0, { min: -1000000, max: 1000000 });

  if (!userId || amount === 0) {
    throw new Error('Error: Invalid credit update request.');
  }

  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new Error('Error: User not found.');
  }

  const currentCredits = normalizeNumber(userSnap.data()?.credits, 0, { min: 0, max: 99999999 });
  const nextCredits = currentCredits + amount;

  await userRef.update({
    credits: nextCredits,
    updatedAt: serverTimestamp(),
  });

  return json(200, { ok: true, credits: nextCredits });
}

async function bulkAddAdminUserCredits(db, body) {
  const userIds = normalizeStringArray(body.userIds, 250, 120);
  const amount = normalizeNumber(body.amount, 0, { min: -1000000, max: 1000000 });

  if (userIds.length === 0 || amount === 0) {
    throw new Error('Error: Invalid bulk credit update request.');
  }

  for (const userId of userIds) {
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      continue;
    }

    const currentCredits = normalizeNumber(userSnap.data()?.credits, 0, { min: 0, max: 99999999 });
    await userRef.update({
      credits: currentCredits + amount,
      updatedAt: serverTimestamp(),
    });
  }

  return json(200, { ok: true });
}

async function saveAdminMessage(db, body) {
  const messageId = normalizeString(body.messageId, 120);
  const payload = sanitizeAdminMessagePayload(body);

  if (messageId) {
    const messageRef = db.collection('admin_messages').doc(messageId);
    const messageSnap = await messageRef.get();
    if (!messageSnap.exists) {
      throw new Error('Error: Admin message not found.');
    }

    await messageRef.update(payload);
    return json(200, { ok: true, id: messageId });
  }

  const messageRef = db.collection('admin_messages').doc();
  await messageRef.set({
    ...payload,
    createdAt: serverTimestamp(),
  });

  return json(200, { ok: true, id: messageRef.id });
}

async function deleteAdminMessage(db, body) {
  const messageId = normalizeString(body.messageId, 120);
  if (!messageId) {
    throw new Error('Error: Missing admin message id.');
  }

  const messageRef = db.collection('admin_messages').doc(messageId);
  const messageSnap = await messageRef.get();
  if (!messageSnap.exists) {
    throw new Error('Error: Admin message not found.');
  }

  await messageRef.delete();
  return json(200, { ok: true });
}

async function saveAdminStopConfig(db, body) {
  const payload = sanitizeStopConfig(body);
  await db.collection('settings').doc('app_stop').set(payload, { merge: true });
  return json(200, { ok: true });
}

async function saveAdminAiSettings(db, body) {
  const payload = sanitizeAiSettings(body);
  await db.collection('ai_settings').doc('matching').set(payload, { merge: true });
  return json(200, { ok: true });
}

async function saveAdminExchangeRates(db, body) {
  const rates = sanitizeExchangeRatesPayload(body);
  await db.collection('settings').doc('currency_rates').set({
    rates,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return json(200, { ok: true });
}

async function removeAdminPropertyPhoto(db, body) {
  const propertyId = normalizeString(body.propertyId, 120);
  const photoId = normalizeString(body.photoId, 120);

  if (!propertyId || !photoId) {
    throw new Error('Error: Missing property photo identifiers.');
  }

  const propertyRef = db.collection('properties').doc(propertyId);
  const propertySnap = await propertyRef.get();
  if (!propertySnap.exists) {
    throw new Error('Error: Property not found.');
  }

  const propertyData = propertySnap.data() || {};
  const currentImages = Array.isArray(propertyData.images) ? propertyData.images : [];
  const updatedImages = currentImages.filter((image) => image?.id !== photoId);

  await propertyRef.update({
    images: updatedImages,
    teaserImageId: propertyData.teaserImageId === photoId && updatedImages.length > 0 ? updatedImages[0].id : propertyData.teaserImageId === photoId ? '' : propertyData.teaserImageId || '',
    updatedAt: serverTimestamp(),
  });

  return json(200, { ok: true });
}

async function saveAdminPropertyImages(db, body) {
  const propertyId = normalizeString(body.propertyId, 120);
  const teaserImageId = normalizeString(body.teaserImageId, 120);
  const images = sanitizePropertyImagesPayload(body);

  if (!propertyId) {
    throw new Error('Error: Missing property id.');
  }

  const propertyRef = db.collection('properties').doc(propertyId);
  const propertySnap = await propertyRef.get();
  if (!propertySnap.exists) {
    throw new Error('Error: Property not found.');
  }

  const nextTeaserImageId = images.some((image) => image.id === teaserImageId) ? teaserImageId : images[0].id;

  await propertyRef.update({
    images,
    teaserImageId: nextTeaserImageId,
    updatedAt: serverTimestamp(),
  });

  return json(200, { ok: true });
}

async function setAdminUserSuspension(db, body) {
  const userId = normalizeString(body.userId, 120);
  const isSuspended = normalizeBoolean(body.isSuspended, false);

  if (!userId) {
    throw new Error('Error: Missing user id.');
  }

  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new Error('Error: User not found.');
  }

  await userRef.update({
    isSuspended,
    updatedAt: serverTimestamp(),
  });

  const ownerPropertiesSnap = await db.collection('properties').where('ownerId', '==', userId).get();
  if (!ownerPropertiesSnap.empty) {
    const batch = db.batch();
    ownerPropertiesSnap.docs.forEach((propertyDoc) => {
      batch.update(propertyDoc.ref, {
        ownerSuspended: isSuspended,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }

  const providerRef = db.collection('providers').doc(userId);
  const providerSnap = await providerRef.get();
  if (providerSnap.exists) {
    await providerRef.update({
      isSuspended,
      updatedAt: serverTimestamp(),
    });
  }

  return json(200, { ok: true, isSuspended });
}

async function updateAdminProperty(db, body) {
  const propertyId = normalizeString(body.propertyId, 120);
  if (!propertyId) {
    throw new Error('Error: Missing property id.');
  }

  const propertyRef = db.collection('properties').doc(propertyId);
  const propertySnap = await propertyRef.get();
  if (!propertySnap.exists) {
    throw new Error('Error: Property not found.');
  }

  await propertyRef.update(sanitizeAdminPropertyPayload(body));
  return json(200, { ok: true });
}

async function toggleAdminPropertyStatus(db, body) {
  const propertyId = normalizeString(body.propertyId, 120);
  const isActive = normalizeBoolean(body.isActive, false);

  if (!propertyId) {
    throw new Error('Error: Missing property id.');
  }

  const propertyRef = db.collection('properties').doc(propertyId);
  const propertySnap = await propertyRef.get();
  if (!propertySnap.exists) {
    throw new Error('Error: Property not found.');
  }

  await propertyRef.update({
    isActive,
    updatedAt: serverTimestamp(),
  });

  return json(200, { ok: true, isActive });
}

async function deleteAdminProperty(db, body) {
  const propertyId = normalizeString(body.propertyId, 120);
  if (!propertyId) {
    throw new Error('Error: Missing property id.');
  }

  const propertyRef = db.collection('properties').doc(propertyId);
  const propertySnap = await propertyRef.get();
  if (!propertySnap.exists) {
    throw new Error('Error: Property not found.');
  }

  const matchesSnap = await db.collection('matches').where('propertyId', '==', propertyId).limit(1).get();
  if (!matchesSnap.empty) {
    await propertyRef.update({
      isActive: false,
      updatedAt: serverTimestamp(),
    });
    return json(200, { ok: true, deleted: false, isActive: false });
  }

  await propertyRef.delete();
  return json(200, { ok: true, deleted: true });
}

async function setAdminVerificationDecision(db, body) {
  const userId = normalizeString(body.userId, 120);
  const decision = normalizeString(body.decision, 20);

  if (!userId || !VERIFICATION_DECISIONS.has(decision)) {
    throw new Error('Error: Invalid verification decision.');
  }

  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new Error('Error: User not found.');
  }

  const updatePayload = {
    'verificationStatus.level3.status': decision,
    updatedAt: serverTimestamp(),
  };

  if (decision === 'APPROVED') {
    updatePayload.verificationLevel = 3;
  }

  await userRef.update(updatePayload);
  await syncPublicProfile(db, userId);
  return json(200, { ok: true });
}

async function createAdminMockProperties(db, adminUser) {
  const cities = [
    { city: 'Antwerpen', lat: 51.2194, lng: 4.4025, neighborhoods: ['Zuid', 'Noord', 'Berchem', 'Zurenborg', 'Eilandje'] },
    { city: 'Gent', lat: 51.05, lng: 3.7303, neighborhoods: ['Sint-Amandsberg', 'Brugse Poort', 'Rabot', 'Ledeberg', 'Centrum'] },
    { city: 'Brussel', lat: 50.8503, lng: 4.3517, neighborhoods: ['Elsene', 'Etterbeek', 'Sint-Gillis', 'Schaarbeek', 'Laken'] },
    { city: 'Leuven', lat: 50.8798, lng: 4.7005, neighborhoods: ['Centrum', 'Heverlee', 'Kessel-Lo', 'Wilsele'] },
  ];
  const adjs = ['Prachtige', 'Gezellige', 'Ruime', 'Lichte', 'Moderne', 'Karaktervolle', 'Hippe', 'Duurzame'];
  const types = ['Kamer', 'Studio', 'Appartement', 'Huis', 'Loft'];
  const unsplashImages = [
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=800',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=800',
    'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&q=80&w=800',
    'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&q=80&w=800',
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&q=80&w=800',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=800',
    'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&q=80&w=800',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&q=80&w=800',
  ];
  const batch = db.batch();

  for (let index = 0; index < 100; index += 1) {
    const cityData = cities[Math.floor(Math.random() * cities.length)];
    const neighborhood = cityData.neighborhoods[Math.floor(Math.random() * cityData.neighborhoods.length)];
    const lat = cityData.lat + (Math.random() - 0.5) * 0.05;
    const lng = cityData.lng + (Math.random() - 0.5) * 0.05;
    const type = types[Math.floor(Math.random() * types.length)];
    const adj = adjs[Math.floor(Math.random() * adjs.length)];
    const title = `${adj} ${type.toLowerCase()} in ${neighborhood}`;
    const price = Math.floor(Math.random() * 1000) + 450;
    const goalOptions = ['cohousing', 'hospita', 'vakantie_onderhuur', 'huisbewaring_expat', 'vrije_verhuur'];
    const typeOptions = ['kamer', 'studio', 'appartement', 'woning'];
    const domicileOptions = ['ja', 'nee', 'overleg', 'weet_ik_niet'];
    const shuffledImages = [...unsplashImages].sort(() => 0.5 - Math.random()).slice(0, 3);
    const propertyImages = shuffledImages.map((url, imageIndex) => ({
      id: `img-${index}-${imageIndex}-${Math.random().toString(36).slice(2, 7)}`,
      url,
      category: imageIndex === 0 ? 'exterior' : imageIndex === 1 ? 'living' : 'bedroom',
      description: imageIndex === 0 ? 'Buitenkant' : imageIndex === 1 ? 'Woonkamer' : 'Slaapkamer',
    }));

    const propertyRef = db.collection('properties').doc();
    batch.set(propertyRef, {
      ownerId: adminUser.uid,
      title,
      price,
      location: `${cityData.city}, ${neighborhood}`,
      city: cityData.city,
      address: `Randomstraat ${Math.floor(Math.random() * 100) + 1}, ${cityData.city}`,
      neighborhood,
      displayLat: lat,
      displayLng: lng,
      displayRadius: 500,
      status: 'available',
      completion: 100,
      isActive: true,
      features: {
        goal: goalOptions[Math.floor(Math.random() * goalOptions.length)],
        type: typeOptions[Math.floor(Math.random() * typeOptions.length)],
        domicile: domicileOptions[Math.floor(Math.random() * domicileOptions.length)],
        bedrooms: Math.floor(Math.random() * 4) + 1,
        bathrooms: Math.floor(Math.random() * 2) + 1,
        area_private: Math.floor(Math.random() * 60) + 12,
        area_shared: Math.floor(Math.random() * 120) + 20,
        furnished: Math.random() > 0.5 ? 'volledig' : 'deels',
        energy_label: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)],
        outdoor_space: Math.random() > 0.3 ? (Math.random() > 0.5 ? 'tuin' : 'balkon') : 'geen',
        free_text_description: `Welkom in deze ${title.toLowerCase()}. Fantastische locatie, veel lichtinval. Ideaal voor een leuke huisgenoot. Voorzien van alle gemakken waaronder internet, een eigen keuken en badkamer. We zoeken een gezellig iemand die van ${Math.random() > 0.5 ? 'yoga en vegan eten' : 'gezellig samen eten'} houdt. ${Math.random() > 0.5 ? 'Met groot balkon' : 'Met zonnige tuin'}.`,
        available_from: new Date(Date.now() + Math.random() * 90 * 86400000).toISOString().split('T')[0],
        min_stay: Math.floor(Math.random() * 6) + 1,
        max_stay: Math.random() > 0.6 ? Math.floor(Math.random() * 20) + 6 : '',
        is_indefinite: Math.random() > 0.4,
        dna_social: Math.floor(Math.random() * 4) + 1,
        dna_clean: Math.floor(Math.random() * 4) + 1,
        dna_quiet: Math.floor(Math.random() * 4) + 1,
        dna_sustainable: Math.floor(Math.random() * 4) + 1,
      },
      priceType: 'fixed',
      minPrice: price,
      maxPrice: price,
      images: propertyImages,
      teaserImageId: propertyImages[0]?.id || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
  return json(200, { ok: true });
}

async function clearAdminProperties(db) {
  const propertiesSnap = await db.collection('properties').get();
  await deleteRefsInChunks(db, propertiesSnap.docs.map((docSnap) => docSnap.ref));
  return json(200, { ok: true });
}

export const handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  const postResponse = ensurePost(event);
  if (postResponse) return postResponse;

  return withErrorHandling(async () => {
    const adminUser = await requireAdmin(event);
    const body = parseBody(event);
    const action = normalizeString(body.action, 60);
    const clientIp = getClientIpFromHeaders(event.headers);
    const db = getDb();

    await enforceRateLimit({
      scope: 'admin_writes_ip',
      identifier: clientIp,
      maxRequests: 120,
      windowMs: 60 * 60 * 1000,
      errorMessage: 'Error: Too many admin write attempts from this network location.',
    });

    await enforceRateLimit({
      scope: 'admin_writes_user',
      identifier: `${adminUser.uid}:${action}`,
      maxRequests: 120,
      windowMs: 10 * 60 * 1000,
      errorMessage: 'Error: Too many admin write attempts. Please wait before trying again.',
    });

    if (action === 'update-contact-request-status') {
      return updateContactRequestStatus(db, body);
    }

    if (action === 'toggle-admin-user-status') {
      return toggleAdminUserStatus(db, body);
    }

    if (action === 'add-admin-user-credits') {
      return addAdminUserCredits(db, body);
    }

    if (action === 'bulk-add-admin-user-credits') {
      return bulkAddAdminUserCredits(db, body);
    }

    if (action === 'save-gift') {
      return saveGift(db, body);
    }

    if (action === 'delete-gift') {
      return deleteGift(db, body);
    }

    if (action === 'save-expert-link') {
      return saveExpertLink(db, body);
    }

    if (action === 'delete-expert-link') {
      return deleteExpertLink(db, body);
    }

    if (action === 'reorder-expert-links') {
      return reorderExpertLinks(db, body);
    }

    if (action === 'save-admin-message') {
      return saveAdminMessage(db, body);
    }

    if (action === 'delete-admin-message') {
      return deleteAdminMessage(db, body);
    }

    if (action === 'save-admin-stop-config') {
      return saveAdminStopConfig(db, body);
    }

    if (action === 'save-admin-ai-settings') {
      return saveAdminAiSettings(db, body);
    }

    if (action === 'save-admin-exchange-rates') {
      return saveAdminExchangeRates(db, body);
    }

    if (action === 'remove-admin-property-photo') {
      return removeAdminPropertyPhoto(db, body);
    }

    if (action === 'save-admin-property-images') {
      return saveAdminPropertyImages(db, body);
    }

    if (action === 'set-admin-user-suspension') {
      return setAdminUserSuspension(db, body);
    }

    if (action === 'update-admin-property') {
      return updateAdminProperty(db, body);
    }

    if (action === 'toggle-admin-property-status') {
      return toggleAdminPropertyStatus(db, body);
    }

    if (action === 'delete-admin-property') {
      return deleteAdminProperty(db, body);
    }

    if (action === 'set-admin-verification-decision') {
      return setAdminVerificationDecision(db, body);
    }

    if (action === 'create-admin-mock-properties') {
      return createAdminMockProperties(db, adminUser);
    }

    if (action === 'clear-admin-properties') {
      return clearAdminProperties(db);
    }

    return json(400, { error: 'Error: Invalid admin write action.' });
  });
};
