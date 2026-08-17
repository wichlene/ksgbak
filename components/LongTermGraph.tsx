import type { Product } from "@/lib/types";

/**
 * Uzun vadeli fiyat seyri görseli.
 *
 * Veri kaynağı sayısal geçmişi dışarı açmadığı için uzun vadeli seyri hazır
 * grafik olarak alıyoruz. Kaynak sitenin adı/logosu kullanıcıya gösterilmez.
 */
export function LongTermGraph({ product }: { product: Product }) {
  if (!product.graph_image_url) return null;

  return (
    <div className="rounded-2xl border border-white/5 bg-bg-card p-5">
      <h2 className="mb-3 text-sm font-semibold text-gray-200">
        Uzun vadeli fiyat seyri
      </h2>

      {/* Dış kaynakta dinamik üretilen görsel; next/image ile optimize edilmiyor. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={product.graph_image_url}
        alt="Uzun vadeli fiyat seyri grafiği"
        className="w-full rounded-lg bg-bg-soft"
        loading="lazy"
      />
    </div>
  );
}
