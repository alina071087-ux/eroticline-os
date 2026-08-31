import "server-only";

import type { IntegrationError } from "@/lib/integrations/types";
import { getWbApiToken } from "@/lib/integrations/wb/config";
import { WbClient } from "@/lib/integrations/wb/client";
import { mapWbHttpError } from "@/lib/integrations/wb/errors";

const STOCKS_PAGE_SIZE = 10_000;
const MAX_STOCK_ROWS = 100_000;
const STOCKS_FETCH_TIMEOUT_MS = 120_000;

export type WbRawStockRow = {
  nmId: number;
  chrtId: number | null;
  warehouseId: number | null;
  warehouseName: string;
  quantity: number;
  inWayToClient: number;
  inWayFromClient: number;
};

export type WbRawStocksFetchResult = {
  rows: WbRawStockRow[];
  pagesLoaded: number;
  durationMs: number;
  httpStatus?: number;
  isComplete: boolean;
  error?: IntegrationError;
};

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

function readChrtId(item: Record<string, unknown>): number | null {
  const chrtId = item.chrtId ?? item.chrtID;

  if (typeof chrtId === "number" && Number.isFinite(chrtId)) {
    return chrtId;
  }

  if (typeof chrtId === "string" && chrtId.trim() !== "") {
    const parsed = Number(chrtId);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readWarehouseId(item: Record<string, unknown>): number | null {
  const warehouseId = item.warehouseId ?? item.warehouseID;

  if (typeof warehouseId === "number" && Number.isFinite(warehouseId)) {
    return warehouseId;
  }

  if (typeof warehouseId === "string" && warehouseId.trim() !== "") {
    const parsed = Number(warehouseId);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeRawStock(raw: unknown): WbRawStockRow | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const item = raw as Record<string, unknown>;
  const nmId = readNmId(item);

  if (nmId === null) {
    return null;
  }

  return {
    nmId,
    chrtId: readChrtId(item),
    warehouseId: readWarehouseId(item),
    warehouseName:
      typeof item.warehouseName === "string" ? item.warehouseName : "",
    quantity: readNumber(item.quantity),
    inWayToClient: readNumber(item.inWayToClient),
    inWayFromClient: readNumber(item.inWayFromClient),
  };
}

function buildRawStockKey(row: WbRawStockRow): string {
  const chrtPart = row.chrtId ?? "none";
  const warehousePart = row.warehouseId ?? row.warehouseName;
  return `${row.nmId}:${chrtPart}:${warehousePart}`;
}

export const WB_SIZE_STOCK_ENDPOINT =
  "/api/analytics/v1/stocks-report/wb-warehouses";

export async function fetchWbRawStockRows(): Promise<WbRawStocksFetchResult> {
  const token = getWbApiToken();

  if (!token) {
    return {
      rows: [],
      pagesLoaded: 0,
      durationMs: 0,
      isComplete: false,
      error: {
        code: "MISSING_TOKEN",
        message:
          "Переменная окружения WB_API_TOKEN не задана. Добавьте её в .env.local",
      },
    };
  }

  const client = new WbClient(token);
  const dedupeKeys = new Set<string>();
  const rows: WbRawStockRow[] = [];
  let offset = 0;
  let pagesLoaded = 0;
  let durationMs = 0;
  let lastHttpStatus: number | undefined;
  let stoppedEarly = false;
  let lastError: IntegrationError | undefined;

  while (rows.length < MAX_STOCK_ROWS) {
    const remainingCapacity = MAX_STOCK_ROWS - rows.length;
    const pageLimit = Math.min(STOCKS_PAGE_SIZE, remainingCapacity);

    const response = await client.getWbWarehouseStocksReport(
      pageLimit,
      offset,
      STOCKS_FETCH_TIMEOUT_MS,
    );

    durationMs += response.durationMs;
    lastHttpStatus = response.status || lastHttpStatus;
    pagesLoaded += 1;

    if (response.error) {
      lastError = mapWbHttpError(response.status, response.error);
      stoppedEarly = true;
      break;
    }

    if (!response.ok) {
      lastError = mapWbHttpError(response.status);
      stoppedEarly = true;
      break;
    }

    const pageItems = extractStockItems(response.data)
      .map(normalizeRawStock)
      .filter((item): item is WbRawStockRow => item !== null);

    for (const item of pageItems) {
      const key = buildRawStockKey(item);

      if (dedupeKeys.has(key)) {
        continue;
      }

      dedupeKeys.add(key);
      rows.push(item);

      if (rows.length >= MAX_STOCK_ROWS) {
        stoppedEarly = true;
        break;
      }
    }

    if (stoppedEarly) {
      break;
    }

    if (pageItems.length < pageLimit) {
      break;
    }

    offset += pageItems.length;
  }

  if (rows.length === 0 && lastError) {
    return {
      rows: [],
      pagesLoaded,
      durationMs,
      httpStatus: lastHttpStatus,
      isComplete: false,
      error: lastError,
    };
  }

  return {
    rows,
    pagesLoaded,
    durationMs,
    httpStatus: lastHttpStatus,
    isComplete: !stoppedEarly,
    ...(lastError ? { error: lastError } : {}),
  };
}

export function aggregateNmIdQuantityOldMethod(rows: WbRawStockRow[], nmId: number): number {
  const byWarehouse = new Map<string, number>();

  for (const row of rows) {
    if (row.nmId !== nmId) {
      continue;
    }

    const key = row.warehouseName;
    byWarehouse.set(key, (byWarehouse.get(key) ?? 0) + row.quantity);
  }

  return [...byWarehouse.values()].reduce((sum, value) => sum + value, 0);
}

export function sumNmIdQuantityByChrtId(rows: WbRawStockRow[], nmId: number): number {
  return rows
    .filter((row) => row.nmId === nmId)
    .reduce((sum, row) => sum + row.quantity, 0);
}
