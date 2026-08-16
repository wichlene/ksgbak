import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchTrendyolProduct } from "@/lib/scraper";
import { insertPriceHistoryPoints, updateSoldCount } from "@/lib/db/products";
import type { Product } from "@/lib/types";

// Vercel Hobby planında serverless fonksiyon süresi en fazla 60sn'ye kadar
// ayarlanabilir (Pro'da 300sn+). Ürün sayısı arttıkça DELAY*ürün_sayısı bu
// sınırı aşabilir; o noktada bu route'u sayfalama (örn. ?offset=) ile parça
// parça çalıştıracak şekilde bölmek gerekir.
export const maxDuration = 60;
// Trendyol, ABD datacenter IP'lerinden gelen istekleri bot sanıp 403 ile
// reddedebiliyor; fonksiyonu Türkiye'ye en yakın Vercel bölgesine sabitliyoruz.
export const preferredRegion = "fra1";

const DELAY_BETWEEN_REQUESTS_MS = 1200;

/**
 * Vercel Cron her gün 03:00 (TR saati) bu endpoint'i tetikler (bkz. vercel.json).
 * Vercel, CRON_SECRET env değişkeni tanımlıysa cron isteklerine otomatik olarak
 * `Authorization: Bearer <CRON_SECRET>` header'ı ekler; burada onu doğruluyoruz
 * ki endpoint dışarıdan çağrılarak istismar edilemesin.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .in("status", ["active", "tracking"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = { ok: 0, failed: 0, total: products?.length ?? 0 };

  for (const product of products ?? []) {
    try {
      await trackOne(product);
      results.ok++;
    } catch (err) {
      console.error(`[cron] ${product.trendyol_url} tazelenemedi:`, err);
      results.failed++;
    }
    await sleep(DELAY_BETWEEN_REQUESTS_MS);
  }

  return NextResponse.json(results);
}

async function trackOne(product: Product) {
  const info = await fetchTrendyolProduct(product.trendyol_url);

  if (info.currentPrice != null) {
    await insertPriceHistoryPoints(
      product.id,
      [{ price: info.currentPrice, recordedAt: new Date().toISOString() }],
      "internal"
    );
  }

  if (info.soldCount != null || info.soldCountRaw) {
    await updateSoldCount(product.id, info.soldCountRaw, info.soldCount);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
