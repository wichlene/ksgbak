"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Ürün sayfası açıldığında archive.org taramasını bir kez tetikler.
 * Tarama 30-60sn sürebildiği için /api/track'ten ayrı tutuldu: sayfa hemen
 * açılır, geçmiş arkadan dolar ve bitince sayfa tazelenir.
 */
export function BackfillTrigger({ productId }: { productId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"running" | "done" | "none">("running");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId }),
        });
        const data = await res.json();
        if (cancelled) return;

        if (res.ok && data.added > 0) {
          setState("done");
          router.refresh();
        } else {
          setState("none");
        }
      } catch {
        if (!cancelled) setState("none");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId, router]);

  if (state === "done") return null;

  return (
    <p className="text-xs text-gray-500">
      {state === "running"
        ? "İnternet Arşivi'nde geçmiş fiyatlar aranıyor, bu bir dakika sürebilir…"
        : "İnternet Arşivi'nde bu ürüne ait eski kayıt bulunamadı."}
    </p>
  );
}
