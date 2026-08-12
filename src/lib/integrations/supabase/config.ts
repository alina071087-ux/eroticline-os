import "server-only";

import type { SupabaseEnvConfig } from "@/lib/integrations/supabase/types";

export function getPublishableKeyFromEnv(): string | null {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    null
  );
}

export function getSecretKeyFromEnv(): string | null {
  return (
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    null
  );
}

export function getMissingSupabaseEnvVars(): string[] {
  const missing: string[] = [];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!getPublishableKeyFromEnv()) {
    missing.push(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (или NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    );
  }

  if (!getSecretKeyFromEnv()) {
    missing.push("SUPABASE_SECRET_KEY (или SUPABASE_SERVICE_ROLE_KEY)");
  }

  return missing;
}

export function getSupabaseEnvConfig(): SupabaseEnvConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = getPublishableKeyFromEnv();
  const secretKey = getSecretKeyFromEnv();

  if (!url || !publishableKey || !secretKey) {
    return null;
  }

  return { url, publishableKey, secretKey };
}

export function parseSupabaseProject(
  url: string,
): { projectHost: string; projectRef: string } | null {
  try {
    const parsed = new URL(url);
    const projectHost = parsed.hostname;
    const match = /^([a-z0-9-]+)\.supabase\.co$/i.exec(projectHost);

    if (!match) {
      return null;
    }

    return {
      projectHost,
      projectRef: match[1],
    };
  } catch {
    return null;
  }
}
