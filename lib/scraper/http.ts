import { pickUserAgent } from "./user-agents";

const DEFAULT_TIMEOUT_MS = 10_000;
// Route toplamda en fazla 3 sıralı dış istek yapabilir (trendyol + cimri +
// akakce); her biri en fazla bu kadar sürsün ki /api/track'in 60sn'lik
// maxDuration sınırını aşmasın. ScraperAPI zor sitelerde 15-20sn sürebiliyor.
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

/**
 * Trendyol/cimri/akakce doğrudan sunucu isteklerini (gerçek tarayıcı olmayan
 * her isteği, IP'den bağımsız olarak) 403 ile reddediyor — bunu ölçtük hem
 * Vercel'den hem farklı bir ev IP'sinden. SCRAPER_API_KEY tanımlıysa istekler
 * ScraperAPI üzerinden (rotating proxy + tarayıcı benzeri parmak izi) atılır.
 * Key yoksa doğrudan fetch denenir (yerel geliştirmede yine 403 alınabilir,
 * bu beklenen bir durumdur).
 */
function buildRequestUrl(url: string): string {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) return url;

  const proxyUrl = new URL("https://api.scraperapi.com/");
  proxyUrl.searchParams.set("api_key", apiKey);
  proxyUrl.searchParams.set("url", url);
  proxyUrl.searchParams.set("country_code", "tr");
  return proxyUrl.toString();
}

export async function fetchHtml(
  url: string,
  timeoutMs?: number
): Promise<string> {
  const usingProxy = Boolean(process.env.SCRAPER_API_KEY);
  const requestUrl = buildRequestUrl(url);
  const effectiveTimeout =
    timeoutMs ?? (usingProxy ? PROXY_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);

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
