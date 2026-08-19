import { parseSoldCount } from "./parse";

/**
 * Trendyol sayfa/JSON içeriğinden alan çıkaran saf fonksiyonlar.
 *
 * trendyol.ts (HTML scrape) ve trendyol-api.ts (ürün detay servisi) bu modülü
 * ortak kullanıyor; ayrı dosyada olmasının sebebi ikisi arasında dairesel
 * bağımlılık oluşmaması.
 */

/**
 * Bir Trendyol ürün sayfası HTML'inden (veya API JSON metninden) satış
 * fiyatını çıkarır.
 *
 * Trendyol'un gömülü state'i hangi script değişkeni altında olursa olsun
 * "discountedPrice"/"sellingPrice" key'leri sabit kalıyor, bu yüzden state
 * script'inin adı değişse bile bu regex'ler çalışıyor. Aynı fonksiyon
 * archive.org'dan gelen eski sayfa kopyalarında da kullanılıyor; eski
 * sürümlerde fiyat meta tag'inde durabildiği için o da denenir.
 */
export function extractPriceFromHtml(html: string): number | null {
  const jsonPatterns = [
    /"discountedPrice"\s*:\s*\{\s*"value"\s*:\s*([\d.]+)/,
    /"sellingPrice"\s*:\s*\{\s*"value"\s*:\s*([\d.]+)/,
    /"discountedPrice"\s*:\s*([\d.]+)/,
    /"sellingPrice"\s*:\s*([\d.]+)/,
  ];

  for (const pattern of jsonPatterns) {
    const m = html.match(pattern);
    if (m) {
      const value = parseFloat(m[1]);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }

  const metaMatch =
    html.match(/property="product:price:amount"\s+content="([\d.,]+)"/i) ??
    html.match(/itemprop="price"\s+content="([\d.,]+)"/i);
  if (metaMatch) {
    const value = parseFloat(metaMatch[1].replace(",", "."));
    if (Number.isFinite(value) && value > 0) return value;
  }

  return null;
}

/**
 * Ürünün satış adedini çıkarır ("10 bin+ adet satıldı" gibi).
 *
 * Trendyol bu bilgiyi sayfa yapısına göre farklı yerlerde taşıyor, bu yüzden
 * sırayla denenir: görünür metindeki kalıp, gömülü JSON'daki hazır sosyal
 * kanıt metni, sayısal sayaç alanları. Bilgi her üründe bulunmuyor (Trendyol
 * yalnızca belirli bir satış eşiğini geçen ürünlerde yayınlıyor).
 */
export function extractSoldCount(
  html: string,
  bodyText: string
): { soldCountRaw: string | null; soldCount: number | null } {
  // HTML entity'leri ve bölünmez boşlukları normal boşluğa çevir.
  const normalize = (s: string) =>
    s
      .replace(/&nbsp;/gi, " ")
      .replace(/ /g, " ")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ");

  const haystacks = [normalize(html), normalize(bodyText)];

  // 1) "10 bin+ adet satıldı" / "500 adet satıldı" kalıbı
  for (const text of haystacks) {
    const m = text.match(
      /([\d.,]+\s*(?:bin|milyon)?\s*\+?)\s*adet\s*sat[ıi]ld[ıi]/i
    );
    if (m) {
      const raw = `${m[1].trim()} adet satıldı`.replace(/\s+/g, " ");
      return { soldCountRaw: raw, soldCount: parseSoldCount(raw) };
    }
  }

  // 2) JSON'daki hazır sosyal kanıt metni: "text":"10 bin+ adet satıldı"
  for (const text of haystacks) {
    const m = text.match(/"text"\s*:\s*"([^"]{0,40}sat[ıi]ld[ıi][^"]{0,10})"/i);
    if (m) {
      const raw = m[1].trim();
      return { soldCountRaw: raw, soldCount: parseSoldCount(raw) };
    }
  }

  // 3) Sayısal sayaç alanları
  for (const text of haystacks) {
    const m = text.match(
      /"(?:orderCount|salesCount|soldCount|totalSalesCount|saleCount)"\s*:\s*"?(\d+)"?/i
    );
    if (m) {
      const count = parseInt(m[1], 10);
      if (Number.isFinite(count) && count > 0) {
        return { soldCountRaw: null, soldCount: count };
      }
    }
  }

  return { soldCountRaw: null, soldCount: null };
}

/**
 * Sayfa başlığından gelen SEO kuyruklarını temizler.
 * "Boya Tabancası Fiyatları ve ... 2026" / "... - Fiyatı, Yorumları, Özellikleri"
 */
export function cleanProductName(name: string | null): string | null {
  if (!name) return null;

  const cleaned = name
    .split(/\s+-\s+fiyat/i)[0]
    .replace(/\s*[|-]\s*Trendyol\s*$/i, "")
    .replace(/\s*\bFiyatlar[ıi]\s+ve\b.*$/i, "")
    .replace(/,?\s*(Yorumlar[ıi]|Özellikleri)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.length > 1 ? cleaned : name.trim();
}
