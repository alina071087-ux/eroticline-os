import "server-only";

import type { IntegrationTestResult } from "@/lib/integrations/types";
import { getWbApiToken } from "@/lib/integrations/wb/config";
import { WbClient } from "@/lib/integrations/wb/client";
import { mapWbHttpError } from "@/lib/integrations/wb/errors";

function buildResult(
  partial: Omit<IntegrationTestResult, "source" | "checkedAt">,
): IntegrationTestResult {
  return {
    source: "wildberries",
    checkedAt: new Date().toISOString(),
    ...partial,
  };
}

function sanitizeSellerInfo(data: unknown): Record<string, unknown> | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }

  const record = data as Record<string, unknown>;
  const safe: Record<string, unknown> = {};

  if (typeof record.name === "string") safe.name = record.name;
  if (typeof record.tradeMark === "string") safe.tradeMark = record.tradeMark;
  if (typeof record.sid === "string") safe.sid = record.sid;

  return Object.keys(safe).length > 0 ? safe : { connected: true };
}

export async function testWbConnection(): Promise<IntegrationTestResult> {
  const token = getWbApiToken();

  if (!token) {
    return buildResult({
      status: "not_configured",
      configured: false,
      message: "Токен Wildberries не настроен",
      error: {
        code: "MISSING_TOKEN",
        message:
          "Переменная окружения WB_API_TOKEN не задана. Добавьте её в .env.local",
      },
    });
  }

  const client = new WbClient(token);
  const response = await client.getSellerInfo();

  if (response.error) {
    const error = mapWbHttpError(response.status, response.error);
    return buildResult({
      status: "error",
      configured: true,
      httpStatus: response.status || undefined,
      durationMs: response.durationMs,
      message: error.message,
      error,
    });
  }

  if (!response.ok) {
    const error = mapWbHttpError(response.status);
    return buildResult({
      status: "error",
      configured: true,
      httpStatus: response.status,
      durationMs: response.durationMs,
      message: error.message,
      error,
    });
  }

  if (response.data === null || response.data === undefined) {
    return buildResult({
      status: "error",
      configured: true,
      httpStatus: response.status,
      durationMs: response.durationMs,
      message: "Wildberries API вернул пустой ответ",
      error: {
        code: "EMPTY_RESPONSE",
        message: "Wildberries API вернул пустой ответ",
      },
    });
  }

  return buildResult({
    status: "ok",
    configured: true,
    httpStatus: response.status,
    durationMs: response.durationMs,
    message: "Подключение к Wildberries API успешно",
    data: sanitizeSellerInfo(response.data),
  });
}
