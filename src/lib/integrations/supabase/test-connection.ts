import "server-only";

import {
  createSupabaseAdminClient,
  createSupabasePublishableClient,
} from "@/lib/integrations/supabase/admin-client";
import {
  getMissingSupabaseEnvVars,
  getSupabaseEnvConfig,
  parseSupabaseProject,
} from "@/lib/integrations/supabase/config";
import type { SupabaseTestResult } from "@/lib/integrations/supabase/types";

const REQUEST_TIMEOUT_MS = 15_000;
const PROBE_TABLE = "__supabase_connection_probe__";

function buildResult(
  partial: Omit<SupabaseTestResult, "source" | "checkedAt">,
): SupabaseTestResult {
  return {
    source: "supabase",
    checkedAt: new Date().toISOString(),
    ...partial,
  };
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function isInvalidApiKeyMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid api key") ||
    normalized.includes("invalid jwt") ||
    normalized.includes("apikey invalid")
  );
}

function isReachableProbeError(message: string, code?: string): boolean {
  if (code === "PGRST205" || code === "42P01") {
    return true;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("does not exist") ||
    normalized.includes("could not find the table") ||
    normalized.includes("schema cache")
  );
}

async function probePublishableKey(
  config: ReturnType<typeof getSupabaseEnvConfig> & object,
): Promise<{ ok: true; httpStatus: number } | { ok: false; reason: string }> {
  const client = createSupabasePublishableClient(config);
  const { error } = await client.from(PROBE_TABLE).select("id").limit(1);

  if (!error) {
    return { ok: true, httpStatus: 200 };
  }

  if (isInvalidApiKeyMessage(error.message)) {
    return { ok: false, reason: "Неверный publishable key Supabase" };
  }

  if (isReachableProbeError(error.message, error.code)) {
    return { ok: true, httpStatus: 200 };
  }

  return { ok: true, httpStatus: 200 };
}

async function probeSecretKey(
  config: ReturnType<typeof getSupabaseEnvConfig> & object,
): Promise<{ ok: true; httpStatus: number } | { ok: false; reason: string }> {
  const client = createSupabaseAdminClient(config);
  const { error } = await client.storage.listBuckets();

  if (!error) {
    return { ok: true, httpStatus: 200 };
  }

  if (isInvalidApiKeyMessage(error.message)) {
    return { ok: false, reason: "Неверный secret key Supabase" };
  }

  return { ok: false, reason: error.message || "Supabase не ответил на запрос" };
}

async function probeProjectHealth(
  config: ReturnType<typeof getSupabaseEnvConfig> & object,
): Promise<
  | { ok: true; httpStatus: number }
  | { ok: false; reason: string; code: "TIMEOUT" | "NETWORK_ERROR" | "API_ERROR" }
> {
  try {
    const response = await fetchWithTimeout(`${config.url}/auth/v1/health`, {
      headers: {
        apikey: config.publishableKey,
      },
      cache: "no-store",
    });

    if (response.ok) {
      return { ok: true, httpStatus: response.status };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        reason: "Supabase отклонил publishable key",
        code: "API_ERROR",
      };
    }

    return {
      ok: false,
      reason: `Supabase вернул HTTP ${response.status}`,
      code: "API_ERROR",
    };
  } catch (error) {
    if (isAbortError(error)) {
      return {
        ok: false,
        reason: "Превышено время ожидания ответа Supabase",
        code: "TIMEOUT",
      };
    }

    return {
      ok: false,
      reason: "Не удалось связаться с Supabase",
      code: "NETWORK_ERROR",
    };
  }
}

export async function testSupabaseConnection(): Promise<SupabaseTestResult> {
  const startedAt = Date.now();
  const missingEnv = getMissingSupabaseEnvVars();

  if (missingEnv.length > 0) {
    return buildResult({
      status: "error",
      configured: false,
      durationMs: Date.now() - startedAt,
      message: "Supabase не настроен",
      error: {
        code: "MISSING_CREDENTIALS",
        message: `Не заданы переменные окружения: ${missingEnv.join(", ")}`,
      },
    });
  }

  const config = getSupabaseEnvConfig();

  if (!config) {
    return buildResult({
      status: "error",
      configured: false,
      durationMs: Date.now() - startedAt,
      message: "Supabase не настроен",
      error: {
        code: "MISSING_CREDENTIALS",
        message: "Не удалось прочитать конфигурацию Supabase из env",
      },
    });
  }

  const project = parseSupabaseProject(config.url);

  if (!project) {
    return buildResult({
      status: "error",
      configured: true,
      durationMs: Date.now() - startedAt,
      message: "Неверный URL Supabase",
      error: {
        code: "API_ERROR",
        message:
          "NEXT_PUBLIC_SUPABASE_URL должен указывать на проект вида https://<ref>.supabase.co",
      },
    });
  }

  try {
    createSupabaseAdminClient(config);
    createSupabasePublishableClient(config);
  } catch {
    return buildResult({
      status: "error",
      configured: true,
      durationMs: Date.now() - startedAt,
      projectHost: project.projectHost,
      projectRef: project.projectRef,
      message: "Не удалось создать Supabase client",
      error: {
        code: "API_ERROR",
        message: "Не удалось создать серверный Supabase client",
      },
    });
  }

  const health = await probeProjectHealth(config);

  if (!health.ok) {
    return buildResult({
      status: "error",
      configured: true,
      durationMs: Date.now() - startedAt,
      projectHost: project.projectHost,
      projectRef: project.projectRef,
      message: health.reason,
      error: {
        code: health.code,
        message: health.reason,
      },
    });
  }

  const publishableProbe = await probePublishableKey(config);

  if (!publishableProbe.ok) {
    return buildResult({
      status: "error",
      configured: true,
      httpStatus: health.httpStatus,
      durationMs: Date.now() - startedAt,
      projectHost: project.projectHost,
      projectRef: project.projectRef,
      message: publishableProbe.reason,
      error: {
        code: "INVALID_TOKEN",
        message: publishableProbe.reason,
      },
    });
  }

  const secretProbe = await probeSecretKey(config);

  if (!secretProbe.ok) {
    return buildResult({
      status: "error",
      configured: true,
      httpStatus: health.httpStatus,
      durationMs: Date.now() - startedAt,
      projectHost: project.projectHost,
      projectRef: project.projectRef,
      message: secretProbe.reason,
      error: {
        code: "INVALID_TOKEN",
        message: secretProbe.reason,
      },
    });
  }

  return buildResult({
    status: "ok",
    configured: true,
    httpStatus: health.httpStatus,
    durationMs: Date.now() - startedAt,
    projectHost: project.projectHost,
    projectRef: project.projectRef,
    message: "Подключение к Supabase успешно",
  });
}
