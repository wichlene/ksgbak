-- akakce uzun vadeli fiyat seyrini sayı olarak vermiyor, hazır bir grafik
-- görseli üretiyor. Sayısal geçmişimiz kısa olduğu için o görseli de saklayıp
-- ürün sayfasında gösteriyoruz.

alter table products add column if not exists source_url text;
alter table products add column if not exists graph_image_url text;
