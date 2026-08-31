import "server-only";

import type { WbStockItem, WbStocksResult } from "@/lib/integrations/types";
import {
  buildChrtCatalog,
  computeLegacyTotalQuantity,
  computeRawTotalQuantity,
  enrichRawRowsToWbStockItems,
} from "@/lib/integrations/wb/chrt-stocks";
import { getWbApiToken } from "@/lib/integrations/wb/config";
import { fetchWbProductCardsForNmIds } from "@/lib/integrations/wb/product-cards";
import { fetchWbRawStockRows } from "@/lib/integrations/wb/raw-stocks";

const MISSING_FIELDS = ["lastChangeDate"] as const;

export type WbStocksFetchMeta = {
  totalStockRows: number;
  totalUniqueNmIds: number;
  uniqueChrtIds: number;
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
    uniqueChrtIds: partial.uniqueChrtIds ?? 0,
    pagesLoaded: partial.pagesLoaded ?? 0,
    isComplete: partial.isComplete ?? false,
    ...partial,
  };
}

function countUniqueChrtIds(rows: Array<{ chrtId: number | null }>): number {
  return new Set(
    rows.map((row) => row.chrtId).filter((value): value is number => value !== null),
  ).size;
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
      uniqueChrtIds: 0,
      pagesLoaded: 0,
      isComplete: false,
      error: {
        code: "MISSING_TOKEN",
        message:
          "Переменная окружения WB_API_TOKEN не задана. Добавьте её в .env.local",
      },
    });
  }

  const rawResult = await fetchWbRawStockRows();

  if (rawResult.error && rawResult.rows.length === 0) {
    return buildResult({
      status: "error",
      configured: true,
      httpStatus: rawResult.httpStatus,
      durationMs: rawResult.durationMs,
      count: 0,
      totalStockRows: 0,
      totalUniqueNmIds: 0,
      uniqueChrtIds: 0,
      pagesLoaded: rawResult.pagesLoaded,
      isComplete: false,
      missingFields: [...MISSING_FIELDS],
      message: rawResult.error.message,
      error: rawResult.error,
    });
  }

  const rawRows = rawResult.rows;

  if (rawRows.length === 0) {
    return buildResult({
      status: "error",
      configured: true,
      httpStatus: rawResult.httpStatus,
      durationMs: rawResult.durationMs,
      count: 0,
      totalStockRows: 0,
      totalUniqueNmIds: 0,
      uniqueChrtIds: 0,
      pagesLoaded: rawResult.pagesLoaded,
      isComplete: rawResult.isComplete,
      missingFields: [...MISSING_FIELDS],
      message: "Wildberries API вернул пустой список остатков",
      error: {
        code: "EMPTY_RESPONSE",
        message: "Wildberries API вернул пустой список остатков",
      },
    });
  }

  const targetNmIds = new Set(rawRows.map((row) => row.nmId));
  const cardsScan = await fetchWbProductCardsForNmIds(targetNmIds);
  const durationMs = rawResult.durationMs + cardsScan.durationMs;

  const catalog = buildChrtCatalog([...cardsScan.cards.values()]);
  const stocks: WbStockItem[] = enrichRawRowsToWbStockItems(rawRows, catalog);

  const totalQuantity = computeRawTotalQuantity(rawRows);
  const legacyTotalQuantity = computeLegacyTotalQuantity(rawRows);
  const totalInWayToClient = rawRows.reduce((sum, row) => sum + row.inWayToClient, 0);
  const totalInWayFromClient = rawRows.reduce(
    (sum, row) => sum + row.inWayFromClient,
    0,
  );

  const isComplete = rawResult.isComplete && cardsScan.isComplete;
  let status: WbStocksResult["status"] = "ok";
  let message =
    `Получено строк остатков: ${rawRows.length} (${rawResult.pagesLoaded} стр.), ` +
    `chrtId+склад: ${stocks.length}, chrtId: ${countUniqueChrtIds(rawRows)}.`;

  if (rawResult.error || cardsScan.error) {
    status = "ok";
    message = `Загружена часть остатков: ${rawRows.length} строк (${rawResult.pagesLoaded} стр.).`;
  }

  return buildResult({
    status,
    configured: true,
    httpStatus: rawResult.httpStatus ?? cardsScan.httpStatus,
    durationMs,
    count: stocks.length,
    totalStockRows: rawRows.length,
    totalUniqueNmIds: targetNmIds.size,
    uniqueChrtIds: countUniqueChrtIds(rawRows),
    totalQuantity,
    totalInWayToClient,
    totalInWayFromClient,
    legacyTotalQuantity,
    legacyTotalsMatch: totalQuantity === legacyTotalQuantity,
    pagesLoaded: rawResult.pagesLoaded,
    isComplete,
    missingFields: [...MISSING_FIELDS],
    message,
    stocks,
    ...(rawResult.error ? { error: rawResult.error } : {}),
  });
}
