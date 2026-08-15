import { createClient } from "@supabase/supabase-js";

/**
 * Sadece sunucu tarafında (API route, cron job) kullan.
 * service_role key RLS'i bypass eder, bu yüzden asla client'a sızdırma.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase env değişkenleri eksik: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
