import { Redis } from '@upstash/redis';

// Lazy-init to avoid warnings when KV credentials aren't configured (local dev without KV)
let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (!url || !token) {
      throw new Error('KV not configured: set KV_REST_API_URL and KV_REST_API_TOKEN');
    }
    _redis = new Redis({ url, token });
  }
  return _redis;
}

export const KV_KEYS = {
  customers: 'arr-forecast:customers',
  importHistory: 'arr-forecast:import-history',
} as const;
