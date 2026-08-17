import type { Product } from "@/lib/types";

/**
 * akakce uzun vadeli fiyat seyrini sayı olarak açmıyor, hazır bir grafik
 * görseli üretiyor. Sayısal geçmişimiz (kendi takibimiz + akakce'nin verdiği
 * son 1 aylık dip) kısa olduğu için uzun vadeli seyri bu görselle gösteriyoruz.
 */
export function AkakceGraph({ product }: { product: Product }) {
  if (!product.graph_image_url) return null;

  return (
    <div className="rounded-2xl border border-white/5 bg-bg-card p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-200">
          Uzun vadeli fiyat seyri
        </h2>
        {product.source_url && (
          <a
            href={product.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent hover:underline"
          >
            akakce.com&apos;da gör
          </a>
        )}
      </div>

      {/* akakce'nin ürettiği hazır grafik; next/image ile optimize etmiyoruz
          çünkü bu görsel dış kaynakta dinamik olarak üretiliyor. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={product.graph_image_url}
        alt="akakce fiyat geçmişi grafiği"
        className="w-full rounded-lg bg-bg-soft"
        loading="lazy"
      />

      <p className="mt-3 text-xs text-gray-500">
        Bu grafik akakce.com tarafından üretiliyor ve uzun vadeli fiyat seyrini
        gösteriyor. akakce sayısal geçmişi dışarı açmadığı için üstteki
        grafikte yalnızca kendi takibimiz ve akakce&apos;nin paylaştığı son 1
        aylık en düşük fiyat yer alıyor.
      </p>
    </div>
  );
}
