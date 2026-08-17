import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { ProductCard } from "@/components/ProductCard";
import { PriceChart } from "@/components/PriceChart";
import { StatsRow } from "@/components/StatsRow";
import { AkakceGraph } from "@/components/AkakceGraph";
import { BackfillTrigger } from "@/components/BackfillTrigger";
import type { PriceHistoryPoint, Product } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
}

export default async function ProductPage({ params }: PageProps) {
  const { product, history } = await getProductWithHistory(params.id);
  if (!product) notFound();

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10">
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <ProductCard product={product} />

        <div className="flex flex-col gap-4">
          <PriceChart history={history} />
          {!product.wayback_backfilled_at && (
            <BackfillTrigger productId={product.id} />
          )}
          <StatsRow product={product} />
          <AkakceGraph product={product} />
        </div>
      </div>

      {product.status === "tracking" && (
        <p className="mt-6 rounded-xl border border-white/10 bg-bg-card p-4 text-sm text-gray-400">
          Bu ürün için karşılaştırma sitelerinde hazır fiyat geçmişi
          bulunamadı. Ürünü izlemeye aldık, her gün otomatik olarak fiyatını
          kontrol edip buraya ekleyeceğiz.
        </p>
      )}
    </main>
  );
}

async function getProductWithHistory(
  id: string
): Promise<{ product: Product | null; history: PriceHistoryPoint[] }> {
  const supabase = createServiceClient();

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!product) return { product: null, history: [] };

  const { data: history } = await supabase
    .from("price_history")
    .select("*")
    .eq("product_id", id)
    .order("recorded_at", { ascending: true });

  return { product, history: history ?? [] };
}
