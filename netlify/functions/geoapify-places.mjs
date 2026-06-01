import { enforceRateLimit, ensurePost, getGeoapifyApiKey, handleOptions, json, parseBody, requireUser, withErrorHandling } from './_shared.mjs';

export const handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  const postResponse = ensurePost(event);
  if (postResponse) return postResponse;

  return withErrorHandling(async () => {
    const user = await requireUser(event);
    await enforceRateLimit({
      scope: 'geoapify-places',
      identifier: user.uid,
      maxRequests: 30,
      windowMs: 60 * 1000,
      errorMessage: 'Error: Too many place search requests. Please try again in a minute.',
    });
    const { categories, lon, lat, radius, limit = 10, bias } = parseBody(event);

    if (!categories || typeof lon !== 'number' || typeof lat !== 'number' || typeof radius !== 'number') {
      return json(400, { error: 'Error: Missing or invalid location input.' });
    }

    const params = new URLSearchParams({
      categories,
      filter: `circle:${lon},${lat},${radius}`,
      limit: String(limit),
      apiKey: getGeoapifyApiKey(),
    });

    if (bias) {
      params.set('bias', bias);
    }

    const response = await fetch(`https://api.geoapify.com/v2/places?${params.toString()}`);
    if (!response.ok) {
      return json(response.status, { error: 'Error: Failed to fetch places from Geoapify.' });
    }

    return json(200, await response.json());
  });
};
