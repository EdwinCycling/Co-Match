const SAFE_URL_PATTERN = /^(https?:\/\/|data:image\/)/i;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeUrl(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!SAFE_URL_PATTERN.test(trimmed)) {
    return '';
  }

  return escapeHtml(trimmed);
}
