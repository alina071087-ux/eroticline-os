import "server-only";

import type { IntegrationError } from "@/lib/integrations/types";
import { OzonClient } from "@/lib/integrations/ozon/client";
import { getOzonCredentials } from "@/lib/integrations/ozon/config";
import { mapOzonHttpError } from "@/lib/integrations/ozon/errors";

type OzonDiagnostics = {
  httpStatus: number;
  errorCode?: string | number;
  message?: string;
};

export type OzonTestResult = {
  source: "ozon";
  status: "ok" | "error";
  configured: boolean;
  checkedAt: string;
  httpStatus?: number;
  durationMs?: number;
  message?: string;
  connected?: boolean;
  warehouseCount?: number;
  error?: IntegrationError;
  diagnostics?: OzonDiagnostics;
};

function buildResult(
  partial: Omit<OzonTestResult, "source" | "checkedAt">,
): OzonTestResult {
  return {
    source: "ozon",
    checkedAt: new Date().toISOString(),
    ...partial,
  };
}

function extractWarehouses(data: unknown): unknown[] | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }

  const record = data as Record<string, unknown>;
  const result = record.result;

  if (Array.isArray(result)) {
    return result;
  }

  if (result && typeof result === "object") {
    const warehouses = (result as Record<string, unknown>).warehouses;
    if (Array.isArray(warehouses)) {
      return warehouses;
    }
  }

  if (Array.isArray(record.warehouses)) {
    return record.warehouses;
  }

  return undefined;
}

function extractOzonDiagnostics(
  httpStatus: number,
  data: unknown,
): OzonDiagnostics | undefined {
  if (!data || typeof data !== "object") {
    return httpStatus > 0 ? { httpStatus } : undefined;
  }

  const record = data as Record<string, unknown>;
  const diagnostics: OzonDiagnostics = { httpStatus };

  if (typeof record.code === "number" || typeof record.code === "string") {
    diagnostics.errorCode = record.code;
  }

  if (typeof record.message === "string" && record.message.trim()) {
    diagnostics.message = record.message.trim().slice(0, 500);
  }

  return diagnostics;
}

export async function testOzonConnection(): Promise<OzonTestResult> {
  const credentials = getOzonCredentials();

  if (!credentials) {
    return buildResult({
      status: "error",
      configured: false,
      message: "Учётные данные Ozon не настроены",
      error: {
        code: "MISSING_CREDENTIALS",
        message:
          "Переменные окружения OZON_CLIENT_ID и OZON_API_KEY не заданы. Добавьте их в .env.local",
      },
    });
  }

  const client = new OzonClient(credentials.clientId, credentials.apiKey);
  const response = await client.listWarehouses();

  if (response.error) {
    const error = mapOzonHttpError(response.status, response.error);
    return buildResult({
      status: "error",
      configured: true,
      httpStatus: response.status || undefined,
      durationMs: response.durationMs,
      message: error.message,
      error,
      diagnostics: extractOzonDiagnostics(response.status, response.data),
    });
  }

  if (!response.ok) {
    const error = mapOzonHttpError(response.status);
    const diagnostics = extractOzonDiagnostics(response.status, response.data);

    return buildResult({
      status: "error",
      configured: true,
      httpStatus: response.status,
      durationMs: response.durationMs,
      message: diagnostics?.message ?? error.message,
      error,
      diagnostics,
    });
  }

  if (response.data === null || response.data === undefined) {
    return buildResult({
      status: "error",
      configured: true,
      httpStatus: response.status,
      durationMs: response.durationMs,
      message: "Ozon Seller API вернул пустой ответ",
      error: {
        code: "EMPTY_RESPONSE",
        message: "Ozon Seller API вернул пустой ответ",
      },
      diagnostics: extractOzonDiagnostics(response.status, response.data),
    });
  }

  const warehouses = extractWarehouses(response.data);
  const warehouseCount = warehouses?.length ?? 0;

  return buildResult({
    status: "ok",
    configured: true,
    httpStatus: response.status,
    durationMs: response.durationMs,
    message: "Подключение к Ozon Seller API успешно",
    connected: true,
    warehouseCount,
  });
}
