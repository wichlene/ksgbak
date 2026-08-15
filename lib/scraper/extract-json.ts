/**
 * Sayfaya gömülü JSON bloklarını (Next.js __NEXT_DATA__, window.__NUXT__,
 * window.__INITIAL_STATE__ gibi inline state atamaları) toplar.
 */
export function extractJsonBlobs(html: string): unknown[] {
  const blobs: unknown[] = [];

  const scriptJsonRegex =
    /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptJsonRegex.exec(html))) {
    try {
      blobs.push(JSON.parse(m[1]));
    } catch {
      // parse edilemeyen bloğu yoksay
    }
  }

  const assignmentRegex =
    /window\.__[A-Z0-9_]+__\s*=\s*(\{[\s\S]*?\})\s*;?\s*(?:<\/script>|\n)/g;
  while ((m = assignmentRegex.exec(html))) {
    try {
      blobs.push(JSON.parse(m[1]));
    } catch {
      // parse edilemeyen bloğu yoksay
    }
  }

  return blobs;
}

const PRICE_KEYS = ["price", "fiyat", "value", "amount", "minPrice"];
const DATE_KEYS = [
  "date",
  "tarih",
  "day",
  "createdAt",
  "insertDate",
  "priceDate",
  "recordDate",
];

export interface RawPricePoint {
  price: number;
  date: string;
}

/**
 * Bir JSON ağacı içinde {fiyat, tarih} çiftlerinden oluşan bir dizi arar.
 * cimri/akakce'nin tam key isimlerini bilmediğimiz için PRICE_KEYS/DATE_KEYS
 * üzerinden sezgisel bir arama yapılır; gerçek sitede gözlemlenen key'lere göre
 * bu listelerin güncellenmesi gerekebilir.
 */
export function findPriceHistoryArray(
  node: unknown,
  depth = 0
): RawPricePoint[] | null {
  if (depth > 8 || node == null) return null;

  if (Array.isArray(node) && node.length > 0) {
    const points = extractPointsFromArray(node);
    if (points && points.length > 0) return points;

    for (const item of node) {
      const found = findPriceHistoryArray(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof node === "object") {
    for (const value of Object.values(node as Record<string, unknown>)) {
      const found = findPriceHistoryArray(value, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

function extractPointsFromArray(arr: unknown[]): RawPricePoint[] | null {
  const points: RawPricePoint[] = [];

  for (const item of arr) {
    if (typeof item !== "object" || item === null) return null;
    const obj = item as Record<string, unknown>;

    const priceKey = PRICE_KEYS.find((k) => typeof obj[k] === "number");
    const dateKey = DATE_KEYS.find((k) => typeof obj[k] === "string");
    if (!priceKey || !dateKey) return null;

    points.push({ price: obj[priceKey] as number, date: obj[dateKey] as string });
  }

  return points.length > 0 ? points : null;
}
