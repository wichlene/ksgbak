import { createClient } from "@supabase/supabase-js";

/**
 * Public/anon client — sadece okuma içindir (RLS: public select policy).
 * Yazma işlemleri her zaman server tarafındaki service client ile yapılmalı.
 */
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase env değişkenleri eksik: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false },
  });
}
