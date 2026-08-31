import "server-only";

import type {
  KnownStockSnapshotItem,
  LatestStockSnapshotResult,
  UnknownStockSkuItem,
} from "@/lib/integrations/1c/stock-import-types";
import {
  fetchAllSkuItemsForStock,
  fetchLatestStockImport,
  fetchSnapshotsByImportId,
  fetchStockImportHistory,
} from "@/lib/integrations/1c/stock-repository";

function buildLatestResult(
  partial: Omit<LatestStockSnapshotResult, "source" | "fetchedAt">,
): LatestStockSnapshotResult {
  return {
    source: "1c",
    fetchedAt: new Date().toISOString(),
    ...partial,
  };
}

export async function fetchLatestStockSnapshot(): Promise<LatestStockSnapshotResult> {
  try {
    const latestImport = await fetchLatestStockImport();

    if (!latestImport) {
      return buildLatestResult({
        status: "not_found",
        stockImport: null,
        stockDate: null,
        known: [],
        unknownSkuItems: [],
        unmatchedSnapshots: [],
        totals: {
          stockTotal: 0,
          stockAccepted: 0,
          stockPacked: 0,
          knownRows: 0,
          unknownSkuItems: 0,
          unmatchedRows: 0,
        },
        message: "Snapshot остатков 1С ещё не импортирован",
      });
    }

    const [snapshots, skuItems] = await Promise.all([
      fetchSnapshotsByImportId(latestImport.id),
      fetchAllSkuItemsForStock(),
    ]);

    const snapshotByBarcode = new Map(
      snapshots.map((snapshot) => [snapshot.barcode, snapshot]),
    );
    const snapshotBySkuItemId = new Map(
      snapshots
        .filter((snapshot) => snapshot.sku_item_id)
        .map((snapshot) => [snapshot.sku_item_id as string, snapshot]),
    );

    const known: KnownStockSnapshotItem[] = [];
    const unknownSkuItems: UnknownStockSkuItem[] = [];

    for (const skuItem of skuItems) {
      const snapshot =
        snapshotBySkuItemId.get(skuItem.id) ??
        snapshotByBarcode.get(skuItem.barcode);

      if (snapshot) {
        known.push({
          stockStatus: "known",
          skuItemId: skuItem.id,
          barcode: skuItem.barcode,
          article: skuItem.article,
          productName: skuItem.product_name,
          color: skuItem.color,
          size: skuItem.size,
          nomenclatureRaw: snapshot.nomenclature_raw,
          characteristicRaw: snapshot.characteristic_raw,
          stockTotal: snapshot.stock_total,
          stockAccepted: snapshot.stock_accepted,
          stockPacked: snapshot.stock_packed,
          matchStatus: snapshot.match_status,
          catalogMatchStatus: skuItem.match_status,
        });
      } else {
        unknownSkuItems.push({
          stockStatus: "unknown",
          skuItemId: skuItem.id,
          barcode: skuItem.barcode,
          article: skuItem.article,
          productName: skuItem.product_name,
          color: skuItem.color,
          size: skuItem.size,
          catalogMatchStatus: skuItem.match_status,
        });
      }
    }

    const unmatchedSnapshots = snapshots
      .filter((snapshot) => snapshot.match_status === "unmatched")
      .map((snapshot) => ({
        barcode: snapshot.barcode,
        nomenclatureRaw: snapshot.nomenclature_raw,
        characteristicRaw: snapshot.characteristic_raw,
        stockTotal: snapshot.stock_total,
        stockAccepted: snapshot.stock_accepted,
        stockPacked: snapshot.stock_packed,
      }));

    const totals = snapshots.reduce(
      (acc, snapshot) => ({
        stockTotal: acc.stockTotal + snapshot.stock_total,
        stockAccepted: acc.stockAccepted + snapshot.stock_accepted,
        stockPacked: acc.stockPacked + snapshot.stock_packed,
        knownRows: acc.knownRows,
        unknownSkuItems: acc.unknownSkuItems,
        unmatchedRows: acc.unmatchedRows,
      }),
      {
        stockTotal: 0,
        stockAccepted: 0,
        stockPacked: 0,
        knownRows: known.length,
        unknownSkuItems: unknownSkuItems.length,
        unmatchedRows: unmatchedSnapshots.length,
      },
    );

    return buildLatestResult({
      status: "ok",
      stockImport: {
        id: latestImport.id,
        stockDate: latestImport.stock_date,
        fileName: latestImport.file_name,
        status: latestImport.status,
        totalRows: latestImport.total_rows,
        matchedRows: latestImport.matched_rows,
        unmatchedRows: latestImport.unmatched_rows,
        totalStock: latestImport.total_stock,
        totalAccepted: latestImport.total_accepted,
        totalPacked: latestImport.total_packed,
        createdAt: latestImport.created_at,
      },
      stockDate: latestImport.stock_date,
      known,
      unknownSkuItems,
      unmatchedSnapshots,
      totals,
      message: `Последний snapshot: ${latestImport.stock_date}, known ${known.length}, unknown ${unknownSkuItems.length}.`,
    });
  } catch (error) {
    return buildLatestResult({
      status: "error",
      stockImport: null,
      stockDate: null,
      known: [],
      unknownSkuItems: [],
      unmatchedSnapshots: [],
      totals: {
        stockTotal: 0,
        stockAccepted: 0,
        stockPacked: 0,
        knownRows: 0,
        unknownSkuItems: 0,
        unmatchedRows: 0,
      },
      message: "Не удалось загрузить последний snapshot остатков",
      error: {
        code: "DATABASE_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Не удалось загрузить последний snapshot остатков",
      },
    });
  }
}

export async function listStockImports(limit = 20) {
  return fetchStockImportHistory(limit);
}
