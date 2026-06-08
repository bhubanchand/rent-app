type RateLimitEntry = {
  count: number;
  resetTime: number;
};

const rateLimitMap = new Map<string, RateLimitEntry>();

export function rateLimit(
  ip: string,
  limit = 5,
  windowMs = 60000
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: limit - 1, reset: now + windowMs };
  }

  if (now > entry.resetTime) {
    entry.count = 1;
    entry.resetTime = now + windowMs;
    return { success: true, remaining: limit - 1, reset: entry.resetTime };
  }

  entry.count += 1;
  const remaining = Math.max(0, limit - entry.count);
  const success = entry.count <= limit;

  return { success, remaining, reset: entry.resetTime };
}
