# Proje notları (Claude için)

Next.js 14 App Router + TypeScript + Tailwind. Veri Supabase'de, cache Upstash
Redis'te. Vercel'de yayında, günlük cron ile fiyat tazeliyor.

## Komutlar

```bash
npm run dev
npm run build
npx tsc --noEmit    # değişiklikten sonra bunu çalıştır
```

Ayrı test suite'i yok; doğrulama = tip kontrolü + build.

## Konvansiyonlar

- Kod içi yorumlar ve kullanıcıya görünen metinler **Türkçe**.
- Yorum, "ne yaptığını" değil "neden böyle" olduğunu anlatır — mevcut dosyalardaki
  yoğunluğa uy, her satırı yorumlama.
- Path alias: `@/*` → repo kökü.

## Dikkat

- `SUPABASE_SERVICE_ROLE_KEY` RLS'i bypass eder: sadece `lib/supabase/server.ts`
  üzerinden, sadece server tarafında kullanılır. Client bileşenine sızdırma.
- Env değişkenleri modül seviyesinde değil, fonksiyon içinde okunur — build'in
  env'siz de geçmesi buna bağlı, bu yapıyı bozma.
- Scraper katmanı kırılgan: Trendyol/akakce HTML'i değişebilir. Parse hatalarında
  sessizce yutmak yerine anlamlı hata döndür, cron tek üründe patlamasın.
- Cron endpoint'i `CRON_SECRET` ile korunuyor; auth kontrolünü kaldırma.
- Vercel Hobby planı: fonksiyon süresi 60sn, cron günde 1 kez.
