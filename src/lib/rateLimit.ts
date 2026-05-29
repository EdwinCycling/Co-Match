export const checkRateLimit = (action: string, maxRequests: number, timeWindowMs: number): boolean => {
  const now = Date.now();
  const storageKey = `rate_limit_${action}`;
  
  let records: number[] = [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      records = JSON.parse(raw);
    }
  } catch (e) {
    // Ignore parse error
  }

  // Filter valid timestamps
  records = records.filter(timestamp => now - timestamp < timeWindowMs);

  if (records.length >= maxRequests) {
    return false; // Rate limit exceeded
  }

  // Add new request
  records.push(now);
  localStorage.setItem(storageKey, JSON.stringify(records));
  return true;
};
