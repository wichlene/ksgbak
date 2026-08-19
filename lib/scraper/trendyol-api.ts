import { fetchHtml } from "./http";
import { extractSoldCount, extractPriceFromHtml } from "./trendyol-parse";
import type { ScrapedProductInfo } from "./types";

/**
 * Trendyol'un ürün detay servisi.
 *
 * Satış adedi, temiz ürün adı ve görseller sunucu HTML'inde güvenilir biçimde
 * bulunmuyor (bir kısmı tarayıcıda sonradan yerleştiriliyor); bu servis ise
 * hepsini tek JSON'da veriyor. Ulaşılamazsa sessizce null döner ve HTML
 * scrape'i devrede kalır.
 */
const ENDPOINTS = [
  (id: string) =>
    `https://apigw.trendyol.com/discovery-web-productgw-service/api/productDetail/${id}?storefrontId=1&culture=tr-TR`,
  (id: string) =>
    `https://public.trendyol.com/discovery-web-productgw-service/api/productDetail/${id}?storefrontId=1&culture=tr-TR`,
];

export async function fetchTrendyolProductFromApi(
  productId: string
): Promise<Partial<ScrapedProductInfo> | null> {
  for (const buildUrl of ENDPOINTS) {
    try {
      const raw = await fetchHtml(buildUrl(productId), { timeoutMs: 15_000 });
      const info = parseApiResponse(raw);
      if (info) return info;
    } catch {
      // Bu endpoint çalışmadı, sıradakini dene.
    }
  }
  return null;
}

function parseApiResponse(raw: string): Partial<ScrapedProductInfo> | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }

  const result =
    (json as { result?: Record<string, unknown> })?.result ??
    (json as Record<string, unknown>);
  if (!result || typeof result !== "object") return null;

  const r = result as Record<string, any>;

  const name: string | null = typeof r.name === "string" ? r.name : null;
  const brand: string | null =
    typeof r.brand?.name === "string" ? r.brand.name : null;

  // images: ["/productimages/....jpg"] ya da tam URL olabilir
  let imageUrl: string | null = null;
  const firstImage = Array.isArray(r.images) ? r.images[0] : null;
  if (typeof firstImage === "string") {
    imageUrl = firstImage.startsWith("http")
      ? firstImage
      : `https://cdn.dsmcdn.com${firstImage}`;
  } else if (typeof firstImage?.url === "string") {
    imageUrl = firstImage.url.startsWith("http")
      ? firstImage.url
      : `https://cdn.dsmcdn.com${firstImage.url}`;
  }

  const currentPrice =
    numberOrNull(r.price?.discountedPrice?.value) ??
    numberOrNull(r.price?.sellingPrice?.value) ??
    extractPriceFromHtml(raw);

  // Satış adedi JSON'un içinde farklı isimlerle durabildiği için ham metin
  // üzerinden aynı esnek çıkarıcıyı kullanıyoruz.
  const { soldCountRaw, soldCount } = extractSoldCount(raw, "");

  if (!name && currentPrice == null && soldCount == null) return null;

  return { name, brand, imageUrl, currentPrice, soldCountRaw, soldCount };
}

function numberOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}
