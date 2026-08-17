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
 * Ana orkestrasyon: Trendyol'dan ürün bilgisini çeker, sonra fiyat geçmişi için
 * önce akakce.com'u, olmazsa cimri.com'u dener.
 *
 * Sıra ölçüme dayalı: akakce'ye ScraperAPI premium proxy ile ~4sn'de
 * ulaşılabiliyor ve sayfası sunucu tarafında render ediliyor; cimri ise ağır
 * bir JS uygulaması ve proxy üzerinden HTTP 500 veriyor.
 *
 * İkisinde de bulunamazsa history=null döner; çağıran taraf bunu
 * "izlemeye alındı" (status=tracking) olarak işlemeli.
 */
export async function trackTrendyolProduct(url: string): Promise<TrackResult> {
  if (!isTrendyolUrl(url)) {
    throw new Error("Geçerli bir Trendyol ürün linki değil");
  }

  const productInfo = await fetchTrendyolProduct(url);

  let history: PriceHistoryResult | null = null;

  const searchName = buildSearchQuery(productInfo.name, productInfo.brand);
  if (searchName) {
    history = await tryOrNull(() => scrapeAkakcePriceHistory(searchName));

    if (!history) {
      history = await tryOrNull(() => scrapeCimriPriceHistory(searchName));
    }
  }

  return { productInfo, history };
}

/**
 * Trendyol ürün başlıkları arama için fazla uzun oluyor ("... - Fiyatı,
 * Yorumları" gibi kuyruklar, ölçü/renk detayları). Karşılaştırma sitelerinde
 * sonuç bulunabilmesi için başlığı kısaltıp sadeleştirir.
 */
export function buildSearchQuery(
  name: string | null,
  brand: string | null
): string | null {
  if (!name) return null;

  let cleaned = name
    // "- Fiyatı, Yorumları, Özellikleri" gibi Trendyol kuyruklarını at
    .split(/\s+-\s+fiyat/i)[0]
    .replace(/\b(fiyat[ıi]|yorumlar[ıi]|özellikleri|trendyol)\b/gi, " ")
    .replace(/[^\p{L}\p{N}\s.]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  // İlk 8 kelime marka + model için genelde yeterli, fazlası aramayı daraltıyor
  const words = cleaned.split(" ").filter(Boolean).slice(0, 8);
  cleaned = words.join(" ");

  if (brand && !cleaned.toLowerCase().includes(brand.toLowerCase())) {
    cleaned = `${brand} ${cleaned}`.trim();
  }

  return cleaned.length > 2 ? cleaned : null;
}

async function tryOrNull<T>(fn: () => Promise<T | null>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}
