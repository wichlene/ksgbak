import * as cheerio from "cheerio";
import { fetchHtml, type ScraperOptions } from "./http";
import { extractJsonBlobs, findPriceHistoryArray } from "./extract-json";
import { pickBestMatch, type LinkCandidate } from "./match";
import type { PriceHistoryResult } from "./types";

const SEARCH_URL = "https://www.akakce.com/arama/?q=";

// Ölçüm: akakce'ye ScraperAPI premium (residential) proxy ile ~4sn'de
// ulaşılıyor, normal proxy ile ~17sn. cimri.com ise her iki ayarda da
// HTTP 500 veriyor, bu yüzden akakce birincil kaynak.
const AKAKCE_FETCH_OPTIONS: ScraperOptions = {
  premium: true,
  timeoutMs: 20_000,
};

/**
 * akakce.com'da ürünü isme göre arar; ürün linkine benzeyen href'leri toplayıp
 * isimle en çok kelime örtüşeni seçer.
 * Ürün linkleri şu biçimde: /cep-telefonu/en-ucuz-iphone-15-128-gb-siyah-fiyati,282674948.html
 */
async function findAkakceProductUrl(productName: string): Promise<string | null> {
  const html = await fetchHtml(
    SEARCH_URL + encodeURIComponent(productName),
    AKAKCE_FETCH_OPTIONS
  );
  const $ = cheerio.load(html);

  const candidates: LinkCandidate[] = $("a[href]")
    .toArray()
    .map((el) => ({
      href: $(el).attr("href") || "",
      text: $(el).text().trim(),
    }))
    .filter((a) => a.href && /,\d+\.html/i.test(a.href));

  const best = pickBestMatch(productName, candidates);
  if (!best) return null;

  return best.href.startsWith("http")
    ? best.href
    : `https://www.akakce.com${best.href}`;
}

/**
 * akakce.com ürün sayfasından fiyat geçmişini çeker.
 * Bulunamazsa null döner; çağıran taraf cimri'ye, o da olmazsa kendi
 * "internal" takibimize düşer.
 */
export async function scrapeAkakcePriceHistory(
  productName: string
): Promise<PriceHistoryResult | null> {
  const productUrl = await findAkakceProductUrl(productName);
  if (!productUrl) return null;

  const html = await fetchHtml(productUrl, AKAKCE_FETCH_OPTIONS);

  const points = extractAkakceHistory(html);
  if (points.length > 0) {
    return { source: "akakce", sourceUrl: productUrl, points };
  }

  // Genel JSON deep-search fallback'i
  const blobs = extractJsonBlobs(html);
  for (const blob of blobs) {
    const raw = findPriceHistoryArray(blob);
    if (raw && raw.length > 0) {
      return {
        source: "akakce",
        sourceUrl: productUrl,
        points: raw
          .map((p) => ({ price: p.price, recordedAt: normalizeDate(p.date) }))
          .filter((p) => Number.isFinite(p.price)),
      };
    }
  }

  return null;
}

/**
 * akakce fiyat grafiğinin verisini sayfadaki inline script'lerden çıkarır.
 * Grafik verisi genelde [[timestamp, fiyat], ...] biçiminde bir dizi olarak
 * gömülü oluyor; timestamp saniye ya da milisaniye cinsinden olabiliyor.
 */
export function extractAkakceHistory(
  html: string
): Array<{ price: number; recordedAt: string }> {
  const pairArrayMatches = html.match(
    /\[\s*\[\s*\d{9,13}\s*,\s*[\d.]+\s*\](?:\s*,\s*\[\s*\d{9,13}\s*,\s*[\d.]+\s*\])*\s*\]/g
  );
  if (!pairArrayMatches) return [];

  // En çok noktası olan diziyi seç (fiyat geçmişi grafiği en uzunudur)
  let bestPoints: Array<{ price: number; recordedAt: string }> = [];

  for (const raw of pairArrayMatches) {
    try {
      const parsed = JSON.parse(raw) as Array<[number, number]>;
      const points = parsed
        .map(([ts, price]) => ({
          price,
          recordedAt: new Date(ts < 1e12 ? ts * 1000 : ts).toISOString(),
        }))
        .filter((p) => Number.isFinite(p.price) && p.price > 0);

      if (points.length > bestPoints.length) bestPoints = points;
    } catch {
      // parse edilemeyen diziyi yoksay
    }
  }

  return bestPoints;
}

function normalizeDate(raw: string): string {
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}
