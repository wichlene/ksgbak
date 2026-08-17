import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { fetchHtml } from "@/lib/scraper/http";
import { extractJsonBlobs, findPriceHistoryArray } from "@/lib/scraper/extract-json";
import { pickBestMatch, type LinkCandidate } from "@/lib/scraper/match";

// GEÇİCİ teşhis endpoint'i — cimri/akakce arama + fiyat geçmişi tespiti için.
// İş bitince silinecek.
export const maxDuration = 30;

const SOURCES: Record<string, { search: string; linkPattern: RegExp }> = {
  cimri: {
    search: "https://www.cimri.com/arama?q=",
    linkPattern: /-p-?\d+/i,
  },
  akakce: {
    search: "https://www.akakce.com/arama/?q=",
    linkPattern: /,\d+\.html|-fiyati/i,
  },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source") ?? "cimri";
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json({ error: "?q= parametresi gerekli (ürün adı)" }, { status: 400 });
  }
  const config = SOURCES[source];
  if (!config) {
    return NextResponse.json({ error: "source cimri veya akakce olmalı" }, { status: 400 });
  }

  try {
    const searchUrl = config.search + encodeURIComponent(q);
    const searchHtml = await fetchHtml(searchUrl);
    const $ = cheerio.load(searchHtml);

    const allLinks = $("a[href]")
      .toArray()
      .map((el) => ({ href: $(el).attr("href") || "", text: $(el).text().trim() }))
      .filter((a) => a.href && a.text);

    const candidates: LinkCandidate[] = allLinks.filter((a) =>
      config.linkPattern.test(a.href)
    );

    const best = pickBestMatch(q, candidates);
    const bestUrl = best
      ? best.href.startsWith("http")
        ? best.href
        : new URL(best.href, searchUrl).toString()
      : null;

    let productPageResult: unknown = null;
    if (bestUrl) {
      const productHtml = await fetchHtml(bestUrl);
      const blobs = extractJsonBlobs(productHtml);
      const historyFound = blobs
        .map((b) => findPriceHistoryArray(b))
        .find((r) => r != null);

      productPageResult = {
        htmlLength: productHtml.length,
        jsonBlobCount: blobs.length,
        historyFound: historyFound ?? null,
        priceSnippets: (productHtml.match(/.{30}(fiyat|price).{50}/gi) || []).slice(0, 10),
      };
    }

    return NextResponse.json({
      searchUrl,
      searchHtmlLength: searchHtml.length,
      totalLinksOnPage: allLinks.length,
      matchingCandidateCount: candidates.length,
      sampleCandidates: candidates.slice(0, 10),
      bestMatch: best,
      bestUrl,
      productPageResult,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
