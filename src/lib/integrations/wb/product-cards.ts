import "server-only";

import type { WbProductCard, WbProductSize } from "@/lib/integrations/types";
import { getWbApiToken } from "@/lib/integrations/wb/config";
import { WbClient } from "@/lib/integrations/wb/client";
import { mapWbHttpError } from "@/lib/integrations/wb/errors";
import type { IntegrationError } from "@/lib/integrations/types";

const CARDS_PAGE_SIZE = 100;
const MAX_CARDS_SCANNED = 100_000;

export type WbProductCardsScanResult = {
  cards: Map<number, WbProductCard>;
  activeNmIds: Set<number>;
  trashNmIds: Set<number>;
  activeProductsScanned: number;
  trashProductsScanned: number;
  durationMs: number;
  isComplete: boolean;
  error?: IntegrationError;
  trashError?: IntegrationError;
  httpStatus?: number;
};

type ActiveCardsCursor = {
  updatedAt?: string;
  nmID?: number;
};

type TrashCardsCursor = {
  trashedAt?: string;
  nmID?: number;
};

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

function normalizeSize(raw: unknown): WbProductSize | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const size = raw as Record<string, unknown>;
  const chrtID = size.chrtID;

  if (typeof chrtID !== "number") {
    return null;
  }

  const skus = Array.isArray(size.skus)
    ? size.skus.filter((sku): sku is string => typeof sku === "string")
    : [];

  return {
    chrtID,
    techSize: typeof size.techSize === "string" ? size.techSize : "",
    barcodes: skus,
  };
}

export function normalizeWbProductCard(raw: unknown): WbProductCard | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const card = raw as Record<string, unknown>;
  const nmID = readNmId(card.nmID ?? card.nmId);

  if (nmID === null) {
    return null;
  }

  const sizes = Array.isArray(card.sizes)
    ? card.sizes
        .map(normalizeSize)
        .filter((size): size is WbProductSize => size !== null)
    : [];

  return {
    nmID,
    vendorCode: typeof card.vendorCode === "string" ? card.vendorCode : "",
    title: typeof card.title === "string" ? card.title : "",
    brand: typeof card.brand === "string" ? card.brand : "",
    subjectName: typeof card.subjectName === "string" ? card.subjectName : "",
    sizes,
  };
}

export function extractBarcodesFromCard(card: WbProductCard): string[] {
  const barcodes = new Set<string>();

  for (const size of card.sizes) {
    for (const barcode of size.barcodes) {
      const trimmed = barcode.trim();
      if (trimmed) {
        barcodes.add(trimmed);
      }
    }
  }

  return [...barcodes];
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

function ingestActiveCardsPage(
  rawCards: unknown[],
  targetNmIds: Set<number> | null,
  productMap: Map<number, WbProductCard>,
  activeNmIds: Set<number>,
): number {
  let scanned = 0;

  for (const rawCard of rawCards) {
    const card = normalizeWbProductCard(rawCard);

    if (!card) {
      continue;
    }

    scanned += 1;

    if (!targetNmIds || targetNmIds.has(card.nmID)) {
      productMap.set(card.nmID, card);
      activeNmIds.add(card.nmID);
    }
  }

  return scanned;
}

function ingestTrashCardsPage(
  rawCards: unknown[],
  targetNmIds: Set<number> | null,
  productMap: Map<number, WbProductCard>,
  activeNmIds: Set<number>,
  trashNmIds: Set<number>,
): number {
  let scanned = 0;

  for (const rawCard of rawCards) {
    const card = normalizeWbProductCard(rawCard);

    if (!card) {
      continue;
    }

    scanned += 1;

    if (
      (!targetNmIds || targetNmIds.has(card.nmID)) &&
      !activeNmIds.has(card.nmID)
    ) {
      productMap.set(card.nmID, card);
      trashNmIds.add(card.nmID);
    }
  }

  return scanned;
}

async function scanActiveCards(
  client: WbClient,
  targetNmIds: Set<number> | null,
  productMap: Map<number, WbProductCard>,
  activeNmIds: Set<number>,
): Promise<{
  scanned: number;
  durationMs: number;
  isComplete: boolean;
  error?: IntegrationError;
  httpStatus?: number;
}> {
  let scanned = 0;
  let durationMs = 0;
  let cursor: ActiveCardsCursor | undefined;
  let lastHttpStatus: number | undefined;
  let isComplete = true;

  while (scanned < MAX_CARDS_SCANNED) {
    const pageLimit = Math.min(CARDS_PAGE_SIZE, MAX_CARDS_SCANNED - scanned);
    const response = await client.getProductCardsPage(pageLimit, cursor);
    durationMs += response.durationMs;
    lastHttpStatus = response.status || lastHttpStatus;

    if (response.error) {
      isComplete = false;
      return {
        scanned,
        durationMs,
        isComplete,
        httpStatus: response.status || undefined,
        error: mapWbHttpError(response.status, response.error),
      };
    }

    if (!response.ok) {
      isComplete = false;
      return {
        scanned,
        durationMs,
        isComplete,
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

    if (targetNmIds && activeNmIds.size >= targetNmIds.size) {
      break;
    }

    if (scanned >= MAX_CARDS_SCANNED) {
      isComplete = false;
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

  return { scanned, durationMs, isComplete, httpStatus: lastHttpStatus };
}

async function scanTrashCards(
  client: WbClient,
  targetNmIds: Set<number> | null,
  productMap: Map<number, WbProductCard>,
  activeNmIds: Set<number>,
  trashNmIds: Set<number>,
): Promise<{
  scanned: number;
  durationMs: number;
  isComplete: boolean;
  error?: IntegrationError;
  httpStatus?: number;
}> {
  let scanned = 0;
  let durationMs = 0;
  let cursor: TrashCardsCursor | undefined;
  let lastHttpStatus: number | undefined;
  let isComplete = true;

  while (scanned < MAX_CARDS_SCANNED) {
    const pageLimit = Math.min(CARDS_PAGE_SIZE, MAX_CARDS_SCANNED - scanned);
    const response = await client.getProductCardsTrashPage(pageLimit, cursor);
    durationMs += response.durationMs;
    lastHttpStatus = response.status || lastHttpStatus;

    if (response.error) {
      isComplete = false;
      return {
        scanned,
        durationMs,
        isComplete,
        httpStatus: response.status || undefined,
        error: mapWbHttpError(response.status, response.error),
      };
    }

    if (!response.ok) {
      isComplete = false;
      return {
        scanned,
        durationMs,
        isComplete,
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

    if (targetNmIds) {
      const matchedRemaining = [...targetNmIds].filter(
        (nmID) => activeNmIds.has(nmID) || trashNmIds.has(nmID),
      ).length;

      if (matchedRemaining >= targetNmIds.size) {
        break;
      }
    }

    if (scanned >= MAX_CARDS_SCANNED) {
      isComplete = false;
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

  return { scanned, durationMs, isComplete, httpStatus: lastHttpStatus };
}

export async function fetchWbProductCardsForNmIds(
  targetNmIds: Set<number>,
): Promise<WbProductCardsScanResult> {
  const token = getWbApiToken();

  if (!token) {
    return {
      cards: new Map(),
      activeNmIds: new Set(),
      trashNmIds: new Set(),
      activeProductsScanned: 0,
      trashProductsScanned: 0,
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
  const cards = new Map<number, WbProductCard>();
  const activeNmIds = new Set<number>();
  const trashNmIds = new Set<number>();

  const activeScan = await scanActiveCards(
    client,
    targetNmIds,
    cards,
    activeNmIds,
  );

  let trashProductsScanned = 0;
  let trashError: IntegrationError | undefined;
  let durationMs = activeScan.durationMs;
  let isComplete = activeScan.isComplete;

  const remainingNmIds = new Set<number>();

  for (const nmID of targetNmIds) {
    if (!activeNmIds.has(nmID)) {
      remainingNmIds.add(nmID);
    }
  }

  if (remainingNmIds.size > 0) {
    const trashScan = await scanTrashCards(
      client,
      remainingNmIds,
      cards,
      activeNmIds,
      trashNmIds,
    );
    trashProductsScanned = trashScan.scanned;
    durationMs += trashScan.durationMs;
    trashError = trashScan.error;
    isComplete = isComplete && trashScan.isComplete;
  }

  return {
    cards,
    activeNmIds,
    trashNmIds,
    activeProductsScanned: activeScan.scanned,
    trashProductsScanned,
    durationMs,
    isComplete,
    error: activeScan.error,
    trashError,
    httpStatus: activeScan.httpStatus,
  };
}

export async function fetchAllWbProductCards(): Promise<WbProductCardsScanResult> {
  const token = getWbApiToken();

  if (!token) {
    return {
      cards: new Map(),
      activeNmIds: new Set(),
      trashNmIds: new Set(),
      activeProductsScanned: 0,
      trashProductsScanned: 0,
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
  const cards = new Map<number, WbProductCard>();
  const activeNmIds = new Set<number>();
  const trashNmIds = new Set<number>();

  const activeScan = await scanActiveCards(client, null, cards, activeNmIds);
  const trashScan = await scanTrashCards(
    client,
    null,
    cards,
    activeNmIds,
    trashNmIds,
  );

  return {
    cards,
    activeNmIds,
    trashNmIds,
    activeProductsScanned: activeScan.scanned,
    trashProductsScanned: trashScan.scanned,
    durationMs: activeScan.durationMs + trashScan.durationMs,
    isComplete: activeScan.isComplete && trashScan.isComplete,
    error: activeScan.error,
    trashError: trashScan.error,
    httpStatus: activeScan.httpStatus ?? trashScan.httpStatus,
  };
}
