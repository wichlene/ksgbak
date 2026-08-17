import * as cheerio from "cheerio";
import { fetchHtml, type ScraperOptions } from "./http";
import { pickBestMatch, type LinkCandidate } from "./match";
import type { PriceHistoryResult, ScrapedPricePoint } from "./types";

const SEARCH_URL = "https://www.akakce.com/arama/?q=";

// Ölçüm: akakce'ye ScraperAPI premium (residential) proxy ile ~2-4sn'de
// ulaşılıyor. cimri.com ise her ayarda HTTP 500 verdiği için akakce birincil
// kaynak.
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
 * akakce ürün sayfası, sayfa verisini HTML attribute'ları içinde
 * &quot;-escape edilmiş JSON olarak taşıyor. İlgili alanlar:
 *   "lowestPrice1M":[0,44792.61]        -> son 1 ayın en düşük fiyatı
 *   "lowestPriceDate1M":[0,"2026-07-21T00:00:00"]
 *   "minOfSortPrice":[0,48299]          -> şu anki en düşük satıcı fiyatı
 * Değerler Astro'nun [0, value] sarmalı içinde geliyor.
 */
function readNumberField(text: string, field: string): number | null {
  const m = text.match(new RegExp(`"${field}"\\s*:\\s*\\[\\s*0\\s*,\\s*([\\d.]+)\\s*\\]`));
  if (!m) return null;
  const value = parseFloat(m[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function readDateField(text: string, field: string): string | null {
  const m = text.match(new RegExp(`"${field}"\\s*:\\s*\\[\\s*0\\s*,\\s*"([^"]+)"\\s*\\]`));
  if (!m) return null;
  const parsed = new Date(m[1]);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Bir akakce ürün sayfası HTML'inden en düşük satıcı fiyatını çıkarır.
 *
 * archive.org'daki eski akakce kopyalarında da kullanıldığı için sayfa yapısının
 * yıllar içindeki farklı sürümlerini sırayla dener: güncel gömülü JSON, eski
 * JSON biçimi, schema.org meta alanları ve son çare olarak açıklama metnindeki
 * "... fiyatları 48.299,00 TL'den başlayan" kalıbı.
 */
export function extractAkakcePriceFromHtml(rawHtml: string): number | null {
  const text = rawHtml.replace(/&quot;/g, '"').replace(/&amp;/g, "&");

  // 1) Güncel biçim: "minOfSortPrice":[0,48299]
  const wrapped = readNumberField(text, "minOfSortPrice");
  if (wrapped) return wrapped;

  // 2) Eski/sade JSON biçimi: "minOfSortPrice":48299
  const plain = text.match(/"minOfSortPrice"\s*:\s*([\d.]+)/);
  if (plain) {
    const v = parseFloat(plain[1]);
    if (Number.isFinite(v) && v > 0) return v;
  }

  // 3) schema.org fiyat alanları
  const meta =
    text.match(/itemprop="price"\s+content="([\d.,]+)"/i) ??
    text.match(/"price"\s*:\s*"?([\d.]+)"?/);
  if (meta) {
    const v = parseTrPrice(meta[1]);
    if (v) return v;
  }

  // 4) Açıklama metni: "... fiyatları 48.299,00 TL'den başlayan ..."
  const desc = text.match(/fiyatlar[ıi]\s+([\d.,]+)\s*TL/i);
  if (desc) {
    const v = parseTrPrice(desc[1]);
    if (v) return v;
  }

  return null;
}

/** "48.299,00" -> 48299 ; "48299.00" -> 48299 */
function parseTrPrice(raw: string): number | null {
  let s = raw.trim();
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const v = parseFloat(s);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * akakce'nin uzun vadeli fiyat grafiği hazır bir görsel olarak sayfaya gömülü:
 * style="background:url(https://akakce-g.akamaized.net/282674948:4829900:17.2)"
 */
function readGraphImageUrl(html: string): string | null {
  const m = html.match(
    /background:\s*url\((https:\/\/akakce-g\.akamaized\.net\/[^)\s]+)\)/i
  );
  return m ? m[1] : null;
}

/**
 * akakce ürün sayfasından elde edilebilen gerçek fiyat geçmişi noktalarını çeker.
 *
 * ÖNEMLİ SINIR: akakce sayısal olarak yalnızca son 1 ayın en düşük fiyatını
 * (tarihiyle birlikte) ve güncel satıcı fiyat aralığını açıyor. Daha uzun
 * geçmiş yalnızca grafik görselinin içinde bulunuyor, bu yüzden onu da
 * graphImageUrl olarak döndürüyoruz.
 */
export async function scrapeAkakcePriceHistory(
  productName: string
): Promise<PriceHistoryResult | null> {
  const productUrl = await findAkakceProductUrl(productName);
  if (!productUrl) return null;

  const rawHtml = await fetchHtml(productUrl, AKAKCE_FETCH_OPTIONS);
  const text = rawHtml.replace(/&quot;/g, '"').replace(/&amp;/g, "&");

  const points: ScrapedPricePoint[] = [];

  const lowest1M = readNumberField(text, "lowestPrice1M");
  const lowest1MDate = readDateField(text, "lowestPriceDate1M");
  if (lowest1M && lowest1MDate) {
    points.push({ price: lowest1M, recordedAt: lowest1MDate });
  }

  const currentMin = readNumberField(text, "minOfSortPrice");
  if (currentMin) {
    points.push({ price: currentMin, recordedAt: new Date().toISOString() });
  }

  const graphImageUrl = readGraphImageUrl(rawHtml);

  if (points.length === 0 && !graphImageUrl) return null;

  return {
    source: "akakce",
    sourceUrl: productUrl,
    points: dedupeByDate(points),
    graphImageUrl,
  };
}

/** Aynı güne düşen noktalardan yalnızca birini tut (en düşük fiyatlısını). */
function dedupeByDate(points: ScrapedPricePoint[]): ScrapedPricePoint[] {
  const byDay = new Map<string, ScrapedPricePoint>();
  for (const p of points) {
    const day = p.recordedAt.slice(0, 10);
    const existing = byDay.get(day);
    if (!existing || p.price < existing.price) byDay.set(day, p);
  }
  return Array.from(byDay.values()).sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );
}
