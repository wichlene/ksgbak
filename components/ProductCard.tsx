import Image from "next/image";
import type { Product } from "@/lib/types";
import { formatPriceTRY, formatSoldCount } from "@/lib/format";

export function ProductCard({ product }: { product: Product }) {
  const soldLabel = formatSoldCount(product.sold_count_raw, product.sold_count);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-bg-card p-5">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-bg-soft">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name ?? "Ürün görseli"}
            fill
            sizes="(max-width: 768px) 100vw, 320px"
            className="object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            Görsel yok
          </div>
        )}
      </div>

      <div>
        {product.brand && (
          <p className="text-xs font-medium uppercase tracking-wide text-accent">
            {product.brand}
          </p>
        )}
        <h1 className="mt-1 line-clamp-3 text-lg font-semibold text-gray-100">
          {product.name ?? "İsimsiz ürün"}
        </h1>
      </div>

      <div>
        <p className="text-xs text-gray-500">Güncel fiyat</p>
        <p className="text-3xl font-bold text-gray-50">
          {formatPriceTRY(product.current_price)}
        </p>
      </div>

      {soldLabel && <p className="text-sm text-gray-400">{soldLabel}</p>}

      <a
        href={product.trendyol_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto inline-flex items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-accent hover:text-accent"
      >
        Trendyol&apos;da Gör
      </a>
    </div>
  );
}
