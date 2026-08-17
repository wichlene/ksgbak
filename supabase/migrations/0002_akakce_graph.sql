-- 1) akakce uzun vadeli fiyat seyrini sayı olarak vermiyor, hazır bir grafik
--    görseli üretiyor. Sayısal geçmişimiz kısa olduğu için o görseli de
--    saklayıp ürün sayfasında gösteriyoruz.
alter table products add column if not exists source_url text;
alter table products add column if not exists graph_image_url text;

-- 2) archive.org (Wayback Machine) üzerinden geçmişe dönük fiyat verisi
--    çekiyoruz; yeni bir kaynak türü olarak 'wayback' ekleniyor.
alter table products
  add column if not exists wayback_backfilled_at timestamptz;

alter table price_history drop constraint if exists price_history_source_check;
alter table price_history add constraint price_history_source_check
  check (source in ('cimri', 'akakce', 'internal', 'wayback'));

alter table products drop constraint if exists products_price_source_check;
alter table products add constraint products_price_source_check
  check (price_source in ('cimri', 'akakce', 'internal', 'wayback'));

-- 3) Trigger düzeltmesi: arşivden gelen ESKİ tarihli fiyatlar eklendiğinde
--    current_price/last_checked_at bunlarla ezilmemeli. Yalnızca gelen gözlem
--    elimizdekinden daha yeniyse "güncel fiyat" güncellenir; en düşük/en yüksek
--    ise her gözlemden hesaplanmaya devam eder.
create or replace function update_product_price_stats()
returns trigger as $$
begin
  update products
  set
    current_price = case
      when last_checked_at is null or new.recorded_at >= last_checked_at
        then new.price
        else current_price
    end,
    lowest_price = least(coalesce(lowest_price, new.price), new.price),
    highest_price = greatest(coalesce(highest_price, new.price), new.price),
    last_checked_at = greatest(
      coalesce(last_checked_at, new.recorded_at),
      new.recorded_at
    )
  where id = new.product_id;
  return new;
end;
$$ language plpgsql;
