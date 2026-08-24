# Kurulum ve Yetkilendirme

Bu dosya, projeyi **GitHub + Claude + Vercel** üzerinde çalışır hale getirmek için
gereken yetkilendirme adımlarını anlatır. Sıra önemli değil, ama en hızlısı yukarıdan
aşağı gitmek.

Kod tarafı hazır: `.github/workflows/` altındaki workflow'lar secret'lar eklenince
kendiliğinden devreye girer. Secret yoksa hata vermez, uyarı bırakıp atlanır.

---

## 1. GitHub

Repo: <https://github.com/wichlene/ksgbak> — default branch `claude/trendyol-price-tracker-1rrpy1`.

Eklenen workflow'lar:

| Dosya | Ne yapar | Tetikleyici |
|---|---|---|
| `.github/workflows/ci.yml` | `tsc --noEmit` + `next build` | her push / PR |
| `.github/workflows/claude.yml` | Yorumda `@claude` geçince Claude çalışır | issue / PR yorumu |
| `.github/workflows/claude-code-review.yml` | Her PR'ı Claude otomatik inceler | PR açılışı / güncellemesi |
| `.github/workflows/vercel-deploy.yml` | Actions üzerinden Vercel deploy (opsiyonel) | push / PR |

Secret ekleme yeri (hepsi için aynı):
**Settings → Secrets and variables → Actions → New repository secret**
<https://github.com/wichlene/ksgbak/settings/secrets/actions>

---

## 2. Claude yetkilendirmesi

İki parça var: **App** (Claude'un repo'ya erişimi) ve **token** (Actions'ın Claude'a erişimi).

### 2.1 Claude GitHub App'i kur

Claude Code terminalinde:

```bash
/install-github-app
```

Ya da elle: <https://github.com/apps/claude> → **Install** → `wichlene/ksgbak` seç.

### 2.2 Token secret'ını ekle

İki seçenekten **birini** kullan:

**A) Claude Pro / Max aboneliğin varsa (önerilen, ek ücret yok):**

```bash
claude setup-token
```

Çıkan değeri `CLAUDE_CODE_OAUTH_TOKEN` adıyla repo secret'ı olarak ekle.

**B) Anthropic Console API anahtarı ile (kullandıkça öde):**

<https://console.anthropic.com/settings/keys> → anahtar oluştur →
`ANTHROPIC_API_KEY` adıyla secret olarak ekle.

### 2.3 Actions yazma izni

Claude'un PR açıp commit atabilmesi için:
**Settings → Actions → General → Workflow permissions → Read and write permissions**
ve **Allow GitHub Actions to create and approve pull requests** işaretli olmalı.
<https://github.com/wichlene/ksgbak/settings/actions>

### 2.4 Test

Herhangi bir issue veya PR'a şunu yaz:

```
@claude bu repoda ne var, kısaca özetler misin?
```

Actions sekmesinde "Claude" workflow'unun çalıştığını görmelisin.

---

## 3. Vercel yetkilendirmesi

Proje şu an <https://ksgbak.vercel.app> adresinde yayında. İki yol var:

### A) Vercel Git entegrasyonu (önerilen — muhtemelen zaten bağlı)

<https://vercel.com/new> → **Import Git Repository** → `wichlene/ksgbak`.
İlk seferde GitHub hesabını yetkilendirmen ve repo erişimi vermen istenir.

- Framework: **Next.js** (otomatik algılanır)
- Production branch: Vercel proje ayarlarında **Git → Production Branch** alanının
  `claude/trendyol-price-tracker-1rrpy1` olduğundan emin ol (default branch bu).

Bu yolu seçersen `vercel-deploy.yml` workflow'una dokunma; secret eklemediğin
sürece kendiliğinden atlanır ve çift deploy olmaz.

### B) GitHub Actions üzerinden deploy

Deploy'u Actions'ın yönetmesini istiyorsan şu üç secret'ı ekle:

| Secret | Nereden alınır |
|---|---|
| `VERCEL_TOKEN` | <https://vercel.com/account/tokens> → Create Token |
| `VERCEL_ORG_ID` | Vercel proje → Settings → General (ya da `vercel link` sonrası `.vercel/project.json`) |
| `VERCEL_PROJECT_ID` | Aynı yer |

Yerelden ID'leri almak için:

```bash
npx vercel link      # projeyi bağlar
cat .vercel/project.json
```

`.vercel/` klasörü `.gitignore`'da — commit etme.

Bu yolu seçersen Vercel panelinden Git entegrasyonunu kapat
(**Settings → Git → Disconnect**), yoksa her push'ta iki deploy tetiklenir.

---

## 4. Ortam değişkenleri (Vercel)

**Vercel → Project → Settings → Environment Variables** altına ekle
(Production + Preview + Development, hepsini işaretle):

| Değişken | Zorunlu | Nereden |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Aynı sayfa (anon/public key) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Aynı sayfa — **gizli**, sadece sunucuda kullanılır |
| `CRON_SECRET` | ✅ | Kendin üret: `openssl rand -hex 32` |
| `UPSTASH_REDIS_REST_URL` | ➖ | Upstash konsolu (yoksa cache'siz çalışır) |
| `UPSTASH_REDIS_REST_TOKEN` | ➖ | Aynı yer |
| `SCRAPER_API_KEY` | ➖ | scraperapi.com (bot korumasını aşmak için) |

Yerelde çalışmak için `.env.example` dosyasını `.env.local` olarak kopyala ve doldur.

> `SUPABASE_SERVICE_ROLE_KEY` RLS'i bypass eder. Asla `NEXT_PUBLIC_` öneki verme,
> asla client bileşeninde kullanma.

---

## 5. Cron

`vercel.json` içinde tanımlı:

```json
{ "path": "/api/cron/track-all", "schedule": "0 0 * * *" }
```

UTC 00:00 = TR saatiyle 03:00. Vercel, `CRON_SECRET` tanımlıysa isteğe
`Authorization: Bearer <CRON_SECRET>` header'ını otomatik ekler; endpoint bunu
doğrular. Yani **`CRON_SECRET` tanımlı değilse cron 401 döner.**

Elle test:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://ksgbak.vercel.app/api/cron/track-all
```

Hobby planında cron günde 1 kez çalışır — mevcut ayar bununla uyumlu.

---

## 6. Supabase şeması

`supabase/migrations/` altındaki SQL dosyalarını sırayla Supabase SQL Editor'da çalıştır:

1. `0001_init.sql`
2. `0002_akakce_graph.sql`

---

## 7. Kontrol listesi

- [ ] Claude GitHub App kurulu
- [ ] `CLAUDE_CODE_OAUTH_TOKEN` **veya** `ANTHROPIC_API_KEY` secret'ı eklendi
- [ ] Actions workflow izni "Read and write"
- [ ] Vercel projesi repo'ya bağlı (veya `VERCEL_*` secret'ları eklendi)
- [ ] Vercel env değişkenleri girildi (`CRON_SECRET` dahil)
- [ ] Supabase migration'ları çalıştırıldı
- [ ] Bir PR açıldığında CI yeşil ve Claude yorum bırakıyor
