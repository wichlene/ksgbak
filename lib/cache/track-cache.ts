import { getRedis } from "./redis";
import { parseTrendyolProductId } from "@/lib/scraper/trendyol";
import type { TrackResult } from "@/lib/scraper";

const TTL_SECONDS = 60 * 60; // aynı ürün 1 saatte 1 kez scrape edilsin

/**
 * Aynı ürün için farklı query string'lerle gelen linkler (?boutiqueId=... vb.)
 * aynı cache key'ine düşsün diye Trendyol ürün ID'sini anahtar olarak kullanır.
 * ID bulunamazsa host+path'e düşer.
 */
export function resolveProductCacheKey(trendyolUrl: string): string {
  const id = parseTrendyolProductId(trendyolUrl);
  if (id) return id;

  try {
    const u = new URL(trendyolUrl);
    return `${u.hostname}${u.pathname}`.toLowerCase();
  } catch {
    return trendyolUrl.toLowerCase();
  }
}

function cacheKey(productKey: string): string {
  return `track:${productKey}`;
}

/**
 * Redis kurulu değilse (env eksikse) sessizce null döner, cache olmadan devam edilir.
 */
export async function getCachedTrackResult(
  productKey: string
): Promise<TrackResult | null> {
  const redis = getRedis();
  if (!redis) return null;

  const cached = await redis.get<TrackResult>(cacheKey(productKey));
  return cached ?? null;
}

export async function setCachedTrackResult(
  productKey: string,
  result: TrackResult
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  await redis.set(cacheKey(productKey), result, { ex: TTL_SECONDS });
}
