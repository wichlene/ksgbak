# Trendyol Fiyat Takip

Trendyol ürün linkini yapıştır, ürünün fiyat geçmişini ay ay grafikte gör.
Kaydı olmayan ürün izlemeye alınır ve fiyatı her gün otomatik güncellenir.

Yayında: <https://ksgbak.vercel.app>

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind
- **Supabase** — ürün ve fiyat geçmişi tablosu
- **Upstash Redis** — scrape sonuçları için cache (opsiyonel)
- **cheerio** — Trendyol / akakce / cimri / Wayback sayfalarını parse eder
- **recharts** — fiyat grafiği
- **Vercel** — hosting + günlük cron

## Geliştirme

```bash
npm install
cp .env.example .env.local   # değerleri doldur (bkz. SETUP.md)
npm run dev                  # http://localhost:3000
```

Diğer komutlar:

```bash
npm run build     # production build
npx tsc --noEmit  # tip kontrolü
```

## Dizin yapısı

```
app/
  page.tsx                 giriş — URL formu
  urun/[id]/page.tsx       ürün detayı + grafikler (force-dynamic)
  api/track                URL'den ürün ekleme / güncelleme
  api/backfill             geçmiş fiyat verisini doldurma
  api/cron/track-all       Vercel cron — izlenen tüm ürünleri tazeler
lib/
  scraper/                 trendyol, akakce, cimri, wayback kaynakları
  db/                      Supabase sorguları
  cache/                   Upstash Redis sarmalayıcı
  supabase/                server (service_role) ve browser (anon) client'ları
components/                grafikler, kartlar, form
supabase/migrations/       şema SQL dosyaları
```

## Kurulum / yetkilendirme

GitHub Actions, Claude ve Vercel bağlantısı için: **[SETUP.md](./SETUP.md)**

## CI

Her push ve PR'da `tsc --noEmit` + `next build` çalışır. PR'lara `@claude` yazarak
Claude'dan değişiklik isteyebilirsin; açılan her PR ayrıca otomatik incelenir.
