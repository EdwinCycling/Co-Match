const SANCTIONED_COUNTRY_CODES = ['RU', 'BY', 'IR', 'KP', 'SY', 'CU'];
const HIGH_RISK_COUNTRY_CODES = ['NG', 'CM', 'GH', 'IN', 'PK', 'BD', 'PH'];

export const BLOCKED_COUNTRY_CODES = [...new Set([
  ...SANCTIONED_COUNTRY_CODES,
  ...HIGH_RISK_COUNTRY_CODES,
])];

export const BLOCKED_COUNTRY_SET = new Set(BLOCKED_COUNTRY_CODES);

export const REGION_RESTRICTION_MESSAGE = 'Onze diensten zijn momenteel niet beschikbaar in jouw regio.';
export const REGION_RESTRICTION_API_MESSAGE = 'Access denied due to regional restrictions.';
export const REGION_RESTRICTION_ERROR = 'forbidden';
export const REGION_RESTRICTION_STATUS = 403;

export function normalizeCountryCode(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toUpperCase();
}

export function getBlockCategory(countryCode) {
  const normalized = normalizeCountryCode(countryCode);

  if (SANCTIONED_COUNTRY_CODES.includes(normalized)) {
    return 'sanctions';
  }

  if (HIGH_RISK_COUNTRY_CODES.includes(normalized)) {
    return 'fraud';
  }

  return null;
}

export function isBlockedCountryCode(countryCode) {
  return BLOCKED_COUNTRY_SET.has(normalizeCountryCode(countryCode));
}

export function buildRegionalRestrictionBody() {
  return {
    error: REGION_RESTRICTION_ERROR,
    message: REGION_RESTRICTION_API_MESSAGE,
    code: REGION_RESTRICTION_STATUS,
  };
}

export function buildRegionalRestrictionHtml() {
  const title = 'Access Denied';
  const heading = 'Toegang geweigerd';
  const message = 'Deze applicatie is niet beschikbaar vanaf jouw huidige netwerklocatie.';

  return `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        font-family: Inter, Arial, sans-serif;
        background: #f6f3ee;
        color: #1f2937;
      }

      main {
        width: 100%;
        max-width: 560px;
        background: #ffffff;
        border: 1px solid rgba(31, 41, 55, 0.08);
        border-radius: 24px;
        padding: 32px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
        text-align: center;
      }

      h1 {
        margin: 0 0 16px;
        font-size: 32px;
        line-height: 1.1;
      }

      p {
        margin: 0;
        font-size: 16px;
        line-height: 1.6;
        color: #4b5563;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${heading}</h1>
      <p>${message}</p>
    </main>
  </body>
</html>`;
}

export function getClientIpFromHeaders(headers) {
  const forwardedFor = headers?.['x-forwarded-for'] || headers?.['X-Forwarded-For'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
    return forwardedFor.split(',')[0].trim();
  }

  const directIp = headers?.['x-nf-client-connection-ip']
    || headers?.['X-Nf-Client-Connection-Ip']
    || headers?.['client-ip']
    || headers?.['Client-Ip'];

  if (typeof directIp === 'string') {
    return directIp.trim();
  }

  return 'unknown';
}

export function getCountryCodeFromHeaders(headers) {
  return normalizeCountryCode(
    headers?.['x-country']
      || headers?.['X-Country']
      || headers?.['cf-ipcountry']
      || headers?.['CF-IPCountry']
      || headers?.['x-geo-country']
      || headers?.['X-Geo-Country']
  );
}

export function isFunctionPath(pathname) {
  return typeof pathname === 'string' && pathname.startsWith('/.netlify/functions/');
}
