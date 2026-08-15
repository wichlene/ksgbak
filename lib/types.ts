export type PriceSource = "cimri" | "akakce" | "internal";
export type ProductStatus = "active" | "tracking" | "not_found";

export interface Product {
  id: string;
  trendyol_url: string;
  trendyol_product_id: string | null;
  name: string | null;
  brand: string | null;
  image_url: string | null;
  current_price: number | null;
  lowest_price: number | null;
  highest_price: number | null;
  sold_count_raw: string | null;
  sold_count: number | null;
  price_source: PriceSource;
  status: ProductStatus;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PriceHistoryPoint {
  id: number;
  product_id: string;
  price: number;
  source: PriceSource;
  recorded_at: string;
}
