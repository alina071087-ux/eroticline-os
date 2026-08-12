import "server-only";

import { getSupabaseEnvConfig } from "@/lib/integrations/supabase/config";
import { createSupabaseAdminClient } from "@/lib/integrations/supabase/admin-client";
import type { SupabaseClient } from "@supabase/supabase-js";

export function getSupabaseServiceClient(): SupabaseClient {
  const config = getSupabaseEnvConfig();

  if (!config) {
    throw new Error("Supabase не настроен на сервере");
  }

  return createSupabaseAdminClient(config);
}
