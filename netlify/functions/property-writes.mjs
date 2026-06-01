import {
  enforceRateLimit,
  ensurePost,
  getDb,
  hasAdminClaim,
  handleOptions,
  json,
  parseBody,
  requireUser,
  serverTimestamp,
  withErrorHandling,
} from './_shared.mjs';
import { getClientIpFromHeaders } from '../../shared/regionBlockConfig.mjs';

// #region debug-point A:reporter
const reportPropertyWriteDebug = (hypothesisId, location, msg, data = {}) => fetch('http://127.0.0.1:7777/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'admin-save-errors', runId: 'post-fix', hypothesisId, location, msg: `[DEBUG] ${msg}`, data, ts: Date.now() }) }).catch(() => {});
// #endregion

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeString(value, maxLength = 1000) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLength);
}

function normalizeNumber(value, fallback = 0, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numeric));
}

function normalizeStringArray(value, maxItems = 50, maxItemLength = 200) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim().slice(0, maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function stripUndefined(value) {
  if (Array.isArray(value)) {
    return value
      .map(stripUndefined)
      .filter((entry) => entry !== undefined);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, stripUndefined(entry)])
  );
}

function sanitizePropertyPayload(value) {
  const payload = isPlainObject(value) ? { ...value } : {};

  delete payload.id;
  delete payload.ownerId;
  delete payload.createdAt;
  delete payload.updatedAt;

  if (typeof payload.title === 'string') payload.title = normalizeString(payload.title, 150);
  if (typeof payload.address === 'string') payload.address = normalizeString(payload.address, 200);
  if (typeof payload.city === 'string') payload.city = normalizeString(payload.city, 120);
  if (typeof payload.neighborhood === 'string') payload.neighborhood = normalizeString(payload.neighborhood, 120);
  if (typeof payload.location === 'string') payload.location = normalizeString(payload.location, 200);
  if (typeof payload.description === 'string') payload.description = normalizeString(payload.description, 20000);
  if (typeof payload.priceDescription === 'string') payload.priceDescription = normalizeString(payload.priceDescription, 500);
  if (typeof payload.price === 'number' || typeof payload.price === 'string') payload.price = normalizeNumber(payload.price, 0, 0, 99999999);
  if (typeof payload.minPrice === 'number' || typeof payload.minPrice === 'string') payload.minPrice = normalizeNumber(payload.minPrice, 0, 0, 99999999);
  if (typeof payload.maxPrice === 'number' || typeof payload.maxPrice === 'string') payload.maxPrice = normalizeNumber(payload.maxPrice, 0, 0, 99999999);
  if (typeof payload.maxInquiries === 'number' || typeof payload.maxInquiries === 'string') payload.maxInquiries = normalizeNumber(payload.maxInquiries, 10, 1, 50);
  if (typeof payload.currentInquiries === 'number' || typeof payload.currentInquiries === 'string') payload.currentInquiries = normalizeNumber(payload.currentInquiries, 0, 0, 9999);
  if (Array.isArray(payload.highlightWeeks)) payload.highlightWeeks = normalizeStringArray(payload.highlightWeeks, 64, 20);

  if (Array.isArray(payload.images)) {
    payload.images = payload.images
      .filter((image) => isPlainObject(image))
      .slice(0, 15)
      .map((image) => ({
        id: normalizeString(image.id, 80),
        url: normalizeString(image.url, 4000),
        category: normalizeString(image.category, 50),
        description: typeof image.description === 'string' ? normalizeString(image.description, 300) : '',
      }));
  }

  if (!isPlainObject(payload.features)) {
    payload.features = {};
  }

  if (isPlainObject(payload.visibility)) {
    payload.visibility = stripUndefined(payload.visibility);
  }

  if (isPlainObject(payload.monthlyAvailability)) {
    payload.monthlyAvailability = stripUndefined(payload.monthlyAvailability);
  }

  return stripUndefined(payload);
}

async function getOwnedProperty(db, propertyId, userId, isAdminUser = false) {
  const propertyRef = db.collection('properties').doc(propertyId);
  const propertySnap = await propertyRef.get();

  // #region debug-point A:property-lookup
  await reportPropertyWriteDebug('A', 'property-writes.mjs:getOwnedProperty', 'Loaded property for ownership check', { propertyId, userId, exists: propertySnap.exists });
  // #endregion

  if (!propertySnap.exists) {
    throw new Error('Error: Property not found.');
  }

  const propertyData = propertySnap.data() || {};
  // #region debug-point A:ownership-result
  await reportPropertyWriteDebug('A', 'property-writes.mjs:getOwnedProperty', 'Compared property owner against caller', { propertyId, userId, ownerId: propertyData.ownerId || null, isAdminUser, accessGranted: propertyData.ownerId === userId || isAdminUser });
  // #endregion
  if (propertyData.ownerId !== userId && !isAdminUser) {
    throw new Error('Error: Access denied.');
  }

  return { propertyRef, propertyData };
}

async function createProperty(db, userId) {
  const now = new Date().toISOString();
  const propertyData = {
    ownerId: userId,
    title: '',
    address: '',
    city: '',
    neighborhood: '',
    location: '',
    price: 0,
    status: 'available',
    maxInquiries: 10,
    currentInquiries: 0,
    isActive: false,
    deposit: 0,
    features: {
      is_indefinite: true,
    },
    completion: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const responseProperty = {
    ...propertyData,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await db.collection('properties').add(propertyData);
  return json(200, { ok: true, id: docRef.id, property: responseProperty });
}

async function duplicateProperty(db, userId, body) {
  const now = new Date().toISOString();
  const propertyData = sanitizePropertyPayload(body.property);

  await enforcePropertyCountLimit(db, userId);

  propertyData.ownerId = userId;
  propertyData.createdAt = serverTimestamp();
  propertyData.updatedAt = serverTimestamp();
  const responseProperty = {
    ...propertyData,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await db.collection('properties').add(propertyData);
  return json(200, { ok: true, id: docRef.id, property: responseProperty });
}

async function enforcePropertyCountLimit(db, userId) {
  const [providerSnap, propertiesSnap] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('properties').where('ownerId', '==', userId).get(),
  ]);

  const maxProperties = normalizeNumber(providerSnap.data()?.max_properties, 3, 1, 50);
  if (propertiesSnap.size >= maxProperties) {
    throw new Error('Error: Property limit reached.');
  }
}

async function updateProperty(db, userId, isAdminUser, body) {
  const propertyId = normalizeString(body.propertyId, 120);
  const payload = sanitizePropertyPayload(body.property);
  // #region debug-point B:update-request
  await reportPropertyWriteDebug('B', 'property-writes.mjs:updateProperty', 'Received update-property request', { propertyId, userId, isAdminUser, payloadKeys: Object.keys(payload || {}) });
  // #endregion
  const { propertyRef } = await getOwnedProperty(db, propertyId, userId, isAdminUser);

  await propertyRef.update({
    ...payload,
    updatedAt: serverTimestamp(),
  });

  return json(200, { ok: true });
}

async function deleteProperty(db, userId, isAdminUser, body) {
  const propertyId = normalizeString(body.propertyId, 120);
  const { propertyRef } = await getOwnedProperty(db, propertyId, userId, isAdminUser);
  await propertyRef.delete();
  return json(200, { ok: true });
}

async function reactivateProperty(db, userId, isAdminUser, body) {
  const propertyId = normalizeString(body.propertyId, 120);
  const { propertyRef } = await getOwnedProperty(db, propertyId, userId, isAdminUser);

  await propertyRef.update({
    status: 'available',
    updatedAt: serverTimestamp(),
  });

  return json(200, { ok: true });
}

async function increasePropertyLimit(db, userId, isAdminUser, body) {
  const propertyId = normalizeString(body.propertyId, 120);
  const { propertyRef, propertyData } = await getOwnedProperty(db, propertyId, userId, isAdminUser);
  const newMax = Math.min(50, normalizeNumber(propertyData.maxInquiries, 10, 1, 50) + 10);

  await propertyRef.update({
    maxInquiries: newMax,
    status: 'available',
    updatedAt: serverTimestamp(),
  });

  return json(200, { ok: true, maxInquiries: newMax });
}

async function updateAvailability(db, userId, isAdminUser, body) {
  const propertyId = normalizeString(body.propertyId, 120);
  const monthKey = normalizeString(body.monthKey, 20);
  const status = normalizeString(body.status, 40);
  const { propertyRef, propertyData } = await getOwnedProperty(db, propertyId, userId, isAdminUser);

  const nextAvailability = {
    ...(isPlainObject(propertyData.monthlyAvailability) ? propertyData.monthlyAvailability : {}),
    [monthKey]: status,
  };

  await propertyRef.update({
    monthlyAvailability: nextAvailability,
    updatedAt: serverTimestamp(),
  });

  return json(200, { ok: true, monthlyAvailability: nextAvailability });
}

async function batchUpdateAvailability(db, userId, isAdminUser, body) {
  const propertyIds = Array.isArray(body.propertyIds) ? body.propertyIds : [];
  const monthKey = normalizeString(body.monthKey, 20);
  const status = normalizeString(body.status, 40);

  if (propertyIds.length === 0) {
    return json(400, { error: 'Error: No properties selected.' });
  }

  const results = [];
  for (const propertyIdRaw of propertyIds.slice(0, 50)) {
    const propertyId = normalizeString(propertyIdRaw, 120);
    const { propertyRef, propertyData } = await getOwnedProperty(db, propertyId, userId, isAdminUser);
    const nextAvailability = {
      ...(isPlainObject(propertyData.monthlyAvailability) ? propertyData.monthlyAvailability : {}),
      [monthKey]: status,
    };

    await propertyRef.update({
      monthlyAvailability: nextAvailability,
      updatedAt: serverTimestamp(),
    });

    results.push({ propertyId, monthlyAvailability: nextAvailability });
  }

  return json(200, { ok: true, results });
}

async function addHighlightWeek(db, userId, isAdminUser, body) {
  const propertyId = normalizeString(body.propertyId, 120);
  const weekId = normalizeString(body.weekId, 20);
  const { propertyRef, propertyData } = await getOwnedProperty(db, propertyId, userId, isAdminUser);

  const ownerPropertiesSnap = await db.collection('properties').where('ownerId', '==', userId).get();
  const ownerAlreadyHighlighted = ownerPropertiesSnap.docs.some((docSnap) => {
    if (docSnap.id === propertyId) {
      return false;
    }

    const data = docSnap.data() || {};
    return Array.isArray(data.highlightWeeks) && data.highlightWeeks.includes(weekId);
  });

  if (ownerAlreadyHighlighted) {
    throw new Error('Error: You already highlighted a property for this week.');
  }

  const globalHighlightsSnap = await db.collection('properties').where('highlightWeeks', 'array-contains', weekId).get();
  if (globalHighlightsSnap.size >= 10) {
    throw new Error('Error: No weekly highlight spots are available.');
  }

  const currentHighlightWeeks = Array.isArray(propertyData.highlightWeeks) ? propertyData.highlightWeeks : [];
  if (currentHighlightWeeks.includes(weekId)) {
    return json(200, { ok: true, highlightWeeks: currentHighlightWeeks });
  }

  const nextHighlightWeeks = [...currentHighlightWeeks, weekId];

  await propertyRef.update({
    highlightWeeks: nextHighlightWeeks,
    updatedAt: serverTimestamp(),
  });

  return json(200, { ok: true, highlightWeeks: nextHighlightWeeks });
}

export const handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  const postResponse = ensurePost(event);
  if (postResponse) return postResponse;

  return withErrorHandling(async () => {
    const user = await requireUser(event);
    const isAdminUser = hasAdminClaim(user);
    const body = parseBody(event);
    const action = normalizeString(body.action, 60);
    const clientIp = getClientIpFromHeaders(event.headers);
    const db = getDb();

    // #region debug-point C:handler-entry
    await reportPropertyWriteDebug('C', 'property-writes.mjs:handler', 'Entered property-writes handler', { uid: user.uid, email: user.email || null, role: user.role || null, admin: user.admin === true, roles: Array.isArray(user.roles) ? user.roles : null, isAdminUser, action, propertyId: typeof body.propertyId === 'string' ? body.propertyId : null, clientIp });
    // #endregion

    await enforceRateLimit({
      scope: 'property_writes_ip',
      identifier: clientIp,
      maxRequests: 80,
      windowMs: 60 * 60 * 1000,
      errorMessage: 'Error: Too many property write attempts from this network location.',
    });

    await enforceRateLimit({
      scope: 'property_writes_user',
      identifier: `${user.uid}:${action}`,
      maxRequests: 60,
      windowMs: 10 * 60 * 1000,
      errorMessage: 'Error: Too many property write attempts. Please wait before trying again.',
    });

    if (action === 'create-property') return createProperty(db, user.uid);
    if (action === 'duplicate-property') return duplicateProperty(db, user.uid, body);
    if (action === 'update-property') return updateProperty(db, user.uid, isAdminUser, body);
    if (action === 'delete-property') return deleteProperty(db, user.uid, isAdminUser, body);
    if (action === 'reactivate-property') return reactivateProperty(db, user.uid, isAdminUser, body);
    if (action === 'increase-property-limit') return increasePropertyLimit(db, user.uid, isAdminUser, body);
    if (action === 'update-availability') return updateAvailability(db, user.uid, isAdminUser, body);
    if (action === 'batch-update-availability') return batchUpdateAvailability(db, user.uid, isAdminUser, body);
    if (action === 'add-highlight-week') return addHighlightWeek(db, user.uid, isAdminUser, body);

    return json(400, { error: 'Error: Invalid property write action.' });
  });
};
