import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/supabase-config";

let client: ReturnType<typeof createBrowserClient> | undefined;

export function getSupabaseBrowserClient() {
  const { url, publishableKey } = getSupabasePublicConfig();

  client ??= createBrowserClient(url, publishableKey);
  return client;
}
