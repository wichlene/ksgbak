/**
 * Türkçe fiyat formatını (nokta binlik, virgül ondalık ayracı) sayıya çevirir.
 * "1.234,56 TL" -> 1234.56, "199,90" -> 199.9, "199" -> 199
 */
export function parseTurkishPrice(raw: string | null | undefined): number | null {
  if (!raw) return null;

  const cleaned = raw.replace(/[^\d.,]/g, "").trim();
  if (!cleaned) return null;

  let normalized = cleaned;
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Trendyol'un "10 bin adet satıldı" gibi ham metnini yaklaşık bir sayıya çevirir.
 * "10 bin adet satıldı" -> 10000, "1.234 adet satıldı" -> 1234
 */
export function parseSoldCount(raw: string | null | undefined): number | null {
  if (!raw) return null;

  const match = raw.match(/([\d.,]+)\s*(bin|milyon)?/i);
  if (!match) return null;

  const numPart = match[1].replace(/\./g, "").replace(",", ".");
  let value = parseFloat(numPart);
  if (!Number.isFinite(value)) return null;

  const unit = (match[2] || "").toLowerCase();
  if (unit === "bin") value *= 1_000;
  if (unit === "milyon") value *= 1_000_000;

  return Math.round(value);
}
