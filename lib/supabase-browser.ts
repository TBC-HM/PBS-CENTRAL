import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/supabase-config";

let client: ReturnType<typeof createClient> | undefined;

export function getSupabaseBrowserClient() {
  const { url, publishableKey } = getSupabasePublicConfig();

  client ??= createClient(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return client;
}
