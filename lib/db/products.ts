import { createServiceClient } from "@/lib/supabase/server";
import type { PriceHistoryPoint, PriceSource, Product, ProductStatus } from "@/lib/types";

export async function findProductByUrl(url: string): Promise<Product | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("trendyol_url", url)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export interface NewProductInput {
  trendyolUrl: string;
  trendyolProductId: string | null;
  name: string | null;
  brand: string | null;
  imageUrl: string | null;
  priceSource: PriceSource;
  status: ProductStatus;
}

/** Unique constraint ihlalinde (23505) null döner; race condition'ı caller ele alır. */
export async function insertProduct(input: NewProductInput): Promise<Product | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("products")
    .insert({
      trendyol_url: input.trendyolUrl,
      trendyol_product_id: input.trendyolProductId,
      name: input.name,
      brand: input.brand,
      image_url: input.imageUrl,
      price_source: input.priceSource,
      status: input.status,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") return null;
    throw error;
  }
  return data;
}

export async function updateSoldCount(
  productId: string,
  soldCountRaw: string | null,
  soldCount: number | null
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("products")
    .update({ sold_count_raw: soldCountRaw, sold_count: soldCount })
    .eq("id", productId);

  if (error) throw error;
}

export interface NewPricePoint {
  price: number;
  recordedAt: string;
}

/**
 * price_history'ye satır eklemek products.current_price/lowest_price/highest_price
 * alanlarını DB trigger'ı üzerinden otomatik günceller (bkz. migration 0001).
 * Kronolojik sırayla eklenmeli ki current_price en güncel fiyata denk gelsin.
 */
export async function insertPriceHistoryPoints(
  productId: string,
  points: NewPricePoint[],
  source: PriceSource
): Promise<void> {
  if (points.length === 0) return;

  const supabase = createServiceClient();
  const rows = points.map((p) => ({
    product_id: productId,
    price: p.price,
    source,
    recorded_at: p.recordedAt,
  }));

  const { error } = await supabase.from("price_history").insert(rows);
  if (error) throw error;
}

export async function getPriceHistory(productId: string): Promise<PriceHistoryPoint[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("price_history")
    .select("*")
    .eq("product_id", productId)
    .order("recorded_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
