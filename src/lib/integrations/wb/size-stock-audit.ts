import "server-only";

import { normalizeBarcodeValue } from "@/lib/integrations/1c/parser";
import { fetchSkuItemsMap } from "@/lib/integrations/1c/sku-repository";
import type { SkuItemRecord } from "@/lib/integrations/1c/import-types";
import type { WbProductCard } from "@/lib/integrations/types";
import { fetchAllWbProductCards } from "@/lib/integrations/wb/product-cards";
import {
  aggregateNmIdQuantityOldMethod,
  fetchWbRawStockRows,
  sumNmIdQuantityByChrtId,
  WB_SIZE_STOCK_ENDPOINT,
  type WbRawStockRow,
} from "@/lib/integrations/wb/raw-stocks";
import type {
  WbSizeStockAuditExample,
  WbSizeStockAuditNmIdCheck,
  WbSizeStockAuditResult,
  WbSizeStockAuditSizeRow,
} from "@/lib/integrations/wb/size-stock-audit-types";
import { WB_API_HOSTS } from "@/lib/integrations/wb/config";

const TARGET_NM_ID = 96468303;
const TARGET_SIZES = ["75B", "80B", "85B", "85C", "90C", "95C"];

type WbChrtCatalogEntry = {
  nmId: number;
  chrtId: number;
  techSize: string;
  barcodes: string[];
  vendorCode: string;
};

function buildChrtCatalog(cards: WbProductCard[]): Map<number, WbChrtCatalogEntry> {
  const map = new Map<number, WbChrtCatalogEntry>();

  for (const card of cards) {
    for (const size of card.sizes) {
      map.set(size.chrtID, {
        nmId: card.nmID,
        chrtId: size.chrtID,
        techSize: size.techSize,
        barcodes: size.barcodes.map((barcode) => normalizeBarcodeValue(barcode)).filter(Boolean),
        vendorCode: card.vendorCode,
      });
    }
  }

  return map;
}

function buildBarcodeToSkuItem(items: Map<string, SkuItemRecord>): Map<string, SkuItemRecord> {
  const map = new Map<string, SkuItemRecord>();

  for (const item of items.values()) {
    const normalized = normalizeBarcodeValue(item.barcode);
    if (normalized) {
      map.set(normalized, item);
    }
  }

  return map;
}

function findMatchedSkuItem(
  entry: WbChrtCatalogEntry,
  barcodeToSku: Map<string, SkuItemRecord>,
): { barcode: string; sku: SkuItemRecord } | null {
  for (const barcode of entry.barcodes) {
    const sku = barcodeToSku.get(barcode);
    if (sku) {
      return { barcode, sku };
    }
  }

  return null;
}

function buildNmIdAudit(
  nmId: number,
  rawRows: WbRawStockRow[],
  chrtCatalog: Map<number, WbChrtCatalogEntry>,
  barcodeToSku: Map<string, SkuItemRecord>,
): WbSizeStockAuditNmIdCheck {
  const nmRows = rawRows.filter((row) => row.nmId === nmId);
  const chrtIds = new Set(
    nmRows.map((row) => row.chrtId).filter((value): value is number => value !== null),
  );

  const chrtTotals = new Map<number, number>();
  for (const row of nmRows) {
    if (row.chrtId === null) {
      continue;
    }
    chrtTotals.set(row.chrtId, (chrtTotals.get(row.chrtId) ?? 0) + row.quantity);
  }

  const quantities = [...chrtTotals.values()];
  const chrtQuantitiesDistinct =
    quantities.length > 1 && new Set(quantities).size > 1;

  const relevantChrtIds = new Set<number>();

  for (const techSize of TARGET_SIZES) {
    for (const entry of chrtCatalog.values()) {
      if (entry.nmId === nmId && entry.techSize === techSize) {
        relevantChrtIds.add(entry.chrtId);
      }
    }
  }

  for (const chrtId of chrtIds) {
    const entry = chrtCatalog.get(chrtId);
    if (entry?.nmId === nmId) {
      relevantChrtIds.add(chrtId);
    }
  }

  const sizes: WbSizeStockAuditSizeRow[] = [...relevantChrtIds]
    .map((chrtId) => {
      const entry = chrtCatalog.get(chrtId);
      const techSize = entry?.techSize ?? "—";
      const barcodes = entry?.barcodes ?? [];
      const matched = entry ? findMatchedSkuItem(entry, barcodeToSku) : null;
      const chrtRows = nmRows.filter((row) => row.chrtId === chrtId);

      return {
        techSize,
        chrtId,
        barcodes,
        matchedBarcode: matched?.barcode ?? null,
        article: matched?.sku.article ?? null,
        color: matched?.sku.color ?? null,
        size: matched?.sku.size ?? null,
        totalQuantity: chrtRows.reduce((sum, row) => sum + row.quantity, 0),
        totalInWayToClient: chrtRows.reduce((sum, row) => sum + row.inWayToClient, 0),
        totalInWayFromClient: chrtRows.reduce((sum, row) => sum + row.inWayFromClient, 0),
        warehouses: chrtRows.map((row) => ({
          warehouseId: row.warehouseId,
          warehouseName: row.warehouseName,
          quantity: row.quantity,
          inWayToClient: row.inWayToClient,
          inWayFromClient: row.inWayFromClient,
        })),
      };
    })
    .sort((left, right) => left.techSize.localeCompare(right.techSize, "ru"));

  const oldAggregatedQuantity = aggregateNmIdQuantityOldMethod(rawRows, nmId);
  const newChrtSumQuantity = sumNmIdQuantityByChrtId(rawRows, nmId);

  return {
    nmId,
    oldAggregatedQuantity,
    newChrtSumQuantity,
    matchesOldTotal: oldAggregatedQuantity === newChrtSumQuantity,
    uniqueChrtIds: chrtIds.size,
    chrtQuantitiesDistinct,
    sizes,
  };
}

function buildExamples(
  rawRows: WbRawStockRow[],
  chrtCatalog: Map<number, WbChrtCatalogEntry>,
  barcodeToSku: Map<string, SkuItemRecord>,
  limit = 20,
): WbSizeStockAuditExample[] {
  const examples: WbSizeStockAuditExample[] = [];
  const seen = new Set<string>();

  const sortedRows = [...rawRows].sort((left, right) => right.quantity - left.quantity);

  for (const row of sortedRows) {
    if (row.chrtId === null || row.quantity <= 0) {
      continue;
    }

    const entry = chrtCatalog.get(row.chrtId);
    if (!entry) {
      continue;
    }

    const matched = findMatchedSkuItem(entry, barcodeToSku);
    if (!matched) {
      continue;
    }

    const key = `${matched.barcode}:${row.chrtId}:${row.warehouseName}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    examples.push({
      barcode: matched.barcode,
      article: matched.sku.article ?? "",
      color: matched.sku.color ?? "",
      size: matched.sku.size ?? "",
      nmId: row.nmId,
      chrtId: row.chrtId,
      techSize: entry.techSize,
      warehouseName: row.warehouseName,
      quantity: row.quantity,
    });

    if (examples.length >= limit) {
      break;
    }
  }

  return examples;
}

export async function runWbSizeStockAudit(): Promise<WbSizeStockAuditResult> {
  const startedAt = Date.now();
  const endpoint = `${WB_API_HOSTS.sellerAnalytics}${WB_SIZE_STOCK_ENDPOINT}`;

  const [rawStocksResult, cardsScan, skuItemsMap] = await Promise.all([
    fetchWbRawStockRows(),
    fetchAllWbProductCards(),
    fetchSkuItemsMap(),
  ]);

  if (rawStocksResult.error && rawStocksResult.rows.length === 0) {
    const isMissingToken = rawStocksResult.error.code === "MISSING_TOKEN";

    return {
      source: "wildberries-size-stock-audit",
      endpoint,
      fetchedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      status: isMissingToken ? "not_configured" : "error",
      message: rawStocksResult.error.message,
      metrics: {
        totalRows: 0,
        uniqueNmIds: 0,
        uniqueChrtIds: 0,
        uniqueBarcodes: 0,
        matchedWith1c: 0,
        unmatchedWith1c: 0,
        warehouses: 0,
        totalQuantity: 0,
        totalInWayToClient: 0,
        totalInWayFromClient: 0,
        rowsWithoutChrtId: 0,
      },
      examples: [],
      nmId96468303: {
        nmId: TARGET_NM_ID,
        oldAggregatedQuantity: 0,
        newChrtSumQuantity: 0,
        matchesOldTotal: true,
        uniqueChrtIds: 0,
        chrtQuantitiesDistinct: false,
        sizes: [],
      },
      error: rawStocksResult.error,
    };
  }

  const rawRows = rawStocksResult.rows;
  const cards = [...cardsScan.cards.values()];
  const chrtCatalog = buildChrtCatalog(cards);
  const barcodeToSku = buildBarcodeToSkuItem(skuItemsMap);

  const chrtIdsWithRows = new Set(
    rawRows.map((row) => row.chrtId).filter((value): value is number => value !== null),
  );

  let matchedWith1c = 0;
  let unmatchedWith1c = 0;

  for (const chrtId of chrtIdsWithRows) {
    const entry = chrtCatalog.get(chrtId);
    if (!entry) {
      unmatchedWith1c += 1;
      continue;
    }

    if (findMatchedSkuItem(entry, barcodeToSku)) {
      matchedWith1c += 1;
    } else {
      unmatchedWith1c += 1;
    }
  }

  const uniqueBarcodes = new Set<string>();
  for (const entry of chrtCatalog.values()) {
    for (const barcode of entry.barcodes) {
      if (barcode) {
        uniqueBarcodes.add(barcode);
      }
    }
  }

  const metrics = {
    totalRows: rawRows.length,
    uniqueNmIds: new Set(rawRows.map((row) => row.nmId)).size,
    uniqueChrtIds: chrtIdsWithRows.size,
    uniqueBarcodes: uniqueBarcodes.size,
    matchedWith1c,
    unmatchedWith1c,
    warehouses: new Set(
      rawRows.map((row) => row.warehouseId ?? row.warehouseName).filter(Boolean),
    ).size,
    totalQuantity: rawRows.reduce((sum, row) => sum + row.quantity, 0),
    totalInWayToClient: rawRows.reduce((sum, row) => sum + row.inWayToClient, 0),
    totalInWayFromClient: rawRows.reduce((sum, row) => sum + row.inWayFromClient, 0),
    rowsWithoutChrtId: rawRows.filter((row) => row.chrtId === null).length,
  };

  const examples = buildExamples(rawRows, chrtCatalog, barcodeToSku);
  const nmId96468303 = buildNmIdAudit(TARGET_NM_ID, rawRows, chrtCatalog, barcodeToSku);

  let status: WbSizeStockAuditResult["status"] = "ok";
  let message =
    `Размерный audit WB: ${metrics.totalRows} строк, ${metrics.uniqueChrtIds} chrtId, ` +
    `${metrics.matchedWith1c} chrtId сопоставлены с 1С.`;

  if (rawStocksResult.error || cardsScan.error) {
    status = "partial";
    message = "Audit собран частично: есть ошибки загрузки WB.";
  }

  return {
    source: "wildberries-size-stock-audit",
    endpoint,
    fetchedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt + rawStocksResult.durationMs + cardsScan.durationMs,
    status,
    message,
    metrics,
    examples,
    nmId96468303,
    ...(rawStocksResult.error ? { error: rawStocksResult.error } : {}),
    ...(cardsScan.error ? { cardsError: cardsScan.error } : {}),
  };
}
