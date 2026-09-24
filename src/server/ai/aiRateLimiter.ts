/**
 * AI Rate Limiter & Concurrency Manager
 * Implements in-memory sliding window rate limiting per IP, User, and Tenant.
 */

interface RateLimitBucket {
  timestamps: number[];
}

const ipBuckets = new Map<string, RateLimitBucket>();
const userBuckets = new Map<string, RateLimitBucket>();
const tenantBuckets = new Map<string, RateLimitBucket>();

// Default Rate Limits
export const DEFAULT_RATE_LIMITS = {
  ipMaxPerMinute: 40,
  userMaxPerMinute: 60,
  tenantMaxPerMinute: 300,
  windowMs: 60 * 1000,
};

function checkAndConsume(
  map: Map<string, RateLimitBucket>,
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; currentCount: number; retryAfterSec: number } {
  const now = Date.now();
  let bucket = map.get(key);

  if (!bucket) {
    bucket = { timestamps: [] };
    map.set(key, bucket);
  }

  // Filter timestamps within sliding window
  const threshold = now - windowMs;
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > threshold);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0] || now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      allowed: false,
      currentCount: bucket.timestamps.length,
      retryAfterSec,
    };
  }

  bucket.timestamps.push(now);
  return {
    allowed: true,
    currentCount: bucket.timestamps.length,
    retryAfterSec: 0,
  };
}

export interface RateLimitCheckParams {
  ipAddress?: string | null;
  userId?: string | null;
  tenantId?: string | null;
  customLimits?: {
    ipMaxPerMinute?: number;
    userMaxPerMinute?: number;
    tenantMaxPerMinute?: number;
  };
}

export interface RateLimitResult {
  allowed: boolean;
  limitType?: 'IP' | 'USER' | 'TENANT';
  retryAfterSec?: number;
  message?: string;
}

/**
 * Enforce rate limits across IP, User, and Tenant
 */
export function checkRateLimits(params: RateLimitCheckParams): RateLimitResult {
  const windowMs = DEFAULT_RATE_LIMITS.windowMs;

  // 1. IP Check
  if (params.ipAddress) {
    const ipLimit = params.customLimits?.ipMaxPerMinute || DEFAULT_RATE_LIMITS.ipMaxPerMinute;
    const res = checkAndConsume(ipBuckets, params.ipAddress, ipLimit, windowMs);
    if (!res.allowed) {
      return {
        allowed: false,
        limitType: 'IP',
        retryAfterSec: res.retryAfterSec,
        message: `Tần suất yêu cầu từ IP của bạn đã vượt giới hạn (${ipLimit} lượt/phút). Vui lòng thử lại sau ${res.retryAfterSec} giây.`,
      };
    }
  }

  // 2. User Check
  if (params.userId && params.userId !== 'guest' && params.userId !== 'guest_learner') {
    const userLimit = params.customLimits?.userMaxPerMinute || DEFAULT_RATE_LIMITS.userMaxPerMinute;
    const res = checkAndConsume(userBuckets, params.userId, userLimit, windowMs);
    if (!res.allowed) {
      return {
        allowed: false,
        limitType: 'USER',
        retryAfterSec: res.retryAfterSec,
        message: `Tài khoản của bạn đã gửi quá nhiều yêu cầu (${userLimit} lượt/phút). Vui lòng thử lại sau ${res.retryAfterSec} giây.`,
      };
    }
  }

  // 3. Tenant Check
  const tenant = params.tenantId || 'default';
  const tenantLimit = params.customLimits?.tenantMaxPerMinute || DEFAULT_RATE_LIMITS.tenantMaxPerMinute;
  const tRes = checkAndConsume(tenantBuckets, tenant, tenantLimit, windowMs);
  if (!tRes.allowed) {
    return {
      allowed: false,
      limitType: 'TENANT',
      retryAfterSec: tRes.retryAfterSec,
      message: `Hệ thống tổ chức (Tenant) đã đạt hạn mức tối đa (${tenantLimit} lượt/phút). Vui lòng thử lại sau ${tRes.retryAfterSec} giây.`,
    };
  }

  return { allowed: true };
}
