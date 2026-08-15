import { fetchTrendyolProduct, isTrendyolUrl } from "./trendyol";
import { scrapeCimriPriceHistory } from "./cimri";
import { scrapeAkakcePriceHistory } from "./akakce";
import type { PriceHistoryResult, ScrapedProductInfo } from "./types";

export * from "./types";
export { isTrendyolUrl, parseTrendyolProductId, fetchTrendyolProduct } from "./trendyol";

export interface TrackResult {
  productInfo: ScrapedProductInfo;
  history: PriceHistoryResult | null;
}

/**
 * Ana orkestrasyon: Trendyol'dan ürün bilgisini çeker, sonra sırasıyla
 * cimri.com -> akakce.com'dan fiyat geçmişi aramaya çalışır.
 * İkisinde de bulunamazsa history=null döner; çağıran taraf bunu
 * "izlemeye alındı" (status=tracking) olarak işlemeli.
 */
export async function trackTrendyolProduct(url: string): Promise<TrackResult> {
  if (!isTrendyolUrl(url)) {
    throw new Error("Geçerli bir Trendyol ürün linki değil");
  }

  const productInfo = await fetchTrendyolProduct(url);

  let history: PriceHistoryResult | null = null;

  if (productInfo.name) {
    history = await tryOrNull(() => scrapeCimriPriceHistory(productInfo.name!));

    if (!history) {
      history = await tryOrNull(() => scrapeAkakcePriceHistory(productInfo.name!));
    }
  }

  return { productInfo, history };
}

async function tryOrNull<T>(fn: () => Promise<T | null>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}
