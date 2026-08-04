import "server-only";

import type { WbStockItem, WbStocksResult } from "@/lib/integrations/types";
import { getWbApiToken } from "@/lib/integrations/wb/config";
import { WbClient } from "@/lib/integrations/wb/client";
import { mapWbHttpError } from "@/lib/integrations/wb/errors";

const MAX_STOCKS = 100;

const MISSING_FIELDS = [
  "vendorCode",
  "barcode",
  "techSize",
  "lastChangeDate",
] as const;

function buildResult(
  partial: Omit<WbStocksResult, "source" | "fetchedAt">,
): WbStocksResult {
  return {
    source: "wildberries",
    fetchedAt: new Date().toISOString(),
    ...partial,
  };
}

function extractStockItems(data: unknown): unknown[] {
  if (!data || typeof data !== "object") {
    return [];
  }

  const record = data as Record<string, unknown>;
  const inner = record.data;

  if (!inner || typeof inner !== "object") {
    return [];
  }

  const dataRecord = inner as Record<string, unknown>;

  if (Array.isArray(dataRecord.items)) {
    return dataRecord.items;
  }

  return [];
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readNmId(item: Record<string, unknown>): number | null {
  const nmID = item.nmId ?? item.nmID;

  if (typeof nmID === "number" && Number.isFinite(nmID)) {
    return nmID;
  }

  if (typeof nmID === "string" && nmID.trim() !== "") {
    const parsed = Number(nmID);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeStock(raw: unknown): WbStockItem | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const item = raw as Record<string, unknown>;
  const nmID = readNmId(item);

  if (nmID === null) {
    return null;
  }

  return {
    nmID,
    vendorCode: null,
    barcode: null,
    techSize: null,
    warehouseName:
      typeof item.warehouseName === "string" ? item.warehouseName : "",
    quantity: readNumber(item.quantity),
    inWayToClient: readNumber(item.inWayToClient),
    inWayFromClient: readNumber(item.inWayFromClient),
    lastChangeDate: null,
  };
}

export async function fetchWbStocks(
  limit = MAX_STOCKS,
): Promise<WbStocksResult> {
  const token = getWbApiToken();
  const safeLimit = Math.min(Math.max(1, limit), MAX_STOCKS);

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
  const response = await client.getWbWarehouseStocksReport(safeLimit, 0);

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

  const stocks = extractStockItems(response.data)
    .map(normalizeStock)
    .filter((item): item is WbStockItem => item !== null)
    .slice(0, safeLimit);

  if (stocks.length === 0) {
    return buildResult({
      status: "error",
      configured: true,
      httpStatus: response.status,
      durationMs: response.durationMs,
      count: 0,
      missingFields: [...MISSING_FIELDS],
      message: "Wildberries API вернул пустой список остатков",
      error: {
        code: "EMPTY_RESPONSE",
        message: "Wildberries API вернул пустой список остатков",
      },
    });
  }

  return buildResult({
    status: "ok",
    configured: true,
    httpStatus: response.status,
    durationMs: response.durationMs,
    count: stocks.length,
    missingFields: [...MISSING_FIELDS],
    message: `Получено записей об остатках: ${stocks.length}`,
    stocks,
  });
}
