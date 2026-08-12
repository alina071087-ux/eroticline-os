import "server-only";

import type { IntegrationError } from "@/lib/integrations/types";
import { OzonClient } from "@/lib/integrations/ozon/client";
import { getOzonCredentials } from "@/lib/integrations/ozon/config";
import { mapOzonHttpError } from "@/lib/integrations/ozon/errors";
import {
  computeAvailable,
  extractResult,
  OZON_MAX_PAGES,
  OZON_MAX_STOCK_ROWS,
  OZON_STOCKS_PAGE_SIZE,
  readNumber,
  readProductId,
  readString,
} from "@/lib/integrations/ozon/helpers";
import {
  auditStockTypes,
  buildTotalsByType,
  normalizeStockType,
} from "@/lib/integrations/ozon/stock-audit";
import type {
  OzonStockItem,
  OzonStocksResult,
  OzonStockTotals,
} from "@/lib/integrations/ozon/types";
import type { OzonRequestDiagnostic } from "@/lib/integrations/ozon/diagnostics";
import { buildOzonRequestDiagnostic } from "@/lib/integrations/ozon/diagnostics";

function buildResult(
  partial: Omit<OzonStocksResult, "source" | "fetchedAt">,
): OzonStocksResult {
  return {
    source: "ozon",
    fetchedAt: new Date().toISOString(),
    ...partial,
  };
}

function emptyTotals(): OzonStockTotals {
  return {
    present: 0,
    reserved: 0,
    available: 0,
    totalsByType: {},
  };
}

function notConfiguredResult(): OzonStocksResult {
  return buildResult({
    status: "not_configured",
    configured: false,
    message: "Учётные данные Ozon не настроены",
    totalStockRows: 0,
    totalUniqueProducts: 0,
    pagesLoaded: 0,
    isComplete: false,
    stockTypes: [],
    totals: emptyTotals(),
    error: {
      code: "MISSING_CREDENTIALS",
      message:
        "Переменные окружения OZON_CLIENT_ID и OZON_API_KEY не заданы. Добавьте их в .env.local",
    },
  });
}

function buildStockKey(item: OzonStockItem): string {
  const warehousePart = item.warehouseId ?? item.warehouseName ?? "none";
  return `${item.productId}:${item.offerId}:${item.stockType}:${warehousePart}`;
}

function sumTotals(rows: OzonStockItem[]): OzonStockTotals {
  return {
    present: rows.reduce((sum, row) => sum + row.present, 0),
    reserved: rows.reduce((sum, row) => sum + row.reserved, 0),
    available: rows.reduce((sum, row) => sum + row.available, 0),
    totalsByType: buildTotalsByType(rows),
  };
}

function normalizeInfoStocksRows(raw: unknown): OzonStockItem[] {
  if (!raw || typeof raw !== "object") {
    return [];
  }

  const item = raw as Record<string, unknown>;
  const productId = readProductId(item.product_id ?? item.productId);

  if (productId === null) {
    return [];
  }

  const offerId = readString(item.offer_id ?? item.offerId);
  const stocks = Array.isArray(item.stocks) ? item.stocks : [];
  const rows: OzonStockItem[] = [];

  for (const stockRaw of stocks) {
    if (!stockRaw || typeof stockRaw !== "object") {
      continue;
    }

    const stock = stockRaw as Record<string, unknown>;
    const present = readNumber(stock.present);
    const reserved = readNumber(stock.reserved);
    const stockType = normalizeStockType(stock.type);
    const warehouseIds = Array.isArray(stock.warehouse_ids)
      ? stock.warehouse_ids
          .map((value) => readProductId(value))
          .filter((value): value is number => value !== null)
      : [];

    if (warehouseIds.length === 0) {
      rows.push({
        productId,
        offerId,
        present,
        reserved,
        available: computeAvailable(present, reserved),
        stockType,
      });
      continue;
    }

    for (const warehouseId of warehouseIds) {
      rows.push({
        productId,
        offerId,
        warehouseId,
        present,
        reserved,
        available: computeAvailable(present, reserved),
        stockType,
      });
    }
  }

  return rows;
}

function extractInfoStocksPage(data: unknown): {
  items: unknown[];
  cursor?: string;
} {
  const result = extractResult(data);
  const items = Array.isArray(result?.items) ? result.items : [];
  const cursor = readString(result?.cursor);

  return {
    items,
    cursor: cursor || undefined,
  };
}

export async function fetchOzonStocks(): Promise<OzonStocksResult> {
  const credentials = getOzonCredentials();

  if (!credentials) {
    return notConfiguredResult();
  }

  const client = new OzonClient(credentials.clientId, credentials.apiKey);
  const stocks: OzonStockItem[] = [];
  const dedupeKeys = new Set<string>();
  let pagesLoaded = 0;
  let durationMs = 0;
  let httpStatus: number | undefined;
  let cursor: string | undefined;
  let stoppedEarly = false;
  let lastError: IntegrationError | undefined;
  const diagnostics: OzonRequestDiagnostic[] = [];

  while (pagesLoaded < OZON_MAX_PAGES && stocks.length < OZON_MAX_STOCK_ROWS) {
    const requestBody: Record<string, unknown> = {
      filter: { visibility: "ALL" },
      limit: OZON_STOCKS_PAGE_SIZE,
    };

    if (cursor) {
      requestBody.cursor = cursor;
    }

    const response = await client.getProductInfoStocks(
      OZON_STOCKS_PAGE_SIZE,
      cursor,
    );

    pagesLoaded += 1;
    durationMs += response.durationMs;
    httpStatus = response.status || httpStatus;

    if (response.error || !response.ok) {
      lastError = mapOzonHttpError(response.status, response.error);
      diagnostics.push(
        buildOzonRequestDiagnostic({
          endpoint: "/v4/product/info/stocks",
          httpStatus: response.status,
          durationMs: response.durationMs,
          requestBody,
          responseData: response.data,
        }),
      );
      stoppedEarly = true;
      break;
    }

    const page = extractInfoStocksPage(response.data);
    const normalized = page.items.flatMap(normalizeInfoStocksRows);

    for (const row of normalized) {
      const key = buildStockKey(row);
      if (dedupeKeys.has(key)) {
        continue;
      }

      dedupeKeys.add(key);
      stocks.push(row);

      if (stocks.length >= OZON_MAX_STOCK_ROWS) {
        stoppedEarly = true;
        break;
      }
    }

    if (stoppedEarly) {
      break;
    }

    if (page.items.length === 0) {
      break;
    }

    if (page.items.length < OZON_STOCKS_PAGE_SIZE || !page.cursor) {
      break;
    }

    if (page.cursor === cursor) {
      stoppedEarly = true;
      break;
    }

    cursor = page.cursor;
  }

  const typeAudit = auditStockTypes(stocks);
  const totals = stocks.length > 0 ? sumTotals(stocks) : emptyTotals();

  if (stocks.length === 0) {
    if (lastError) {
      return buildResult({
        status: "error",
        configured: true,
        httpStatus,
        durationMs,
        totalStockRows: 0,
        totalUniqueProducts: 0,
        pagesLoaded,
        isComplete: false,
        stockTypes: [],
        totals: emptyTotals(),
        message: lastError.message,
        error: lastError,
        diagnostics,
      });
    }

    return buildResult({
      status: "ok",
      configured: true,
      httpStatus,
      durationMs,
      totalStockRows: 0,
      totalUniqueProducts: 0,
      pagesLoaded,
      isComplete: true,
      stockTypes: [],
      totals: emptyTotals(),
      message: "Список остатков Ozon пуст",
      stocks: [],
    });
  }

  const totalUniqueProducts = new Set(stocks.map((row) => row.productId)).size;
  const isComplete = !stoppedEarly;

  return buildResult({
    status: "ok",
    configured: true,
    httpStatus,
    durationMs,
    totalStockRows: stocks.length,
    totalUniqueProducts,
    pagesLoaded,
    isComplete,
    stockTypes: typeAudit.types,
    totals,
    message: isComplete
      ? `Получено строк остатков: ${stocks.length}. Типы: ${typeAudit.types.join(", ") || "—"}.`
      : `Получена часть остатков: ${stocks.length}. Типы: ${typeAudit.types.join(", ") || "—"}.`,
    stocks,
    diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
  });
}
