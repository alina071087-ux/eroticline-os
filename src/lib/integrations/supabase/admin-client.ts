import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseEnvConfig } from "@/lib/integrations/supabase/types";

export function createSupabaseAdminClient(
  config: SupabaseEnvConfig,
): SupabaseClient {
  return createClient(config.url, config.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createSupabasePublishableClient(
  config: SupabaseEnvConfig,
): SupabaseClient {
  return createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
