import { NextResponse } from "next/server";
import {
  fetchTrendyolProduct,
  isTrendyolUrl,
  trackTrendyolProduct,
} from "@/lib/scraper";
import {
  findProductByUrl,
  getPriceHistory,
  insertPriceHistoryPoints,
  insertProduct,
  updateSoldCount,
} from "@/lib/db/products";
import {
  getCachedTrackResult,
  resolveProductCacheKey,
  setCachedTrackResult,
} from "@/lib/cache/track-cache";
import type { PriceHistoryPoint, Product } from "@/lib/types";

// Trendyol + cimri + akakce sırayla scrape edilebileceği için tek istek
// birkaç saniye sürebilir. Vercel Hobby planında serverless fonksiyon süresi
// varsayılan 10sn ile sınırlıdır; bu route'un güvenilir çalışması için Pro
// plan (ya da vercel.json'da maxDuration ayarı) gerekebilir.
export const maxDuration = 60;

const FRESH_WINDOW_MS = 60 * 60 * 1000; // 1 saat
const NOT_FOUND_MESSAGE =
  "cimri.com ve akakce.com'da fiyat geçmişi bulunamadı. Ürün izlemeye alındı, yarından itibaren kendi verimizi biriktireceğiz.";

export async function POST(request: Request) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url || !isTrendyolUrl(url)) {
    return NextResponse.json(
      { error: "Geçerli bir Trendyol ürün linki gönder" },
      { status: 400 }
    );
  }

  try {
    const existing = await findProductByUrl(url);

    if (existing && isFresh(existing.last_checked_at)) {
      const history = await getPriceHistory(existing.id);
      return NextResponse.json(toResponse(existing, history));
    }

    if (existing) {
      return NextResponse.json(await refreshExistingProduct(existing, url));
    }

    return NextResponse.json(await trackNewProduct(url));
  } catch (err) {
    console.error("[/api/track] hata:", err);
    return NextResponse.json(
      { error: "Ürün işlenirken bir hata oluştu, birazdan tekrar dene" },
      { status: 500 }
    );
  }
}

/** Ürün zaten DB'de biliniyor ama son kontrol 1 saatten eski: sadece güncel fiyatı tazele. */
async function refreshExistingProduct(existing: Product, url: string) {
  const info = await fetchTrendyolProduct(url);

  if (info.currentPrice != null) {
    await insertPriceHistoryPoints(
      existing.id,
      [{ price: info.currentPrice, recordedAt: new Date().toISOString() }],
      "internal"
    );
  }
  if (info.soldCount != null || info.soldCountRaw) {
    await updateSoldCount(existing.id, info.soldCountRaw, info.soldCount);
  }

  const refreshed = (await findProductByUrl(url)) ?? existing;
  const history = await getPriceHistory(refreshed.id);
  return toResponse(refreshed, history);
}

/** DB'de hiç kaydı olmayan yeni ürün: tam akış (Trendyol + cimri/akakce fallback). */
async function trackNewProduct(url: string) {
  const productKey = resolveProductCacheKey(url);
  const cached = await getCachedTrackResult(productKey);
  const result = cached ?? (await trackTrendyolProduct(url));
  if (!cached) await setCachedTrackResult(productKey, result);

  const { productInfo, history } = result;
  const status = history ? "active" : "tracking";

  let product = await insertProduct({
    trendyolUrl: url,
    trendyolProductId: productInfo.trendyolProductId,
    name: productInfo.name,
    brand: productInfo.brand,
    imageUrl: productInfo.imageUrl,
    priceSource: history?.source ?? "internal",
    status,
  });

  // insertProduct unique constraint çakışmasında null döner: aynı ürün için
  // eşzamanlı iki istek yarıştıysa, kazanan tarafın satırını okuyup devam et.
  if (!product) {
    const raceWinner = await findProductByUrl(url);
    if (raceWinner) {
      const raceHistory = await getPriceHistory(raceWinner.id);
      return toResponse(raceWinner, raceHistory);
    }
    throw new Error("Ürün eklenemedi ve eşzamanlı kayıt da bulunamadı");
  }

  if (history && history.points.length > 0) {
    const sorted = [...history.points].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );
    await insertPriceHistoryPoints(
      product.id,
      sorted.map((p) => ({ price: p.price, recordedAt: p.recordedAt })),
      history.source
    );
  }

  if (productInfo.currentPrice != null) {
    await insertPriceHistoryPoints(
      product.id,
      [{ price: productInfo.currentPrice, recordedAt: new Date().toISOString() }],
      "internal"
    );
  }

  if (productInfo.soldCount != null || productInfo.soldCountRaw) {
    await updateSoldCount(product.id, productInfo.soldCountRaw, productInfo.soldCount);
  }

  const finalProduct = (await findProductByUrl(url)) ?? product;
  const finalHistory = await getPriceHistory(finalProduct.id);

  return toResponse(finalProduct, finalHistory, history ? undefined : NOT_FOUND_MESSAGE);
}

function isFresh(lastCheckedAt: string | null): boolean {
  if (!lastCheckedAt) return false;
  return Date.now() - new Date(lastCheckedAt).getTime() < FRESH_WINDOW_MS;
}

function toResponse(product: Product, history: PriceHistoryPoint[], message?: string) {
  return { product, history, message };
}
