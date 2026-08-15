export interface ScrapedProductInfo {
  trendyolProductId: string | null;
  name: string | null;
  brand: string | null;
  imageUrl: string | null;
  currentPrice: number | null;
  soldCountRaw: string | null;
  soldCount: number | null;
}

export interface ScrapedPricePoint {
  price: number;
  recordedAt: string; // ISO tarih string'i, kaynak siteden best-effort parse edilir
}

export interface PriceHistoryResult {
  source: "cimri" | "akakce";
  sourceUrl: string;
  points: ScrapedPricePoint[];
}
