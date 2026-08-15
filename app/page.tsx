import { UrlForm } from "@/components/UrlForm";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-24 text-center">
      <div className="space-y-3">
        <span className="inline-block rounded-full border border-white/10 px-3 py-1 text-xs text-gray-400">
          Trendyol Fiyat Takip
        </span>
        <h1 className="text-3xl font-bold text-gray-50 sm:text-4xl">
          Trendyol ürününün fiyat geçmişini gör
        </h1>
        <p className="mx-auto max-w-lg text-gray-400">
          Ürün linkini yapıştır, cimri.com ve akakce.com&apos;daki fiyat
          geçmişini bulalım. Bulamazsak biz izlemeye alırız.
        </p>
      </div>

      <UrlForm />
    </main>
  );
}
