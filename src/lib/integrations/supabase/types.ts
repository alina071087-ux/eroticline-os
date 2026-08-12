import type { IntegrationError } from "@/lib/integrations/types";

export type SupabaseTestResult = {
  source: "supabase";
  status: "ok" | "error";
  configured: boolean;
  checkedAt: string;
  httpStatus?: number;
  durationMs?: number;
  message?: string;
  projectHost?: string;
  projectRef?: string;
  error?: IntegrationError;
};

export type SupabaseEnvConfig = {
  url: string;
  publishableKey: string;
  secretKey: string;
};
