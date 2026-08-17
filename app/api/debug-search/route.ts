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
    const premium = searchParams.get("premium") === "1";
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
