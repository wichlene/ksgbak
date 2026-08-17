import * as cheerio from "cheerio";
import { fetchHtml } from "./http";
import { parseSoldCount, parseTurkishPrice } from "./parse";
import type { ScrapedProductInfo } from "./types";

/**
 * Trendyol ürün URL'lerindeki "-p-123456789" parçasından ürün ID'sini çıkarır.
 * Örn: https://www.trendyol.com/marka/urun-adi-p-123456789?boutiqueId=... -> "123456789"
 */
export function parseTrendyolProductId(url: string): string | null {
  const match = url.match(/-p-(\d+)/);
  return match ? match[1] : null;
}

export function isTrendyolUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return /(^|\.)trendyol\.com$/.test(hostname);
  } catch {
    return false;
  }
}

/**
 * Trendyol ürün sayfasından isim, marka, görsel, güncel fiyat ve satış adedini çeker.
 * Trendyol resmi bir API sunmadığı için sayfa HTML'inden best-effort parse yapılır:
 * önce sayfaya gömülü JSON state, olmazsa OpenGraph meta tag'leri ve düz metin
 * regex'leri denenir. Site yapısı değiştikçe bu selector'ların güncellenmesi gerekir.
 */
export async function fetchTrendyolProduct(
  url: string
): Promise<ScrapedProductInfo> {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const trendyolProductId = parseTrendyolProductId(url);

  let name: string | null = null;
  let brand: string | null = null;
  let imageUrl: string | null = null;
  let currentPrice: number | null = null;

  // 1) Sayfaya gömülü state JSON'u (script tag içinde window.__PRODUCT_DETAIL_APP_INITIAL_STATE__)
  // Trendyol bu değişken adını zaman zaman değiştiriyor; bulunamazsa 2. ve 3.
  // yöntemler devreye girer.
  const stateScript = $("script")
    .toArray()
    .map((el) => $(el).html() || "")
    .find((content) => content.includes("__PRODUCT_DETAIL_APP_INITIAL_STATE__"));

  if (stateScript) {
    const jsonMatch = stateScript.match(
      /__PRODUCT_DETAIL_APP_INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/
    );
    if (jsonMatch) {
      try {
        const state = JSON.parse(jsonMatch[1]);
        const product = state?.product ?? state?.pdp?.product ?? null;
        if (product) {
          name = product.name ?? null;
          brand = product.brand?.name ?? null;
          imageUrl = product.images?.[0]
            ? `https://cdn.dsmcdn.com${product.images[0]}`
            : null;
          currentPrice =
            product.price?.discountedPrice?.value ??
            product.price?.sellingPrice?.value ??
            null;
        }
      } catch {
        // state JSON parse edilemedi, diğer yöntemlere düş
      }
    }
  }

  // 2) Ham HTML üzerinde doğrudan fiyat alanı arama. Trendyol'un embedded
  // state'i hangi değişken/script altında olursa olsun "discountedPrice"/
  // "sellingPrice" key'leri sabit kalıyor gibi görünüyor, bu yüzden state
  // script'i bulunamasa bile bu regex'ler çoğu zaman çalışır.
  if (currentPrice == null) {
    const discountedMatch = html.match(
      /"discountedPrice"\s*:\s*\{\s*"value"\s*:\s*([\d.]+)/
    );
    const sellingMatch = html.match(
      /"sellingPrice"\s*:\s*\{\s*"value"\s*:\s*([\d.]+)/
    );
    const raw = discountedMatch?.[1] ?? sellingMatch?.[1] ?? null;
    currentPrice = raw ? parseFloat(raw) : null;
  }

  // 3) OpenGraph / meta tag fallback (isim, görsel, fiyat)
  if (!name) {
    name = $('meta[property="og:title"]').attr("content") ?? $("title").text() ?? null;
  }
  if (!imageUrl) {
    imageUrl = $('meta[property="og:image"]').attr("content") ?? null;
  }
  if (currentPrice == null) {
    const metaPrice =
      $('meta[property="product:price:amount"]').attr("content") ??
      $('[itemprop="price"]').attr("content") ??
      $('[itemprop="price"]').text();
    currentPrice = parseTurkishPrice(metaPrice);
  }

  // 3) "X bin adet satıldı" metnini ham HTML üzerinden ara
  const bodyText = $("body").text();
  const soldMatch = bodyText.match(
    /([\d.,]+\s*(?:bin|milyon)?\s*\+?\s*adet\s*satıldı)/i
  );
  const soldCountRaw = soldMatch ? soldMatch[1].replace(/\s+/g, " ").trim() : null;
  const soldCount = parseSoldCount(soldCountRaw);

  return {
    trendyolProductId,
    name: name?.trim() ?? null,
    brand: brand?.trim() ?? null,
    imageUrl,
    currentPrice,
    soldCountRaw,
    soldCount,
  };
}
