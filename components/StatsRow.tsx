import type { Product } from "@/lib/types";
import { formatPriceTRY } from "@/lib/format";

export function StatsRow({ product }: { product: Product }) {
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
    { label: "Veri Kaynağı", value: sourceLabel(product.price_source) },
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

function sourceLabel(source: Product["price_source"]): string {
  switch (source) {
    case "cimri":
      return "cimri.com";
    case "akakce":
      return "akakce.com";
    case "wayback":
      return "İnternet Arşivi";
    default:
      return "Kendi takibimiz";
  }
}
