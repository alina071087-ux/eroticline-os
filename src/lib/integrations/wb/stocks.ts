import "server-only";

import type { WbStockItem, WbStocksResult } from "@/lib/integrations/types";
import { getWbApiToken } from "@/lib/integrations/wb/config";
import { WbClient } from "@/lib/integrations/wb/client";
import { mapWbHttpError } from "@/lib/integrations/wb/errors";

/** Rows per API page — WB allows up to 250 000; use 10 000 to balance payload and rate limits. */
const STOCKS_PAGE_SIZE = 10_000;

/** Safety cap against infinite pagination loops. */
const MAX_STOCK_ROWS = 100_000;

const STOCKS_FETCH_TIMEOUT_MS = 120_000;

const MISSING_FIELDS = [
  "vendorCode",
  "barcode",
  "techSize",
  "lastChangeDate",
] as const;

type RawStockRow = {
  nmID: number;
  chrtId: number | null;
  warehouseId: number | null;
  warehouseName: string;
  quantity: number;
  inWayToClient: number;
  inWayFromClient: number;
};

export type WbStocksFetchMeta = {
  totalStockRows: number;
  totalUniqueNmIds: number;
  pagesLoaded: number;
  isComplete: boolean;
};

type WbStocksResultWithMeta = WbStocksResult & WbStocksFetchMeta;

function buildResult(
  partial: Omit<WbStocksResult, "source" | "fetchedAt"> &
    Partial<WbStocksFetchMeta>,
): WbStocksResultWithMeta {
  return {
    source: "wildberries",
    fetchedAt: new Date().toISOString(),
    totalStockRows: partial.totalStockRows ?? partial.count ?? 0,
    totalUniqueNmIds: partial.totalUniqueNmIds ?? 0,
    pagesLoaded: partial.pagesLoaded ?? 0,
    isComplete: partial.isComplete ?? false,
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

function normalizeRawStock(raw: unknown): RawStockRow | null {
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
    chrtId: readChrtId(item),
    warehouseId: readWarehouseId(item),
    warehouseName:
      typeof item.warehouseName === "string" ? item.warehouseName : "",
    quantity: readNumber(item.quantity),
    inWayToClient: readNumber(item.inWayToClient),
    inWayFromClient: readNumber(item.inWayFromClient),
  };
}

function buildRawStockKey(row: RawStockRow): string {
  const chrtPart = row.chrtId ?? "none";
  const warehousePart = row.warehouseId ?? row.warehouseName;
  return `${row.nmID}:${chrtPart}:${warehousePart}`;
}

function aggregateRawStocksByNmIdAndWarehouse(
  rows: RawStockRow[],
): WbStockItem[] {
  const aggregated = new Map<string, WbStockItem>();

  for (const row of rows) {
    const key = `${row.nmID}:${row.warehouseName}`;
    const existing = aggregated.get(key);

    if (existing) {
      existing.quantity += row.quantity;
      existing.inWayToClient += row.inWayToClient;
      existing.inWayFromClient += row.inWayFromClient;
      continue;
    }

    aggregated.set(key, {
      nmID: row.nmID,
      vendorCode: null,
      barcode: null,
      techSize: null,
      warehouseName: row.warehouseName,
      quantity: row.quantity,
      inWayToClient: row.inWayToClient,
      inWayFromClient: row.inWayFromClient,
      lastChangeDate: null,
    });
  }

  return [...aggregated.values()];
}

function countUniqueNmIds(rows: RawStockRow[]): number {
  return new Set(rows.map((row) => row.nmID)).size;
}

export async function fetchWbStocks(): Promise<WbStocksResultWithMeta> {
  const token = getWbApiToken();

  if (!token) {
    return buildResult({
      status: "not_configured",
      configured: false,
      message: "Токен Wildberries не настроен",
      totalStockRows: 0,
      totalUniqueNmIds: 0,
      pagesLoaded: 0,
      isComplete: false,
      error: {
        code: "MISSING_TOKEN",
        message:
          "Переменная окружения WB_API_TOKEN не задана. Добавьте её в .env.local",
      },
    });
  }

  const client = new WbClient(token);
  const dedupeKeys = new Set<string>();
  const rawRows: RawStockRow[] = [];
  let offset = 0;
  let pagesLoaded = 0;
  let durationMs = 0;
  let lastHttpStatus: number | undefined;
  let stoppedEarly = false;
  let lastError: ReturnType<typeof mapWbHttpError> | undefined;

  while (rawRows.length < MAX_STOCK_ROWS) {
    const remainingCapacity = MAX_STOCK_ROWS - rawRows.length;
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
      .filter((item): item is RawStockRow => item !== null);

    for (const item of pageItems) {
      const key = buildRawStockKey(item);

      if (dedupeKeys.has(key)) {
        continue;
      }

      dedupeKeys.add(key);
      rawRows.push(item);

      if (rawRows.length >= MAX_STOCK_ROWS) {
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

  if (rawRows.length === 0) {
    if (lastError) {
      return buildResult({
        status: "error",
        configured: true,
        httpStatus: lastHttpStatus,
        durationMs,
        count: 0,
        totalStockRows: 0,
        totalUniqueNmIds: 0,
        pagesLoaded,
        isComplete: false,
        missingFields: [...MISSING_FIELDS],
        message: lastError.message,
        error: lastError,
      });
    }

    return buildResult({
      status: "error",
      configured: true,
      httpStatus: lastHttpStatus,
      durationMs,
      count: 0,
      totalStockRows: 0,
      totalUniqueNmIds: 0,
      pagesLoaded,
      isComplete: pagesLoaded > 0,
      missingFields: [...MISSING_FIELDS],
      message: "Wildberries API вернул пустой список остатков",
      error: {
        code: "EMPTY_RESPONSE",
        message: "Wildberries API вернул пустой список остатков",
      },
    });
  }

  const stocks = aggregateRawStocksByNmIdAndWarehouse(rawRows);
  const totalUniqueNmIds = countUniqueNmIds(rawRows);
  const isComplete = !stoppedEarly;

  return buildResult({
    status: "ok",
    configured: true,
    httpStatus: lastHttpStatus,
    durationMs,
    count: stocks.length,
    totalStockRows: rawRows.length,
    totalUniqueNmIds,
    pagesLoaded,
    isComplete,
    missingFields: [...MISSING_FIELDS],
    message: isComplete
      ? `Получено строк остатков: ${rawRows.length} (${pagesLoaded} стр.), агрегировано по nmID+склад: ${stocks.length}`
      : `Загружена часть остатков: ${rawRows.length} строк (${pagesLoaded} стр.)`,
    stocks,
  });
}
