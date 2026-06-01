import {
  enforceRateLimit,
  ensurePost,
  getDb,
  handleOptions,
  json,
  parseBody,
  requireUser,
  serverTimestamp,
  syncPublicProfile,
  withErrorHandling,
} from './_shared.mjs';
import { getClientIpFromHeaders } from '../../shared/regionBlockConfig.mjs';

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeString(value, maxLength = 1000) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLength);
}

function normalizeOptionalString(value, maxLength = 1000) {
  if (typeof value !== 'string') {
    return undefined;
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

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  return fallback;
}

function normalizeStringArray(value, maxItems = 20, maxItemLength = 120) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim().slice(0, maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeRecord(value) {
  return isPlainObject(value) ? value : {};
}

function sanitizePreferences(value) {
  const base = sanitizeRecord(value);

  return {
    area_private: normalizeNumber(base.area_private, 0, 0, 10000),
    bedrooms: normalizeNumber(base.bedrooms, 1, 0, 50),
    furnished: normalizeString(base.furnished || 'either', 50),
    sanitary: sanitizeRecord(base.sanitary),
    entrance: sanitizeRecord(base.entrance),
    kitchen: sanitizeRecord(base.kitchen),
    laundry: sanitizeRecord(base.laundry),
    heating: sanitizeRecord(base.heating),
    internet: sanitizeRecord(base.internet),
    outdoor: sanitizeRecord(base.outdoor),
    safety: sanitizeRecord(base.safety),
    parking: sanitizeRecord(base.parking),
    pets: sanitizeRecord(base.pets),
    surroundings: sanitizeRecord(base.surroundings),
    street: sanitizeRecord(base.street),
    modifications: sanitizeRecord(base.modifications),
    tenant_prefs: sanitizeRecord(base.tenant_prefs),
  };
}

function sanitizeComposition(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => isPlainObject(item))
    .slice(0, 20)
    .map((item) => ({
      gender: normalizeString(item.gender, 50),
      age: normalizeNumber(item.age, 0, 0, 120),
    }));
}

function sanitizeSeekerProfile(payload, uid, language, theme, unit) {
  const profile = isPlainObject(payload) ? payload : {};

  return {
    uid,
    nickname: normalizeString(profile.nickname, 100),
    introduction: normalizeString(profile.introduction, 5000),
    photo_url: normalizeString(profile.photo_url, 2000),
    lat: normalizeNumber(profile.lat, 52.3676, -90, 90),
    lng: normalizeNumber(profile.lng, 4.9041, -180, 180),
    radius: normalizeNumber(profile.radius, 10, 0, 500),
    goal: normalizeStringArray(profile.goal),
    property_type: normalizeStringArray(profile.property_type),
    country: normalizeString(profile.country, 100),
    city: normalizeString(profile.city, 100),
    preferredLanguage: normalizeString(profile.preferredLanguage, 50),
    available_from: normalizeString(profile.available_from, 50),
    stay_duration_months: normalizeNumber(profile.stay_duration_months, 0, 0, 600),
    is_indefinite: normalizeBoolean(profile.is_indefinite, true),
    budget_min: normalizeNumber(profile.budget_min, 0, 0, 99999999),
    budget_max: normalizeNumber(profile.budget_max, 9999999, 0, 99999999),
    single_occupancy: normalizeBoolean(profile.single_occupancy, true),
    min_roommates: normalizeNumber(profile.min_roommates, 0, 0, 100),
    max_roommates: normalizeNumber(profile.max_roommates, 0, 0, 100),
    composition: sanitizeComposition(profile.composition),
    vacation_pool: normalizeOptionalString(profile.vacation_pool, 20) || 'no',
    vacation_outdoor_kitchen: normalizeOptionalString(profile.vacation_outdoor_kitchen, 20) || 'no',
    vacation_resort: normalizeOptionalString(profile.vacation_resort, 20) || 'no',
    vacation_sauna: normalizeOptionalString(profile.vacation_sauna, 20) || 'no',
    vacation_beach_dist: profile.vacation_beach_dist === '' ? '' : normalizeNumber(profile.vacation_beach_dist, 0, 0, 100000),
    vacation_airport_dist: profile.vacation_airport_dist === '' ? '' : normalizeNumber(profile.vacation_airport_dist, 0, 0, 100000),
    vacation_breakfast: normalizeBoolean(profile.vacation_breakfast, false),
    vacation_lunch: normalizeBoolean(profile.vacation_lunch, false),
    vacation_dinner: normalizeBoolean(profile.vacation_dinner, false),
    has_completed_minimal: normalizeBoolean(profile.has_completed_minimal, false),
    has_completed_extended: normalizeBoolean(profile.has_completed_extended, false),
    extended_completion_percentage: normalizeNumber(profile.extended_completion_percentage, 0, 0, 100),
    preferences: sanitizePreferences(profile.preferences),
    language: normalizeString(language, 20),
    theme: normalizeString(theme, 30),
    unit: normalizeString(unit, 30),
    updatedAt: serverTimestamp(),
  };
}

function sanitizeProviderProfile(payload) {
  const profile = isPlainObject(payload) ? payload : {};

  return {
    firstName: normalizeString(profile.firstName, 100),
    lastName: normalizeString(profile.lastName, 100),
    phone: normalizeString(profile.phone, 50),
    email2: normalizeString(profile.email2, 254),
    description: normalizeString(profile.description, 10000),
    country: normalizeString(profile.country, 100),
    preferredLanguage: normalizeString(profile.preferredLanguage, 50),
    photoUrl: normalizeString(profile.photoUrl, 2000),
    updatedAt: serverTimestamp(),
  };
}

function uniqueStringArray(...lists) {
  return [...new Set(lists.flat().filter((item) => typeof item === 'string' && item.trim()))];
}

async function getSeekerProfileRef(db, userId) {
  const seekerProfileRef = db.collection('seeker_profiles').doc(userId);
  const seekerProfileSnap = await seekerProfileRef.get();
  const seekerProfileData = seekerProfileSnap.exists ? seekerProfileSnap.data() || {} : {};

  return { seekerProfileRef, seekerProfileData };
}

async function toggleSeekerFavorite(db, user, body) {
  const propertyId = normalizeString(body.propertyId, 120);
  const shouldFavorite = normalizeBoolean(body.shouldFavorite, true);
  const { seekerProfileRef, seekerProfileData } = await getSeekerProfileRef(db, user.uid);
  const currentFavorites = Array.isArray(seekerProfileData.favorites) ? seekerProfileData.favorites : [];
  const nextFavorites = shouldFavorite
    ? uniqueStringArray(currentFavorites, [propertyId])
    : currentFavorites.filter((favoriteId) => favoriteId !== propertyId);

  await seekerProfileRef.set({
    favorites: nextFavorites,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return json(200, { ok: true, favorites: nextFavorites });
}

async function grantSeekerAccess(db, user, body) {
  const propertyId = normalizeString(body.propertyId, 120);
  const favorite = normalizeBoolean(body.favorite, false);
  const unlockChat = normalizeBoolean(body.unlockChat, false);
  const unlockDetails = normalizeBoolean(body.unlockDetails, false);
  const unlockMatch = normalizeBoolean(body.unlockMatch, false);
  const unlockAllOptions = normalizeBoolean(body.unlockAllOptions, false);
  const { seekerProfileRef, seekerProfileData } = await getSeekerProfileRef(db, user.uid);

  const currentFavorites = Array.isArray(seekerProfileData.favorites) ? seekerProfileData.favorites : [];
  const currentUnlockedChats = Array.isArray(seekerProfileData.unlocked_chats) ? seekerProfileData.unlocked_chats : [];
  const currentUnlockedDetails = Array.isArray(seekerProfileData.unlocked_details) ? seekerProfileData.unlocked_details : [];
  const currentUnlockedMatches = Array.isArray(seekerProfileData.unlocked_matches) ? seekerProfileData.unlocked_matches : [];
  const currentUnlockedAllOptions = Array.isArray(seekerProfileData.unlocked_all_options) ? seekerProfileData.unlocked_all_options : [];

  const nextFavorites = favorite ? uniqueStringArray(currentFavorites, [propertyId]) : currentFavorites;
  const nextUnlockedChats = unlockChat ? uniqueStringArray(currentUnlockedChats, [propertyId]) : currentUnlockedChats;
  const nextUnlockedDetails = (unlockDetails || unlockAllOptions)
    ? uniqueStringArray(currentUnlockedDetails, [propertyId])
    : currentUnlockedDetails;
  const nextUnlockedMatches = (unlockMatch || unlockAllOptions)
    ? uniqueStringArray(currentUnlockedMatches, [propertyId])
    : currentUnlockedMatches;
  const nextUnlockedAllOptions = unlockAllOptions
    ? uniqueStringArray(currentUnlockedAllOptions, [propertyId])
    : currentUnlockedAllOptions;

  await seekerProfileRef.set({
    favorites: nextFavorites,
    unlocked_chats: nextUnlockedChats,
    unlocked_details: nextUnlockedDetails,
    unlocked_matches: nextUnlockedMatches,
    unlocked_all_options: nextUnlockedAllOptions,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return json(200, {
    ok: true,
    favorites: nextFavorites,
    unlocked_chats: nextUnlockedChats,
    unlocked_details: nextUnlockedDetails,
    unlocked_matches: nextUnlockedMatches,
    unlocked_all_options: nextUnlockedAllOptions,
  });
}

async function updateSeekerLocation(db, user, body) {
  const city = normalizeString(body.city, 100);
  const country = normalizeString(body.country, 100);

  await db.collection('seeker_profiles').doc(user.uid).set({
    city,
    country,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return json(200, { ok: true, city, country });
}

async function saveSeekerCha(db, user, body) {
  const harmonyIndex = normalizeNumber(body.harmonyIndex, 80, 0, 100);
  const harmonyAnswers = isPlainObject(body.harmonyAnswers) ? body.harmonyAnswers : {};

  await db.collection('seeker_profiles').doc(user.uid).set({
    harmony_index: harmonyIndex,
    harmony_answers: harmonyAnswers,
    has_completed_cha: true,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return json(200, { ok: true, harmony_index: harmonyIndex, has_completed_cha: true });
}

async function saveSeekerProfile(db, user, body) {
  const profile = sanitizeSeekerProfile(
    body.profile,
    user.uid,
    body.language,
    body.theme,
    body.unit
  );

  await db.collection('seeker_profiles').doc(user.uid).set(profile, { merge: true });
  await db.collection('users').doc(user.uid).set({
    hasProfile: true,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await syncPublicProfile(db, user.uid);

  return json(200, { ok: true });
}

async function saveProviderProfile(db, user, body) {
  const providerRef = db.collection('providers').doc(user.uid);
  const existingSnap = await providerRef.get();
  const existingData = existingSnap.exists ? existingSnap.data() || {} : {};
  const profile = sanitizeProviderProfile(body.profile);

  await providerRef.set({
    ...profile,
    createdAt: existingData.createdAt || serverTimestamp(),
  }, { merge: true });
  await syncPublicProfile(db, user.uid);

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
    const action = normalizeString(body.action, 50);
    const clientIp = getClientIpFromHeaders(event.headers);
    const db = getDb();

    await enforceRateLimit({
      scope: 'profile_writes_ip',
      identifier: clientIp,
      maxRequests: 60,
      windowMs: 60 * 60 * 1000,
      errorMessage: 'Error: Too many profile save attempts from this network location.',
    });

    await enforceRateLimit({
      scope: 'profile_writes_user',
      identifier: `${user.uid}:${action}`,
      maxRequests: action === 'save-seeker-profile' ? 30 : 20,
      windowMs: 10 * 60 * 1000,
      errorMessage: 'Error: Too many profile save attempts. Please wait before trying again.',
    });

    if (action === 'save-seeker-profile') {
      return saveSeekerProfile(db, user, body);
    }

    if (action === 'save-provider-profile') {
      return saveProviderProfile(db, user, body);
    }

    if (action === 'toggle-seeker-favorite') {
      return toggleSeekerFavorite(db, user, body);
    }

    if (action === 'grant-seeker-access') {
      return grantSeekerAccess(db, user, body);
    }

    if (action === 'update-seeker-location') {
      return updateSeekerLocation(db, user, body);
    }

    if (action === 'save-seeker-cha') {
      return saveSeekerCha(db, user, body);
    }

    return json(400, { error: 'Error: Invalid profile write action.' });
  });
};
