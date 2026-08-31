import "server-only";

import { buildOzonBarcodeIndex } from "@/lib/integrations/1c/reconciliation";
import { normalizeBarcodeValue } from "@/lib/integrations/1c/parser";
import type { SkuItemRecord } from "@/lib/integrations/1c/import-types";
import { fetchSkuItemsMap } from "@/lib/integrations/1c/sku-repository";
import type { OzonBarcodeHit } from "@/lib/integrations/1c/types";
import { fetchOzonInventory } from "@/lib/integrations/ozon/inventory";
import type { OzonInventoryItem } from "@/lib/integrations/ozon/types";
import {
  aggregateNmIdTotals,
  aggregateStockByChrtId,
  buildBarcodeToChrtEntry,
  buildChrtCatalog,
  buildWbWithout1cEntries,
  computeLegacyTotalQuantity,
  computeRawTotalQuantity,
  countMatchedChrtIds,
  type WbChrtCatalogEntry,
  type WbChrtStockAggregate,
} from "@/lib/integrations/wb/chrt-stocks";
import { fetchAllWbProductCards } from "@/lib/integrations/wb/product-cards";
import { fetchWbRawStockRows, type WbRawStockRow } from "@/lib/integrations/wb/raw-stocks";
import type {
  SkuUnifiedAudit,
  SkuUnifiedMatchStatus,
  SkuUnifiedMetrics,
  SkuUnifiedNmId96468303Check,
  SkuUnifiedResult,
  SkuUnifiedRow,
  SkuUnifiedWbDiagnostics,
} from "@/lib/integrations/sku-unified/types";

const TARGET_NM_ID = 96468303;
const TARGET_SIZES = ["75B", "80B", "85B", "85C", "90C", "95C"];

type OzonProductStock = {
  present: number;
  reserved: number;
  available: number;
};

function buildOzonStockByProductId(items: OzonInventoryItem[]): Map<number, OzonProductStock> {
  const map = new Map<number, OzonProductStock>();

  for (const item of items) {
    const existing = map.get(item.productId);
    if (existing) {
      existing.present += item.present;
      existing.reserved += item.reserved;
      existing.available += item.available;
      continue;
    }

    map.set(item.productId, {
      present: item.present,
      reserved: item.reserved,
      available: item.available,
    });
  }

  return map;
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function resolveMatchStatus(hasWb: boolean, hasOzon: boolean): SkuUnifiedMatchStatus {
  if (hasWb && hasOzon) {
    return "matched_all";
  }
  if (hasWb) {
    return "matched_wb_only";
  }
  if (hasOzon) {
    return "matched_ozon_only";
  }
  return "no_marketplace_match";
}

function collectOzonMetrics(hits: OzonBarcodeHit[], stockByProductId: Map<number, OzonProductStock>) {
  const productIds = uniqueNumbers(hits.map((hit) => hit.productId));
  const offerIds = uniqueStrings(hits.map((hit) => hit.offerId));

  let present = 0;
  let reserved = 0;
  let available = 0;

  for (const productId of productIds) {
    const stock = stockByProductId.get(productId);
    if (!stock) {
      continue;
    }
    present += stock.present;
    reserved += stock.reserved;
    available += stock.available;
  }

  return {
    ozonProductIds: productIds,
    ozonOfferIds: offerIds,
    ozonPresent: present,
    ozonReserved: reserved,
    ozonAvailable: available,
  };
}

function buildVisibleWarnings(item: SkuItemRecord): string[] {
  return item.warnings.filter(
    (warning) =>
      !warning.startsWith("Остаток Wildberries доступен на уровне nmID"),
  );
}

function mapSkuItemToUnifiedRow(
  item: SkuItemRecord,
  barcodeToChrt: Map<string, WbChrtCatalogEntry>,
  stockByChrtId: Map<number, WbChrtStockAggregate>,
  nmIdTotals: Map<number, { quantity: number; inWayToClient: number; inWayFromClient: number }>,
  ozonIndex: Map<string, OzonBarcodeHit[]>,
  ozonStockByProductId: Map<number, OzonProductStock>,
): SkuUnifiedRow {
  const normalizedBarcode = normalizeBarcodeValue(item.barcode);
  const chrtEntry = normalizedBarcode ? barcodeToChrt.get(normalizedBarcode) : undefined;
  const chrtStock = chrtEntry ? stockByChrtId.get(chrtEntry.chrtId) : undefined;
  const ozonHits = normalizedBarcode ? (ozonIndex.get(normalizedBarcode) ?? []) : [];

  const hasWb = Boolean(chrtEntry);
  const hasOzon = ozonHits.length > 0;
  const ozonMetrics = collectOzonMetrics(ozonHits, ozonStockByProductId);
  const nmIdTotal = chrtEntry ? nmIdTotals.get(chrtEntry.nmId) : undefined;

  return {
    barcode: item.barcode,
    article: item.article ?? "",
    productName: item.product_name ?? "",
    color: item.color ?? "",
    size: item.size ?? "",
    nomenclatureRaw: item.nomenclature_raw ?? "",
    characteristicRaw: item.characteristic_raw ?? "",

    wbNmIds: chrtEntry ? [chrtEntry.nmId] : [],
    wbVendorCodes: chrtEntry?.vendorCode ? [chrtEntry.vendorCode] : [],
    wbChrtId: chrtEntry?.chrtId ?? null,
    wbTechSize: chrtEntry?.techSize ?? null,
    wbBarcode: hasWb ? normalizedBarcode : null,
    wbQuantity: chrtStock?.quantity ?? 0,
    wbInWayToClient: chrtStock?.inWayToClient ?? 0,
    wbInWayFromClient: chrtStock?.inWayFromClient ?? 0,
    wbNmIdTotalQuantity: nmIdTotal?.quantity ?? null,
    wbWarehouses: chrtStock?.warehouses ?? [],
    wbStockGranularity: hasWb ? "size" : null,
    wbMatchStatus: hasWb ? "matched" : "no_marketplace_match",

    ...ozonMetrics,
    ozonMatchStatus: hasOzon ? "matched" : "no_marketplace_match",

    matchStatus: resolveMatchStatus(hasWb, hasOzon),
    matchMethod: item.match_method || null,
    warnings: buildVisibleWarnings(item),
    updatedAt: item.updated_at,
  };
}

function computeMetrics(items: SkuUnifiedRow[]): SkuUnifiedMetrics {
  let skuWithWb = 0;
  let skuWithOzon = 0;
  let skuWithBoth = 0;
  let skuWithoutMarketplaces = 0;
  let warningsCount = 0;
  let skuWithWbQuantityZero = 0;
  let skuWithWbQuantityPositive = 0;

  const allWbNmIds = new Set<number>();
  const allOzonProducts = new Set<number>();

  for (const item of items) {
    const hasWb = item.wbMatchStatus === "matched";
    const hasOzon = item.ozonMatchStatus === "matched";

    if (hasWb) {
      skuWithWb += 1;
      for (const nmId of item.wbNmIds) {
        allWbNmIds.add(nmId);
      }
      if (item.wbQuantity === 0 && item.wbInWayToClient === 0 && item.wbInWayFromClient === 0) {
        skuWithWbQuantityZero += 1;
      } else if (item.wbQuantity > 0) {
        skuWithWbQuantityPositive += 1;
      }
    }

    if (hasOzon) {
      skuWithOzon += 1;
      for (const productId of item.ozonProductIds) {
        allOzonProducts.add(productId);
      }
    }

    if (hasWb && hasOzon) {
      skuWithBoth += 1;
    }

    if (!hasWb && !hasOzon) {
      skuWithoutMarketplaces += 1;
    }

    warningsCount += item.warnings.length;
  }

  return {
    totalSku: items.length,
    skuWithWb,
    skuWithOzon,
    skuWithBoth,
    skuWithoutMarketplaces,
    wbNmIds: allWbNmIds.size,
    ozonProducts: allOzonProducts.size,
    unmatched: skuWithoutMarketplaces,
    warningsCount,
    skuWithWbQuantityZero,
    skuWithWbQuantityPositive,
  };
}

function computeAudit(
  items: SkuUnifiedRow[],
  stockByChrtId: Map<number, WbChrtStockAggregate>,
  matchedChrtIds: number,
  unmatchedChrtIds: number,
): SkuUnifiedAudit {
  let withWb = 0;
  let withOzon = 0;
  let withBoth = 0;
  let wbOnly = 0;
  let ozonOnly = 0;
  let neither = 0;

  for (const item of items) {
    const hasWb = item.wbMatchStatus === "matched";
    const hasOzon = item.ozonMatchStatus === "matched";

    if (hasWb) {
      withWb += 1;
    }
    if (hasOzon) {
      withOzon += 1;
    }
    if (hasWb && hasOzon) {
      withBoth += 1;
    }
    if (hasWb && !hasOzon) {
      wbOnly += 1;
    }
    if (!hasWb && hasOzon) {
      ozonOnly += 1;
    }
    if (!hasWb && !hasOzon) {
      neither += 1;
    }
  }

  return {
    withWb,
    withOzon,
    withBoth,
    wbOnly,
    ozonOnly,
    neither,
    totalChrtIds: stockByChrtId.size,
    matchedChrtIds,
    unmatchedChrtIds,
  };
}

function buildNmId96468303Check(
  rawRows: WbRawStockRow[],
  stockByChrtId: Map<number, WbChrtStockAggregate>,
): SkuUnifiedNmId96468303Check {
  const nmRows = rawRows.filter((row) => row.nmId === TARGET_NM_ID);
  const oldAggregatedQuantity = computeLegacyTotalQuantity(nmRows);

  const relevantEntries = [...stockByChrtId.values()].filter(
    (entry) => entry.nmId === TARGET_NM_ID,
  );

  const sizes = TARGET_SIZES.map((techSize) => {
    const entry = relevantEntries.find((item) => item.techSize === techSize);
    const matchedBarcode = entry?.barcodes[0] ?? null;

    return {
      techSize,
      chrtId: entry?.chrtId ?? 0,
      barcode: matchedBarcode,
      quantity: entry?.quantity ?? 0,
    };
  }).filter((size) => size.chrtId > 0);

  const newChrtSumQuantity = relevantEntries.reduce((sum, entry) => sum + entry.quantity, 0);

  return {
    nmId: TARGET_NM_ID,
    oldAggregatedQuantity,
    newChrtSumQuantity,
    matchesOldTotal: oldAggregatedQuantity === newChrtSumQuantity,
    sizes,
  };
}

export async function fetchUnifiedSku(): Promise<SkuUnifiedResult> {
  const startedAt = Date.now();

  const skuItemsMap = await fetchSkuItemsMap();
  const skuItems = [...skuItemsMap.values()].sort((left, right) =>
    left.barcode.localeCompare(right.barcode, "ru"),
  );
  const skuBarcodes = new Set(
    skuItems
      .map((item) => normalizeBarcodeValue(item.barcode))
      .filter(Boolean),
  );

  const [wbCardsScan, rawStocksResult, ozonInventoryResult] = await Promise.all([
    fetchAllWbProductCards(),
    fetchWbRawStockRows(),
    fetchOzonInventory(),
  ]);

  const wbCards = [...wbCardsScan.cards.values()];
  const chrtCatalog = buildChrtCatalog(wbCards);
  const rawRows = rawStocksResult.rows;
  const stockByChrtId = aggregateStockByChrtId(rawRows, chrtCatalog);
  const barcodeToChrt = buildBarcodeToChrtEntry(chrtCatalog);

  const ozonItems = ozonInventoryResult.items ?? [];
  const nmIdTotals = aggregateNmIdTotals(rawRows);
  const chrtMatchCounts = countMatchedChrtIds(stockByChrtId, skuBarcodes);
  const wbWithout1c = buildWbWithout1cEntries(stockByChrtId, skuBarcodes);

  const ozonIndex = buildOzonBarcodeIndex(ozonItems);
  const ozonStockByProductId = buildOzonStockByProductId(ozonItems);

  const items = skuItems.map((item) =>
    mapSkuItemToUnifiedRow(
      item,
      barcodeToChrt,
      stockByChrtId,
      nmIdTotals,
      ozonIndex,
      ozonStockByProductId,
    ),
  );

  const metrics = computeMetrics(items);
  const audit = computeAudit(
    items,
    stockByChrtId,
    chrtMatchCounts.matched,
    chrtMatchCounts.unmatched,
  );

  const wbDiagnostics: SkuUnifiedWbDiagnostics = {
    wbMatchedChrtIds: chrtMatchCounts.matched,
    wbUnmatchedChrtIds: chrtMatchCounts.unmatched,
    wbTotalQuantity: computeRawTotalQuantity(rawRows),
    wbTotalInWayToClient: rawRows.reduce((sum, row) => sum + row.inWayToClient, 0),
    wbTotalInWayFromClient: rawRows.reduce((sum, row) => sum + row.inWayFromClient, 0),
    legacyTotalQuantity: computeLegacyTotalQuantity(rawRows),
    legacyTotalsMatch:
      computeRawTotalQuantity(rawRows) === computeLegacyTotalQuantity(rawRows),
  };

  const nmId96468303 = buildNmId96468303Check(rawRows, stockByChrtId);

  const wbError = wbCardsScan.error ?? rawStocksResult.error;
  const ozonError = ozonInventoryResult.error;

  const hasSkuItems = skuItems.length > 0;
  const wbUsable = wbCards.length > 0 || rawRows.length > 0;
  const ozonUsable = ozonItems.length > 0;

  let status: SkuUnifiedResult["status"] = "ok";
  let message = `Единый SKU: ${metrics.totalSku} позиций из 1С, WB по chrtId.`;

  if (!hasSkuItems) {
    status = "error";
    message = "Справочник SKU в Supabase пуст.";
  } else if ((wbError || !wbUsable) && (ozonError || !ozonUsable)) {
    status = "error";
    message = "Не удалось загрузить данные Wildberries и Ozon.";
  } else if (wbError || ozonError || wbCardsScan.trashError || !wbCardsScan.isComplete) {
    status = "partial";
    message = `Единый SKU собран частично: ${metrics.totalSku} позиций из 1С, есть ошибки маркетплейсов.`;
  }

  return {
    source: "sku-unified",
    fetchedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    status,
    message,
    metrics,
    audit,
    wbDiagnostics,
    wbWithout1c,
    nmId96468303,
    items,
    ...(wbError ? { wbError } : {}),
    ...(ozonError ? { ozonError } : {}),
  };
}
