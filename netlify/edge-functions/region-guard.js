import {
  REGION_RESTRICTION_STATUS,
  buildRegionalRestrictionBody,
  buildRegionalRestrictionHtml,
  getBlockCategory,
  isBlockedCountryCode,
  isFunctionPath,
  normalizeCountryCode,
} from '../../shared/regionBlockConfig.mjs';

function buildHeaders(contentType) {
  return {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
  };
}

export default async function regionGuard(request, context) {
  const pathname = new URL(request.url).pathname;
  const countryCode = normalizeCountryCode(context.geo?.country?.code);

  if (!isBlockedCountryCode(countryCode)) {
    return context.next();
  }

  console.warn('[security][region-blocked]', JSON.stringify({
    countryCode,
    category: getBlockCategory(countryCode),
    ip: context.ip || 'unknown',
    pathname,
    requestId: context.requestId || 'unknown',
  }));

  if (isFunctionPath(pathname)) {
    return new Response(JSON.stringify(buildRegionalRestrictionBody()), {
      status: REGION_RESTRICTION_STATUS,
      headers: buildHeaders('application/json; charset=utf-8'),
    });
  }

  return new Response(buildRegionalRestrictionHtml(), {
    status: REGION_RESTRICTION_STATUS,
    headers: buildHeaders('text/html; charset=utf-8'),
  });
}

export const config = {
  path: '/*',
};
