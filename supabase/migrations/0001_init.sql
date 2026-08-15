-- Trendyol Fiyat Takip - başlangıç şeması
-- products: takip edilen her ürün için tek satır (Trendyol URL'i ile eşsiz)
-- price_history: her fiyat gözlemi (cimri/akakce scrape'i veya kendi cron taramamız)

create extension if not exists pgcrypto;

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  trendyol_url text not null unique,
  trendyol_product_id text,
  name text,
  brand text,
  image_url text,

  current_price numeric(12,2),
  lowest_price numeric(12,2),
  highest_price numeric(12,2),

  sold_count_raw text,        -- Trendyol'un gösterdiği ham metin: "10 bin adet satıldı"
  sold_count integer,         -- ham metinden parse edilen yaklaşık sayı (10000)

  price_source text not null default 'internal'
    check (price_source in ('cimri', 'akakce', 'internal')),
  status text not null default 'tracking'
    check (status in ('active', 'tracking', 'not_found')),

  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists price_history (
  id bigint generated always as identity primary key,
  product_id uuid not null references products(id) on delete cascade,
  price numeric(12,2) not null,
  source text not null check (source in ('cimri', 'akakce', 'internal')),
  recorded_at timestamptz not null default now()
);

create index if not exists price_history_product_id_recorded_at_idx
  on price_history (product_id, recorded_at desc);

-- updated_at otomatik güncellensin
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_set_updated_at on products;
create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

-- price_history'ye her yeni kayıt eklendiğinde products.current_price /
-- lowest_price / highest_price / last_checked_at otomatik güncellensin.
-- Böylece uygulama kodu sadece price_history'ye insert atar, stats hesaplamaz.
create or replace function update_product_price_stats()
returns trigger as $$
begin
  update products
  set
    current_price = new.price,
    lowest_price = least(coalesce(lowest_price, new.price), new.price),
    highest_price = greatest(coalesce(highest_price, new.price), new.price),
    last_checked_at = new.recorded_at
  where id = new.product_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists price_history_update_product_stats on price_history;
create trigger price_history_update_product_stats
  after insert on price_history
  for each row execute function update_product_price_stats();

-- Row Level Security: herkes okuyabilir, yazma sadece service_role (API route'lar) ile.
alter table products enable row level security;
alter table price_history enable row level security;

drop policy if exists "Public read access" on products;
create policy "Public read access" on products
  for select using (true);

drop policy if exists "Public read access" on price_history;
create policy "Public read access" on price_history
  for select using (true);
