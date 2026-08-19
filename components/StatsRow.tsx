import type { Product } from "@/lib/types";
import { formatPriceTRY, formatSoldCount } from "@/lib/format";

export function StatsRow({
  product,
  pointCount,
}: {
  product: Product;
  pointCount: number;
}) {
  const soldLabel = formatSoldCount(product.sold_count_raw, product.sold_count);

  const stats = [
    { label: "Güncel Fiyat", value: formatPriceTRY(product.current_price) },
    {
      label: "En Düşük Fiyat",
      value: formatPriceTRY(product.lowest_price),
      accent: "text-green-400",
    },
    {
      label: "En Yüksek Fiyat",
      value: formatPriceTRY(product.highest_price),
      accent: "text-red-400",
    },
    // Satış adedi her üründe yayınlanmıyor; yoksa yerine kaç fiyat kaydımız
    // olduğunu gösteriyoruz.
    soldLabel
      ? { label: "Satış Adedi", value: soldLabel }
      : { label: "Fiyat Kaydı", value: `${pointCount} kayıt` },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl border border-white/5 bg-bg-card p-4">
          <p className="text-xs text-gray-500">{s.label}</p>
          <p className={`mt-1 text-lg font-semibold ${s.accent ?? "text-gray-100"}`}>
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}
