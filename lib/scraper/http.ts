import { pickUserAgent } from "./user-agents";

const DEFAULT_TIMEOUT_MS = 10_000;
// Route toplamda birkaç sıralı dış istek yapabilir; her biri en fazla bu kadar
// sürsün ki /api/track'in 60sn'lik maxDuration sınırını aşmasın.
const PROXY_TIMEOUT_MS = 20_000;

export class FetchHtmlError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "FetchHtmlError";
  }
}

export interface ScraperOptions {
  /** Sayfayı headless tarayıcıda çalıştır (JS ile render edilen içerik için). */
  render?: boolean;
  /** Residential proxy havuzu — sert bot korumaları için (daha fazla kredi harcar). */
  premium?: boolean;
  /** Coğrafi hedefleme. null verilirse hiç gönderilmez. */
  countryCode?: string | null;
  timeoutMs?: number;
}

/**
 * Trendyol/cimri/akakce doğrudan sunucu isteklerini (gerçek tarayıcı olmayan
 * her isteği, IP'den bağımsız olarak) 403 ile reddediyor — bunu hem Vercel'den
 * hem farklı bir ev IP'sinden ölçtük. SCRAPER_API_KEY tanımlıysa istekler
 * ScraperAPI üzerinden (rotating proxy + tarayıcı benzeri parmak izi) atılır.
 */
function buildRequestUrl(url: string, opts: ScraperOptions): string {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) return url;

  const proxyUrl = new URL("https://api.scraperapi.com/");
  proxyUrl.searchParams.set("api_key", apiKey);
  proxyUrl.searchParams.set("url", url);

  const country = opts.countryCode === undefined ? "tr" : opts.countryCode;
  if (country) proxyUrl.searchParams.set("country_code", country);
  if (opts.render) proxyUrl.searchParams.set("render", "true");
  if (opts.premium) proxyUrl.searchParams.set("premium", "true");

  return proxyUrl.toString();
}

export async function fetchHtml(
  url: string,
  options: ScraperOptions | number = {}
): Promise<string> {
  // Geriye dönük uyumluluk: fetchHtml(url, 45_000) çağrıları da çalışsın.
  const opts: ScraperOptions =
    typeof options === "number" ? { timeoutMs: options } : options;

  const usingProxy = Boolean(process.env.SCRAPER_API_KEY);
  const requestUrl = buildRequestUrl(url, opts);
  const effectiveTimeout =
    opts.timeoutMs ?? (usingProxy ? PROXY_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), effectiveTimeout);

  try {
    const res = await fetch(requestUrl, {
      signal: controller.signal,
      // ScraperAPI kendi header'larını/parmak izini yönetir; proxy kullanırken
      // kendi header'larımızı göndermiyoruz.
      headers: usingProxy
        ? undefined
        : {
            "User-Agent": pickUserAgent(),
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
            "Accept-Encoding": "gzip, deflate, br",
            Connection: "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Cache-Control": "no-cache",
          },
      redirect: "follow",
    });

    if (!res.ok) {
      throw new FetchHtmlError(`HTTP ${res.status}`, url, res.status);
    }

    return await res.text();
  } catch (err) {
    if (err instanceof FetchHtmlError) throw err;
    const message = err instanceof Error ? err.message : "bilinmeyen hata";
    throw new FetchHtmlError(`İstek başarısız: ${message}`, url);
  } finally {
    clearTimeout(timeout);
  }
}
