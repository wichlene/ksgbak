import { Redis } from "@upstash/redis";

let client: Redis | null = null;

/**
 * Upstash Redis client'ı lazy singleton olarak oluşturur. Env değişkenleri
 * eksikse (örn. henüz kurulmadıysa) null döner ki caller cache'siz devam edebilsin.
 */
export function getRedis(): Redis | null {
  if (client) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  client = new Redis({ url, token });
  return client;
}
