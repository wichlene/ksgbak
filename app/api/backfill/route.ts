import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchWaybackPriceHistory } from "@/lib/scraper/wayback";
import { insertPriceHistoryPoints } from "@/lib/db/products";
import type { Product } from "@/lib/types";

/**
 * archive.org'dan geçmişe dönük fiyat taraması.
 *
 * /api/track'ten ayrı bir endpoint: ürün sayfası hızlı açılsın, geçmiş
 * arkadan doldurulsun. Ürün sayfası yüklendiğinde istemci tarafından bir kez
 * tetiklenir; wayback_backfilled_at dolu olan ürünler tekrar taranmaz.
 */
export const maxDuration = 60;
export const preferredRegion = "fra1";

export async function POST(request: Request) {
  let body: { productId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const productId = body.productId;
  if (!productId) {
    return NextResponse.json({ error: "productId gerekli" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: product, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle<Product>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!product) {
    return NextResponse.json({ error: "Ürün bulunamadı" }, { status: 404 });
  }
  if (product.wayback_backfilled_at) {
    return NextResponse.json({ status: "already_done", added: 0 });
  }

  try {
    const points = await fetchWaybackPriceHistory(product.trendyol_url, {
      yearsBack: 2,
      maxSnapshots: 24,
    });

    if (points.length > 0) {
      await insertPriceHistoryPoints(
        product.id,
        points.map((p) => ({ price: p.price, recordedAt: p.recordedAt })),
        "wayback"
      );
    }

    // Tarama sonuç vermese de işaretle ki her açılışta tekrar denenmesin.
    await supabase
      .from("products")
      .update({ wayback_backfilled_at: new Date().toISOString() })
      .eq("id", product.id);

    return NextResponse.json({ status: "ok", added: points.length });
  } catch (err) {
    console.error("[/api/backfill] hata:", err);
    return NextResponse.json(
      { error: "Arşiv taraması başarısız oldu" },
      { status: 500 }
    );
  }
}
