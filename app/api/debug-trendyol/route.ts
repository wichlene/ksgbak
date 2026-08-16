import { NextResponse } from "next/server";
import { fetchHtml } from "@/lib/scraper/http";

// GEÇİCİ teşhis endpoint'i — Trendyol'un gerçek fiyat alanı yapısını görmek
// için. İş bitince silinecek.
export const maxDuration = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "?url= parametresi gerekli" }, { status: 400 });
  }

  try {
    const html = await fetchHtml(url);

    const hasStateScript = html.includes("__PRODUCT_DETAIL_APP_INITIAL_STATE__");
    let parsedKeys: string[] | null = null;
    let productKeys: string[] | null = null;
    let priceObject: unknown = null;
    let parseError: string | null = null;

    if (hasStateScript) {
      const match = html.match(
        /__PRODUCT_DETAIL_APP_INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/
      );
      if (match) {
        try {
          const state = JSON.parse(match[1]);
          parsedKeys = Object.keys(state);
          const product = state?.product ?? state?.pdp?.product ?? null;
          if (product) {
            productKeys = Object.keys(product);
            priceObject = product.price ?? null;
          }
        } catch (e) {
          parseError = e instanceof Error ? e.message : String(e);
        }
      } else {
        parseError = "regex state script'i bulamadı";
      }
    }

    // Ham HTML içinde "price" geçen yerlerin etrafından kısa kesitler al
    const priceSnippets: string[] = [];
    const regex = /.{40}price.{60}/gi;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = regex.exec(html)) && count < 15) {
      priceSnippets.push(m[0]);
      count++;
    }

    return NextResponse.json({
      htmlLength: html.length,
      hasStateScript,
      parseError,
      parsedKeys,
      productKeys,
      priceObject,
      priceSnippets,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
