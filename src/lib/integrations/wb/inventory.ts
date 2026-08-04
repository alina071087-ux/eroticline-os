import "server-only";

import type {
  IntegrationError,
  WbInventoryItem,
  WbInventoryResult,
  WbProductCard,
} from "@/lib/integrations/types";
import { getWbApiToken } from "@/lib/integrations/wb/config";
import { WbClient } from "@/lib/integrations/wb/client";
import { mapWbHttpError } from "@/lib/integrations/wb/errors";
import { fetchWbStocks } from "@/lib/integrations/wb/stocks";

const MAX_INVENTORY_ROWS = 100;
const CARDS_PAGE_SIZE = 100;
const MAX_ACTIVE_PRODUCTS_SCANNED = 1000;
const MAX_TRASH_PRODUCTS_SCANNED = 1000;

const QUANTITY_SCOPE =
  "quantity относится ко всему nmID на складе, а не к конкретному размеру";

type ActiveCardsCursor = {
  updatedAt?: string;
  nmID?: number;
};

type TrashCardsCursor = {
  trashedAt?: string;
  nmID?: number;
};

type ProductLookupResult = {
  map: Map<number, WbProductCard>;
  activeProductsScanned: number;
  trashProductsScanned: number;
  matchedFromActiveCount: number;
  matchedFromTrashCount: number;
  unmatchedNmIds: number[];
  durationMs: number;
  error?: IntegrationError;
  trashError?: IntegrationError;
  httpStatus?: number;
};

function buildResult(
  partial: Omit<WbInventoryResult, "source" | "fetchedAt" | "quantityScope">,
): WbInventoryResult {
  return {
    source: "wildberries",
    fetchedAt: new Date().toISOString(),
    quantityScope: QUANTITY_SCOPE,
    ...partial,
  };
}

function readNmId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeCard(raw: unknown): WbProductCard | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const card = raw as Record<string, unknown>;
  const nmID = readNmId(card.nmID ?? card.nmId);

  if (nmID === null) {
    return null;
  }

  return {
    nmID,
    vendorCode: typeof card.vendorCode === "string" ? card.vendorCode : "",
    title: typeof card.title === "string" ? card.title : "",
    brand: typeof card.brand === "string" ? card.brand : "",
    subjectName: typeof card.subjectName === "string" ? card.subjectName : "",
    sizes: [],
  };
}

function extractCards(data: unknown): unknown[] {
  if (!data || typeof data !== "object") {
    return [];
  }

  const record = data as Record<string, unknown>;

  if (Array.isArray(record.cards)) {
    return record.cards;
  }

  if (record.data && typeof record.data === "object") {
    const nested = record.data as Record<string, unknown>;
    if (Array.isArray(nested.cards)) {
      return nested.cards;
    }
  }

  return [];
}

function getCursorObject(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  const cursorSource =
    record.cursor ??
    (record.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>).cursor
      : undefined);

  if (!cursorSource || typeof cursorSource !== "object") {
    return null;
  }

  return cursorSource as Record<string, unknown>;
}

function extractActiveCursor(data: unknown): ActiveCardsCursor | null {
  const cursor = getCursorObject(data);

  if (!cursor) {
    return null;
  }

  const next: ActiveCardsCursor = {};

  if (typeof cursor.updatedAt === "string") {
    next.updatedAt = cursor.updatedAt;
  }

  const nmID = readNmId(cursor.nmID ?? cursor.nmId);
  if (nmID !== null) {
    next.nmID = nmID;
  }

  return next.updatedAt || next.nmID !== undefined ? next : null;
}

function extractTrashCursor(data: unknown): TrashCardsCursor | null {
  const cursor = getCursorObject(data);

  if (!cursor) {
    return null;
  }

  const next: TrashCardsCursor = {};

  if (typeof cursor.trashedAt === "string") {
    next.trashedAt = cursor.trashedAt;
  }

  const nmID = readNmId(cursor.nmID ?? cursor.nmId);
  if (nmID !== null) {
    next.nmID = nmID;
  }

  return next.trashedAt || next.nmID !== undefined ? next : null;
}

function hasMorePages(data: unknown, requestedLimit: number): boolean {
  const cursor = getCursorObject(data);
  const total = cursor?.total;

  if (typeof total === "number" && total < requestedLimit) {
    return false;
  }

  return true;
}

function collectUniqueNmIds(
  stocks: NonNullable<Awaited<ReturnType<typeof fetchWbStocks>>["stocks"]>,
): Set<number> {
  const ids = new Set<number>();

  for (const stock of stocks) {
    ids.add(stock.nmID);
  }

  return ids;
}

function getUnmatchedNmIds(
  targetNmIds: Set<number>,
  productMap: Map<number, WbProductCard>,
): number[] {
  const unmatched: number[] = [];

  for (const nmID of targetNmIds) {
    if (!productMap.has(nmID)) {
      unmatched.push(nmID);
    }
  }

  return unmatched.sort((a, b) => a - b);
}

function countMatchedNmIds(
  targetNmIds: Set<number>,
  productMap: Map<number, WbProductCard>,
): number {
  let matched = 0;

  for (const nmID of targetNmIds) {
    if (productMap.has(nmID)) {
      matched += 1;
    }
  }

  return matched;
}

function ingestCardsPage(
  rawCards: unknown[],
  targetNmIds: Set<number>,
  productMap: Map<number, WbProductCard>,
): number {
  let scanned = 0;

  for (const rawCard of rawCards) {
    const card = normalizeCard(rawCard);

    if (!card) {
      continue;
    }

    scanned += 1;

    if (targetNmIds.has(card.nmID)) {
      productMap.set(card.nmID, card);
    }
  }

  return scanned;
}

async function scanActiveCards(
  client: WbClient,
  targetNmIds: Set<number>,
  productMap: Map<number, WbProductCard>,
): Promise<{
  scanned: number;
  durationMs: number;
  error?: IntegrationError;
  httpStatus?: number;
}> {
  let scanned = 0;
  let durationMs = 0;
  let cursor: ActiveCardsCursor | undefined;
  let lastHttpStatus: number | undefined;

  while (scanned < MAX_ACTIVE_PRODUCTS_SCANNED) {
    const pageLimit = Math.min(
      CARDS_PAGE_SIZE,
      MAX_ACTIVE_PRODUCTS_SCANNED - scanned,
    );
    const response = await client.getProductCardsPage(pageLimit, cursor);
    durationMs += response.durationMs;
    lastHttpStatus = response.status || lastHttpStatus;

    if (response.error) {
      return {
        scanned,
        durationMs,
        httpStatus: response.status || undefined,
        error: mapWbHttpError(response.status, response.error),
      };
    }

    if (!response.ok) {
      return {
        scanned,
        durationMs,
        httpStatus: response.status,
        error: mapWbHttpError(response.status),
      };
    }

    const rawCards = extractCards(response.data);

    if (rawCards.length === 0) {
      break;
    }

    scanned += ingestCardsPage(rawCards, targetNmIds, productMap);

    if (countMatchedNmIds(targetNmIds, productMap) >= targetNmIds.size) {
      break;
    }

    if (scanned >= MAX_ACTIVE_PRODUCTS_SCANNED) {
      break;
    }

    if (!hasMorePages(response.data, pageLimit)) {
      break;
    }

    const nextCursor = extractActiveCursor(response.data);

    if (!nextCursor?.updatedAt || nextCursor.nmID === undefined) {
      break;
    }

    cursor = nextCursor;
  }

  return { scanned, durationMs, httpStatus: lastHttpStatus };
}

async function scanTrashCards(
  client: WbClient,
  targetNmIds: Set<number>,
  productMap: Map<number, WbProductCard>,
): Promise<{
  scanned: number;
  durationMs: number;
  error?: IntegrationError;
  httpStatus?: number;
}> {
  let scanned = 0;
  let durationMs = 0;
  let cursor: TrashCardsCursor | undefined;
  let lastHttpStatus: number | undefined;

  while (scanned < MAX_TRASH_PRODUCTS_SCANNED) {
    const pageLimit = Math.min(
      CARDS_PAGE_SIZE,
      MAX_TRASH_PRODUCTS_SCANNED - scanned,
    );
    const response = await client.getProductCardsTrashPage(pageLimit, cursor);
    durationMs += response.durationMs;
    lastHttpStatus = response.status || lastHttpStatus;

    if (response.error) {
      return {
        scanned,
        durationMs,
        httpStatus: response.status || undefined,
        error: mapWbHttpError(response.status, response.error),
      };
    }

    if (!response.ok) {
      return {
        scanned,
        durationMs,
        httpStatus: response.status,
        error: mapWbHttpError(response.status),
      };
    }

    const rawCards = extractCards(response.data);

    if (rawCards.length === 0) {
      break;
    }

    scanned += ingestCardsPage(rawCards, targetNmIds, productMap);

    if (countMatchedNmIds(targetNmIds, productMap) >= targetNmIds.size) {
      break;
    }

    if (scanned >= MAX_TRASH_PRODUCTS_SCANNED) {
      break;
    }

    if (!hasMorePages(response.data, pageLimit)) {
      break;
    }

    const nextCursor = extractTrashCursor(response.data);

    if (!nextCursor?.trashedAt || nextCursor.nmID === undefined) {
      break;
    }

    cursor = nextCursor;
  }

  return { scanned, durationMs, httpStatus: lastHttpStatus };
}

async function fetchProductsForNmIds(
  targetNmIds: Set<number>,
): Promise<ProductLookupResult> {
  const token = getWbApiToken();

  if (!token) {
    return {
      map: new Map(),
      activeProductsScanned: 0,
      trashProductsScanned: 0,
      matchedFromActiveCount: 0,
      matchedFromTrashCount: 0,
      unmatchedNmIds: [...targetNmIds].sort((a, b) => a - b),
      durationMs: 0,
      error: {
        code: "MISSING_TOKEN",
        message:
          "Переменная окружения WB_API_TOKEN не задана. Добавьте её в .env.local",
      },
    };
  }

  const client = new WbClient(token);
  const productMap = new Map<number, WbProductCard>();

  const activeScan = await scanActiveCards(client, targetNmIds, productMap);
  const matchedFromActiveCount = countMatchedNmIds(targetNmIds, productMap);

  let trashProductsScanned = 0;
  let matchedFromTrashCount = 0;
  let trashError: IntegrationError | undefined;
  let durationMs = activeScan.durationMs;

  const remainingNmIds = new Set(getUnmatchedNmIds(targetNmIds, productMap));

  if (remainingNmIds.size > 0) {
    const trashScan = await scanTrashCards(client, remainingNmIds, productMap);
    trashProductsScanned = trashScan.scanned;
    durationMs += trashScan.durationMs;
    trashError = trashScan.error;

    matchedFromTrashCount =
      countMatchedNmIds(targetNmIds, productMap) - matchedFromActiveCount;
  }

  return {
    map: productMap,
    activeProductsScanned: activeScan.scanned,
    trashProductsScanned,
    matchedFromActiveCount,
    matchedFromTrashCount,
    unmatchedNmIds: getUnmatchedNmIds(targetNmIds, productMap),
    durationMs,
    error: activeScan.error,
    trashError,
    httpStatus: activeScan.httpStatus,
  };
}

function mergeInventoryRow(
  stock: NonNullable<Awaited<ReturnType<typeof fetchWbStocks>>["stocks"]>[number],
  card: WbProductCard | undefined,
): WbInventoryItem {
  return {
    nmID: stock.nmID,
    vendorCode: card?.vendorCode?.trim() ? card.vendorCode : null,
    title: card?.title?.trim() ? card.title : null,
    brand: card?.brand?.trim() ? card.brand : null,
    techSize: null,
    barcode: null,
    warehouseName: stock.warehouseName,
    quantity: stock.quantity,
    inWayToClient: stock.inWayToClient,
    inWayFromClient: stock.inWayFromClient,
    stockLevel: "nmID",
  };
}

export async function fetchWbInventory(
  limit = MAX_INVENTORY_ROWS,
): Promise<WbInventoryResult> {
  const safeLimit = Math.min(Math.max(1, limit), MAX_INVENTORY_ROWS);
  const stocksResult = await fetchWbStocks(safeLimit);

  if (stocksResult.status === "not_configured") {
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

  if (stocksResult.status === "error") {
    return buildResult({
      status: "error",
      configured: true,
      httpStatus: stocksResult.httpStatus,
      durationMs: stocksResult.durationMs,
      message: stocksResult.message ?? "Не удалось получить остатки Wildberries",
      error: stocksResult.error,
      partialErrors: stocksResult.error
        ? { stocks: stocksResult.error }
        : undefined,
    });
  }

  const stocks = (stocksResult.stocks ?? []).slice(0, safeLimit);

  if (stocks.length === 0) {
    return buildResult({
      status: "error",
      configured: true,
      httpStatus: stocksResult.httpStatus,
      durationMs: stocksResult.durationMs,
      count: 0,
      stockNmIdsCount: 0,
      matchedNmIdsCount: 0,
      unmatchedNmIdsCount: 0,
      activeProductsScanned: 0,
      trashProductsScanned: 0,
      matchedFromActiveCount: 0,
      matchedFromTrashCount: 0,
      unmatchedNmIds: [],
      productsScanned: 0,
      message: "Нет данных об остатках для объединения",
      error: {
        code: "EMPTY_RESPONSE",
        message: "Wildberries API вернул пустой список остатков",
      },
    });
  }

  const targetNmIds = collectUniqueNmIds(stocks);
  const productScan = await fetchProductsForNmIds(targetNmIds);
  const durationMs = (stocksResult.durationMs ?? 0) + productScan.durationMs;

  const partialErrors: WbInventoryResult["partialErrors"] = {};

  if (productScan.error) {
    partialErrors.products = productScan.error;
  }

  if (productScan.trashError) {
    partialErrors.products = productScan.trashError;
  }

  const matchedNmIdsCount = countMatchedNmIds(targetNmIds, productScan.map);
  const stockNmIdsCount = targetNmIds.size;
  const unmatchedNmIdsCount = productScan.unmatchedNmIds.length;

  const items = stocks.map((stock) =>
    mergeInventoryRow(stock, productScan.map.get(stock.nmID)),
  );

  const productsWarning =
    productScan.error || productScan.trashError || unmatchedNmIdsCount > 0
      ? ` Совпадений nmID: ${matchedNmIdsCount}/${stockNmIdsCount} (активные: ${productScan.matchedFromActiveCount}, корзина: ${productScan.matchedFromTrashCount}).`
      : "";

  return buildResult({
    status: "ok",
    configured: true,
    httpStatus: stocksResult.httpStatus ?? productScan.httpStatus,
    durationMs,
    count: items.length,
    stockNmIdsCount,
    matchedNmIdsCount,
    unmatchedNmIdsCount,
    productsScanned:
      productScan.activeProductsScanned + productScan.trashProductsScanned,
    activeProductsScanned: productScan.activeProductsScanned,
    trashProductsScanned: productScan.trashProductsScanned,
    matchedFromActiveCount: productScan.matchedFromActiveCount,
    matchedFromTrashCount: productScan.matchedFromTrashCount,
    unmatchedNmIds: productScan.unmatchedNmIds,
    message: `Объединено записей: ${items.length}.${productsWarning}`,
    partialErrors:
      Object.keys(partialErrors).length > 0 ? partialErrors : undefined,
    items,
  });
}
