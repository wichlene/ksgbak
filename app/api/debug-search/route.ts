import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { fetchHtml, FetchHtmlError, type ScraperOptions } from "@/lib/scraper/http";

// GEÇİCİ teşhis endpoint'i — cimri/akakce'ye hangi ScraperAPI ayarıyla
// ulaşabildiğimizi ve fiyat geçmişinin sayfada nasıl durduğunu tek istekte
// paralel olarak ölçer. İş bitince silinecek.
export const maxDuration = 60;
export const preferredRegion = "fra1";

const PER_ATTEMPT_TIMEOUT_MS = 40_000;

interface Attempt {
  label: string;
  searchUrl: (q: string) => string;
  linkPattern: RegExp;
  options: ScraperOptions;
}

function buildAttempts(): Attempt[] {
  const akakce = (q: string) =>
    `https://www.akakce.com/arama/?q=${encodeURIComponent(q)}`;
  const cimri = (q: string) =>
    `https://www.cimri.com/arama?q=${encodeURIComponent(q)}`;

  const akakceLinks = /,\d+\.html|-fiyati/i;
  const cimriLinks = /-p-?\d+/i;

  return [
    {
      label: "akakce-plain-nocountry",
      searchUrl: akakce,
      linkPattern: akakceLinks,
      options: { countryCode: null, timeoutMs: PER_ATTEMPT_TIMEOUT_MS },
    },
    {
      label: "akakce-premium-tr",
      searchUrl: akakce,
      linkPattern: akakceLinks,
      options: { premium: true, timeoutMs: PER_ATTEMPT_TIMEOUT_MS },
    },
    {
      label: "cimri-plain-nocountry",
      searchUrl: cimri,
      linkPattern: cimriLinks,
      options: { countryCode: null, timeoutMs: PER_ATTEMPT_TIMEOUT_MS },
    },
    {
      label: "cimri-premium-tr",
      searchUrl: cimri,
      linkPattern: cimriLinks,
      options: { premium: true, timeoutMs: PER_ATTEMPT_TIMEOUT_MS },
    },
  ];
}

/** Fiyat geçmişi verisinin sayfada hangi biçimde durduğunu anlamaya çalışır. */
function inspectForHistory(html: string) {
  const markers = [
    "fiyat geçmiş",
    "fiyatGeçmiş",
    "priceHistory",
    "price_history",
    "priceChart",
    "chartData",
    "grafik",
  ];
  const foundMarkers = markers.filter((m) =>
    html.toLowerCase().includes(m.toLowerCase())
  );

  // [tarih, fiyat] / [timestamp, price] çifti dizilerine benzeyen kesitler
  const pairArrays = (html.match(/\[\s*\[\s*\d{4,}\s*,\s*[\d.]+\s*\][^\]]{0,200}/g) || [])
    .slice(0, 3);

  const snippets = foundMarkers
    .flatMap((m) => {
      const idx = html.toLowerCase().indexOf(m.toLowerCase());
      return idx >= 0 ? [html.slice(Math.max(0, idx - 120), idx + 260)] : [];
    })
    .slice(0, 5);

  return { foundMarkers, pairArrays, snippets };
}

/**
 * Fiyat geçmişi ilk HTML'de yoksa ayrı bir adresten (AJAX) geliyor demektir.
 * Bu fonksiyon o adresi bulmak için sayfanın yapısını çıkarır: script src'leri,
 * geçmiş/grafik ile ilgili linkler ve ürün ID'sinin geçtiği diğer yerler.
 */
function inspectPageStructure(html: string, productUrl: string) {
  const $ = cheerio.load(html);

  const scriptSrcs = $("script[src]")
    .toArray()
    .map((el) => $(el).attr("src") || "")
    .filter(Boolean)
    .slice(0, 25);

  // "geçmiş", "grafik", "istatistik", "fiyat-gecmisi" içeren linkler
  const historyLinks = $("a[href]")
    .toArray()
    .map((el) => ({ href: $(el).attr("href") || "", text: $(el).text().trim() }))
    .filter((a) => /gecmis|geçmiş|grafik|istatistik|chart|history/i.test(a.href + " " + a.text))
    .slice(0, 20);

  // Ürün ID'si (URL'deki ",282674948.html" kısmı) sayfada başka nerelerde geçiyor?
  const idMatch = productUrl.match(/,(\d+)\.html/);
  const productId = idMatch ? idMatch[1] : null;
  const idOccurrences: string[] = [];
  if (productId) {
    const re = new RegExp(`.{90}${productId}.{90}`, "g");
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = re.exec(html)) && count < 12) {
      idOccurrences.push(m[0]);
      count++;
    }
  }

  // Inline script'lerde geçen göreli/mutlak endpoint benzeri yollar
  const inlineScripts = $("script:not([src])")
    .toArray()
    .map((el) => $(el).html() || "")
    .join("\n");
  const endpointCandidates = Array.from(
    new Set(inlineScripts.match(/["'`](\/[a-z0-9_\-/.]{3,60}\?[^"'`]{0,80})["'`]/gi) || [])
  ).slice(0, 25);

  // data-* attribute'ları grafik verisini taşıyor olabilir
  const dataAttrs = Array.from(
    new Set(html.match(/data-[a-z-]*(?:chart|graph|price|hist|grafik|fiyat)[a-z-]*="[^"]{0,120}"/gi) || [])
  ).slice(0, 15);

  return {
    productId,
    scriptSrcs,
    historyLinks,
    idOccurrences,
    endpointCandidates,
    dataAttrs,
  };
}

async function runAttempt(attempt: Attempt, q: string) {
  const started = Date.now();
  const searchUrl = attempt.searchUrl(q);

  try {
    const html = await fetchHtml(searchUrl, attempt.options);
    const $ = cheerio.load(html);

    const candidates = $("a[href]")
      .toArray()
      .map((el) => ({ href: $(el).attr("href") || "", text: $(el).text().trim() }))
      .filter((a) => a.href && attempt.linkPattern.test(a.href));

    return {
      label: attempt.label,
      ok: true as const,
      ms: Date.now() - started,
      searchUrl,
      htmlLength: html.length,
      candidateCount: candidates.length,
      sampleCandidates: candidates.slice(0, 8),
      historyMarkersOnSearchPage: inspectForHistory(html).foundMarkers,
    };
  } catch (err) {
    return {
      label: attempt.label,
      ok: false as const,
      ms: Date.now() - started,
      searchUrl,
      error: err instanceof Error ? err.message : String(err),
      status: err instanceof FetchHtmlError ? err.status ?? null : null,
    };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const productUrl = searchParams.get("productUrl");

  // İkinci aşama: elimizde bir ürün sayfası URL'i varsa, fiyat geçmişinin o
  // sayfada nasıl durduğunu incele.
  if (productUrl) {
    const premium = searchParams.get("premium") !== "0";
    const render = searchParams.get("render") === "1";
    const started = Date.now();
    try {
      const html = await fetchHtml(productUrl, {
        premium,
        render,
        countryCode: premium ? "tr" : null,
        timeoutMs: 50_000,
      });
      return NextResponse.json({
        mode: "productPage",
        productUrl,
        premium,
        render,
        ms: Date.now() - started,
        htmlLength: html.length,
        ...inspectForHistory(html),
        ...inspectPageStructure(html, productUrl),
      });
    } catch (err) {
      return NextResponse.json({
        mode: "productPage",
        productUrl,
        ms: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
        status: err instanceof FetchHtmlError ? err.status ?? null : null,
      });
    }
  }

  if (!q) {
    return NextResponse.json(
      { error: "?q=<ürün adı> veya ?productUrl=<url> gerekli" },
      { status: 400 }
    );
  }

  const results = await Promise.all(buildAttempts().map((a) => runAttempt(a, q)));

  return NextResponse.json({
    mode: "search",
    query: q,
    hasScraperKey: Boolean(process.env.SCRAPER_API_KEY),
    results,
  });
}
