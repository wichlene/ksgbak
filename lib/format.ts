export function formatPriceTRY(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDateShort(iso: string | number): string {
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Zaman ekseni etiketi: "Ağu 26" */
export function formatMonthShort(value: string | number): string {
  return new Date(value).toLocaleDateString("tr-TR", {
    month: "short",
    year: "2-digit",
  });
}

export function formatSoldCount(
  raw: string | null,
  count: number | null
): string | null {
  if (raw) return raw;
  if (count == null) return null;
  if (count >= 1_000_000) return `${Math.round(count / 100_000) / 10} milyon+ satıldı`;
  if (count >= 1_000) return `${Math.round(count / 100) / 10} bin+ satıldı`;
  return `${count}+ satıldı`;
}
