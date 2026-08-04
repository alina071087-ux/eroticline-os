import "server-only";

import type {
  IntegrationError,
  WbInventoryItem,
  WbInventoryResult,
  WbProductCard,
  WbProductSource,
} from "@/lib/integrations/types";
import { getWbApiToken } from "@/lib/integrations/wb/config";
import { WbClient } from "@/lib/integrations/wb/client";
import { mapWbHttpError } from "@/lib/integrations/wb/errors";
import { fetchWbStocks } from "@/lib/integrations/wb/stocks";

const CARDS_PAGE_SIZE = 100;
const MAX_CARDS_SCANNED = 100_000;

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
  activeNmIds: Set<number>;
  trashNmIds: Set<number>;
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

function getUnmatchedNmIdsFromSets(
  targetNmIds: Set<number>,
  activeNmIds: Set<number>,
  trashNmIds: Set<number>,
): number[] {
  const unmatched: number[] = [];

  for (const nmID of targetNmIds) {
    if (!activeNmIds.has(nmID) && !trashNmIds.has(nmID)) {
      unmatched.push(nmID);
    }
  }

  return unmatched.sort((a, b) => a - b);
}

function ingestActiveCardsPage(
  rawCards: unknown[],
  targetNmIds: Set<number>,
  productMap: Map<number, WbProductCard>,
  activeNmIds: Set<number>,
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
      activeNmIds.add(card.nmID);
    }
  }

  return scanned;
}

function ingestTrashCardsPage(
  rawCards: unknown[],
  targetNmIds: Set<number>,
  productMap: Map<number, WbProductCard>,
  activeNmIds: Set<number>,
  trashNmIds: Set<number>,
): number {
  let scanned = 0;

  for (const rawCard of rawCards) {
    const card = normalizeCard(rawCard);

    if (!card) {
      continue;
    }

    scanned += 1;

    if (targetNmIds.has(card.nmID) && !activeNmIds.has(card.nmID)) {
      productMap.set(card.nmID, card);
      trashNmIds.add(card.nmID);
    }
  }

  return scanned;
}

function resolveProductSource(
  nmID: number,
  activeNmIds: Set<number>,
  trashNmIds: Set<number>,
): WbProductSource {
  if (activeNmIds.has(nmID)) {
    return "active";
  }

  if (trashNmIds.has(nmID)) {
    return "trash";
  }

  return "unknown";
}

async function scanActiveCards(
  client: WbClient,
  targetNmIds: Set<number>,
  productMap: Map<number, WbProductCard>,
  activeNmIds: Set<number>,
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

  while (scanned < MAX_CARDS_SCANNED) {
    const pageLimit = Math.min(CARDS_PAGE_SIZE, MAX_CARDS_SCANNED - scanned);
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

    scanned += ingestActiveCardsPage(
      rawCards,
      targetNmIds,
      productMap,
      activeNmIds,
    );

    if (activeNmIds.size >= targetNmIds.size) {
      break;
    }

    if (scanned >= MAX_CARDS_SCANNED) {
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
  activeNmIds: Set<number>,
  trashNmIds: Set<number>,
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

  while (scanned < MAX_CARDS_SCANNED) {
    const pageLimit = Math.min(CARDS_PAGE_SIZE, MAX_CARDS_SCANNED - scanned);
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

    scanned += ingestTrashCardsPage(
      rawCards,
      targetNmIds,
      productMap,
      activeNmIds,
      trashNmIds,
    );

    const matchedRemaining = [...targetNmIds].filter(
      (nmID) => activeNmIds.has(nmID) || trashNmIds.has(nmID),
    ).length;

    if (matchedRemaining >= targetNmIds.size) {
      break;
    }

    if (scanned >= MAX_CARDS_SCANNED) {
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
      activeNmIds: new Set(),
      trashNmIds: new Set(),
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
  const activeNmIds = new Set<number>();
  const trashNmIds = new Set<number>();

  const activeScan = await scanActiveCards(
    client,
    targetNmIds,
    productMap,
    activeNmIds,
  );
  const matchedFromActiveCount = activeNmIds.size;

  let trashProductsScanned = 0;
  let matchedFromTrashCount = 0;
  let trashError: IntegrationError | undefined;
  let durationMs = activeScan.durationMs;

  const remainingNmIds = new Set(
    getUnmatchedNmIdsFromSets(targetNmIds, activeNmIds, trashNmIds),
  );

  if (remainingNmIds.size > 0) {
    const trashScan = await scanTrashCards(
      client,
      remainingNmIds,
      productMap,
      activeNmIds,
      trashNmIds,
    );
    trashProductsScanned = trashScan.scanned;
    durationMs += trashScan.durationMs;
    trashError = trashScan.error;

    matchedFromTrashCount = trashNmIds.size;
  }

  return {
    map: productMap,
    activeNmIds,
    trashNmIds,
    activeProductsScanned: activeScan.scanned,
    trashProductsScanned,
    matchedFromActiveCount,
    matchedFromTrashCount,
    unmatchedNmIds: getUnmatchedNmIdsFromSets(
      targetNmIds,
      activeNmIds,
      trashNmIds,
    ),
    durationMs,
    error: activeScan.error,
    trashError,
    httpStatus: activeScan.httpStatus,
  };
}

function mergeInventoryRow(
  stock: NonNullable<Awaited<ReturnType<typeof fetchWbStocks>>["stocks"]>[number],
  card: WbProductCard | undefined,
  productSource: WbProductSource,
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
    productSource,
  };
}

export async function fetchWbInventory(): Promise<WbInventoryResult> {
  const stocksResult = await fetchWbStocks();

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

  const stocks = stocksResult.stocks ?? [];

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
      totalStockRows: stocksResult.totalStockRows ?? 0,
      totalUniqueNmIds: stocksResult.totalUniqueNmIds ?? 0,
      pagesLoaded: stocksResult.pagesLoaded ?? 0,
      isComplete: stocksResult.isComplete ?? false,
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

  const matchedNmIdsCount =
    productScan.activeNmIds.size + productScan.trashNmIds.size;
  const stockNmIdsCount = targetNmIds.size;
  const unmatchedNmIdsCount = productScan.unmatchedNmIds.length;

  const items = stocks.map((stock) => {
    const card = productScan.map.get(stock.nmID);
    const productSource = resolveProductSource(
      stock.nmID,
      productScan.activeNmIds,
      productScan.trashNmIds,
    );

    return mergeInventoryRow(stock, card, productSource);
  });

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
    totalStockRows: stocksResult.totalStockRows ?? 0,
    totalUniqueNmIds: stocksResult.totalUniqueNmIds ?? stockNmIdsCount,
    pagesLoaded: stocksResult.pagesLoaded ?? 0,
    isComplete: stocksResult.isComplete ?? false,
    message: `Объединено записей: ${items.length}.${productsWarning}`,
    partialErrors:
      Object.keys(partialErrors).length > 0 ? partialErrors : undefined,
    items,
  });
}
