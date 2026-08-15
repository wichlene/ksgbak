import * as cheerio from "cheerio";
import { fetchHtml } from "./http";
import { extractJsonBlobs, findPriceHistoryArray } from "./extract-json";
import { pickBestMatch, type LinkCandidate } from "./match";
import type { PriceHistoryResult } from "./types";

const SEARCH_URL = "https://www.akakce.com/arama/?q=";

/**
 * akakce.com'da ürünü isme göre arar. cimri.ts'deki ile aynı genel yaklaşım:
 * ürün linkine benzeyen href'leri toplayıp isimle en çok örtüşeni seç.
 */
async function findAkakceProductUrl(productName: string): Promise<string | null> {
  const html = await fetchHtml(SEARCH_URL + encodeURIComponent(productName));
  const $ = cheerio.load(html);

  const candidates: LinkCandidate[] = $("a[href]")
    .toArray()
    .map((el) => ({
      href: $(el).attr("href") || "",
      text: $(el).text().trim(),
    }))
    .filter((a) => a.href && /,\d+\.html|-fiyati/i.test(a.href));

  const best = pickBestMatch(productName, candidates);
  if (!best) return null;

  return best.href.startsWith("http")
    ? best.href
    : `https://www.akakce.com${best.href}`;
}

/**
 * akakce.com ürün sayfasından fiyat geçmişini çeker. cimri bulunamadığında
 * fallback olarak kullanılır; o da bulamazsa çağıran taraf "internal" tracking'e düşer.
 */
export async function scrapeAkakcePriceHistory(
  productName: string
): Promise<PriceHistoryResult | null> {
  const productUrl = await findAkakceProductUrl(productName);
  if (!productUrl) return null;

  const html = await fetchHtml(productUrl);
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

function normalizeDate(raw: string): string {
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}
