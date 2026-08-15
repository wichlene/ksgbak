"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function UrlForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text.trim());
    } catch {
      setError("Panoya erişilemedi, linki elle yapıştır.");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Bir şeyler ters gitti");
        setLoading(false);
        return;
      }

      router.push(`/urun/${data.product.id}`);
    } catch {
      setError("Sunucuya ulaşılamadı, tekrar dene");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.trendyol.com/.../urun-adi-p-123456789"
            className="w-full rounded-xl border border-white/10 bg-bg-card px-5 py-4 pr-24 text-base text-gray-100 placeholder:text-gray-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            type="button"
            onClick={handlePaste}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-accent hover:text-accent"
          >
            Yapıştır
          </button>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-accent px-6 py-4 text-base font-semibold text-bg transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Aranıyor…" : "Fiyat Geçmişini Göster"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {loading && (
        <p className="mt-3 text-sm text-gray-500">
          Trendyol, cimri.com ve akakce.com taranıyor, bu birkaç saniye
          sürebilir…
        </p>
      )}
    </form>
  );
}
