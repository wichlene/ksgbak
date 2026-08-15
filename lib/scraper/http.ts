import { pickUserAgent } from "./user-agents";

const DEFAULT_TIMEOUT_MS = 10_000;

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
 * Bir sayfanın HTML'ini gerçek bir tarayıcı gibi görünen header'larla çeker.
 * Site engelleme/timeout durumlarında FetchHtmlError fırlatır; çağıran taraf
 * bunu yakalayıp bir sonraki veri kaynağına düşmeli (cimri -> akakce -> internal).
 */
export async function fetchHtml(
  url: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": pickUserAgent(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
        Connection: "keep-alive",
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
