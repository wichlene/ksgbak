export interface LinkCandidate {
  href: string;
  text: string;
}

/**
 * Aday linkler arasından ürün ismiyle en çok kelime örtüşen linki seçer.
 * Hiçbiri örtüşmezse ilk adayı döner (arama motorunun en alakalı sonucu ilk
 * sıraya koyduğu varsayımıyla).
 */
export function pickBestMatch(
  query: string,
  candidates: LinkCandidate[]
): LinkCandidate | null {
  if (candidates.length === 0) return null;

  const queryTokens = tokenize(query);
  let bestScore = 0;
  let best: LinkCandidate | null = null;

  for (const candidate of candidates) {
    const score = overlapScore(queryTokens, tokenize(candidate.text));
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return bestScore > 0 ? best : candidates[0];
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const token of a) if (b.has(token)) count++;
  return count;
}
