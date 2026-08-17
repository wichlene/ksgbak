import { fetchHtml } from "./http";
import { extractPriceFromHtml } from "./trendyol";
import type { ScrapedPricePoint } from "./types";

/**
 * archive.org (Wayback Machine) üzerinden geçmişe dönük fiyat verisi.
 *
 * Wayback, Trendyol ürün sayfalarının yıllar boyunca alınmış anlık kopyalarını
 * saklıyor. Her kopyadan o günkü fiyatı okuyarak gerçek çok yıllık sayısal
 * fiyat geçmişi elde ediyoruz — akakce/cimri'nin vermediği şey tam olarak bu.
 *
 * archive.org'un bot koruması yok, bu yüzden istekler proxy'siz (direct)
 * atılıyor: hem daha hızlı hem de ScraperAPI kredisi harcamıyor.
 */

const CDX_ENDPOINT = "https://web.archive.org/cdx/search/cdx";
const SNAPSHOT_TIMEOUT_MS = 15_000;
const CDX_TIMEOUT_MS = 20_000;

/**
 * Aynı anda kaç snapshot çekilsin. 12-24 snapshot'ın 60sn'lik fonksiyon
 * sınırına sığması için yeterince paralel, archive.org'u boğmayacak kadar az.
 */
const CONCURRENCY = 8;

export interface WaybackOptions {
  /** En fazla kaç snapshot işlensin. */
  maxSnapshots?: number;
  /** Kaç yıl geriye gidilsin. */
  yearsBack?: number;
  /**
   * Arşiv kopyasından fiyatı okuyan fonksiyon. Varsayılan Trendyol; akakce
   * sayfaları için extractAkakcePriceFromHtml verilir.
   */
  extractPrice?: (html: string) => number | null;
  /** Bu zamana kadar bitmezse kalan snapshot'lar atlanır (epoch ms). */
  deadline?: number;
}

/**
 * Bir URL'in arşivlenmiş kopyalarının zaman damgalarını döner.
 * collapse=timestamp:6 ile ayda bir kopya alınır (YYYYMM bazında tekilleştirme).
 */
export async function listSnapshots(
  url: string,
  opts: WaybackOptions = {}
): Promise<string[]> {
  const yearsBack = opts.yearsBack ?? 2;
  const from = new Date();
  from.setFullYear(from.getFullYear() - yearsBack);

  const params = new URLSearchParams({
    url,
    output: "json",
    fl: "timestamp",
    filter: "statuscode:200",
    collapse: "timestamp:6",
    from: formatCdxDate(from),
    limit: String(opts.maxSnapshots ?? 24),
  });

  const raw = await fetchHtml(`${CDX_ENDPOINT}?${params}`, {
    direct: true,
    timeoutMs: CDX_TIMEOUT_MS,
  });

  let rows: string[][];
  try {
    rows = JSON.parse(raw);
  } catch {
    return [];
  }

  // İlk satır başlık ("timestamp"), atlanır.
  return rows
    .slice(1)
    .map((r) => r[0])
    .filter((ts) => /^\d{14}$/.test(ts));
}

/**
 * Tek bir arşiv kopyasından fiyatı okur.
 * URL'deki "id_" eki, arşiv bannerı eklenmemiş ham orijinal içeriği verir.
 */
async function fetchSnapshotPrice(
  timestamp: string,
  url: string,
  extractPrice: (html: string) => number | null
): Promise<ScrapedPricePoint | null> {
  try {
    const html = await fetchHtml(
      `https://web.archive.org/web/${timestamp}id_/${url}`,
      { direct: true, timeoutMs: SNAPSHOT_TIMEOUT_MS }
    );

    const price = extractPrice(html);
    if (price == null) return null;

    return { price, recordedAt: parseCdxTimestamp(timestamp) };
  } catch {
    // Tek bir kopyanın alınamaması normal (silinmiş/bozuk arşiv); atla.
    return null;
  }
}

/**
 * Bir Trendyol ürün sayfasının arşivlenmiş kopyalarından fiyat geçmişi çıkarır.
 * Hiç arşiv kopyası yoksa ya da hiçbirinden fiyat okunamazsa boş dizi döner.
 */
export async function fetchWaybackPriceHistory(
  url: string,
  opts: WaybackOptions = {}
): Promise<ScrapedPricePoint[]> {
  const extractPrice = opts.extractPrice ?? extractPriceFromHtml;
  const timestamps = await listSnapshots(url, opts);
  if (timestamps.length === 0) return [];

  const points: ScrapedPricePoint[] = [];

  for (let i = 0; i < timestamps.length; i += CONCURRENCY) {
    if (opts.deadline && Date.now() > opts.deadline) break;

    const batch = timestamps.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(
      batch.map((ts) => fetchSnapshotPrice(ts, url, extractPrice))
    );
    for (const p of settled) {
      if (p) points.push(p);
    }
  }

  return dedupeByDay(points);
}

/** "20240315120000" -> ISO tarih */
function parseCdxTimestamp(ts: string): string {
  const iso = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(
    8,
    10
  )}:${ts.slice(10, 12)}:${ts.slice(12, 14)}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function formatCdxDate(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCDate()).padStart(2, "0")
  );
}

function dedupeByDay(points: ScrapedPricePoint[]): ScrapedPricePoint[] {
  const byDay = new Map<string, ScrapedPricePoint>();
  for (const p of points) {
    const day = p.recordedAt.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, p);
  }
  return Array.from(byDay.values()).sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );
}
