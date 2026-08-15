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
        // state JSON parse edilemedi, meta tag fallback'e düş
      }
    }
  }

  // 2) OpenGraph / meta tag fallback
  if (!name) {
    name = $('meta[property="og:title"]').attr("content") ?? $("title").text() ?? null;
  }
  if (!imageUrl) {
    imageUrl = $('meta[property="og:image"]').attr("content") ?? null;
  }
  if (!currentPrice) {
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
