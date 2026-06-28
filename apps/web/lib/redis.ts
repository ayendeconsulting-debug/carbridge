import { Redis } from "@upstash/redis";

// Needs the REST credentials (UPSTASH_REDIS_REST_URL + _TOKEN), not the
// redis:// TCP string. Returns null if unconfigured so the FX layer can fall
// back to the database without crashing.
let client: Redis | null = null;

export function getRedis(): Redis | null {
  if (client) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  client = new Redis({ url, token });
  return client;
}

export const FX_CACHE_KEY = "fx:CAD_NGN:current";
