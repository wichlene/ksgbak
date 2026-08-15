import * as cheerio from "cheerio";
import { fetchHtml } from "./http";
import { extractJsonBlobs, findPriceHistoryArray } from "./extract-json";
import { pickBestMatch, type LinkCandidate } from "./match";
import type { PriceHistoryResult } from "./types";

const SEARCH_URL = "https://www.cimri.com/arama?q=";

/**
 * cimri.com'da ürünü isme göre arar, en alakalı ürün linkini döner.
 * Tam CSS class isimleri site güncellemeleriyle değişebileceği için exact
 * selector yerine "ürün linkine benzeyen" href'leri (…-p12345 formatı) toplayıp
 * en çok kelime örtüşen sonucu seçen genel bir yaklaşım kullanılıyor.
 */
async function findCimriProductUrl(productName: string): Promise<string | null> {
  const html = await fetchHtml(SEARCH_URL + encodeURIComponent(productName));
  const $ = cheerio.load(html);

  const candidates: LinkCandidate[] = $("a[href]")
    .toArray()
    .map((el) => ({
      href: $(el).attr("href") || "",
      text: $(el).text().trim(),
    }))
    .filter((a) => a.href && /-p-?\d+/i.test(a.href));

  const best = pickBestMatch(productName, candidates);
  if (!best) return null;

  return best.href.startsWith("http")
    ? best.href
    : `https://www.cimri.com${best.href}`;
}

/**
 * cimri.com ürün sayfasından fiyat geçmişini çeker. Sayfaya gömülü JSON state
 * içinde {fiyat, tarih} çiftlerinden oluşan bir dizi aranır (bkz. extract-json.ts).
 * Site yapısı gereği bulunamayabilir; bu durumda null döner ve çağıran taraf
 * akakce.com'a düşer.
 */
export async function scrapeCimriPriceHistory(
  productName: string
): Promise<PriceHistoryResult | null> {
  const productUrl = await findCimriProductUrl(productName);
  if (!productUrl) return null;

  const html = await fetchHtml(productUrl);
  const blobs = extractJsonBlobs(html);

  for (const blob of blobs) {
    const raw = findPriceHistoryArray(blob);
    if (raw && raw.length > 0) {
      return {
        source: "cimri",
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
