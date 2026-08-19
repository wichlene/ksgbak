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

  // İsimle arama bazen farklı bir ürünü yakalıyor. Bulunan geçmişin fiyatları
  // Trendyol'daki güncel fiyattan aşırı uzaksa büyük ihtimalle başka bir ürün;
  // yanlış veriyi grafiğe sokmaktansa geçmişsiz devam etmek daha doğru.
  if (history && !isPlausibleMatch(productInfo.currentPrice, history)) {
    history = null;
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

/**
 * Karşılaştırma sitesinden gelen geçmişin gerçekten aynı ürüne ait olup
 * olmadığını fiyat büyüklüğüne bakarak kabaca doğrular. Fiyatlar zaman içinde
 * değiştiği için geniş bir bant bırakılıyor; amaç yalnızca "bambaşka ürün"
 * durumunu (örn. 1.700 TL'lik ürüne 7.600 TL'lik geçmiş) elemek.
 */
export function isPlausibleMatch(
  currentPrice: number | null,
  history: PriceHistoryResult
): boolean {
  if (currentPrice == null || currentPrice <= 0) return true;
  if (history.points.length === 0) return true;

  const prices = history.points.map((p) => p.price).filter((p) => p > 0);
  if (prices.length === 0) return true;

  const median = prices.slice().sort((a, b) => a - b)[Math.floor(prices.length / 2)];
  const ratio = median / currentPrice;

  // Ürün fiyatı geçmişte 3 kat artmış/azalmış olabilir; bunun ötesi şüpheli.
  return ratio >= 1 / 3 && ratio <= 3;
}

async function tryOrNull<T>(fn: () => Promise<T | null>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}
