import "server-only";

import type { SkuItemRecord } from "@/lib/integrations/1c/import-types";
import {
  parseCharacteristic,
  parseNomenclature,
} from "@/lib/integrations/1c/parser";
import type {
  OneCStockArithmeticMismatch,
  OneCStockExamples,
  OneCStockReconciledRow,
  OneCStockTotals,
  StockSnapshotMatchStatus,
  UnmatchedStockAuditResult,
} from "@/lib/integrations/1c/stock-import-types";
import { DEFAULT_STOCK_EXAMPLE_BARCODES } from "@/lib/integrations/1c/stock-import-types";
import type { OneCStockParsedRow } from "@/lib/integrations/1c/stock-import-types";
import { auditUnmatchedStockRows } from "@/lib/integrations/1c/stock-unmatched-audit";

export function validateStockArithmetic(
  rows: OneCStockParsedRow[],
): OneCStockArithmeticMismatch[] {
  const mismatches: OneCStockArithmeticMismatch[] = [];

  for (const row of rows) {
    const expectedSum = row.stockAccepted + row.stockPacked;
    if (row.stockTotal !== expectedSum) {
      mismatches.push({
        rowNumber: row.rowNumber,
        barcode: row.barcode,
        nomenclatureRaw: row.nomenclatureRaw,
        characteristicRaw: row.characteristicRaw,
        stockTotal: row.stockTotal,
        stockAccepted: row.stockAccepted,
        stockPacked: row.stockPacked,
        expectedSum,
        diff: row.stockTotal - expectedSum,
      });
    }
  }

  return mismatches;
}

export function computeStockTotals(rows: OneCStockParsedRow[]): OneCStockTotals {
  return rows.reduce(
    (totals, row) => ({
      stockTotal: totals.stockTotal + row.stockTotal,
      stockAccepted: totals.stockAccepted + row.stockAccepted,
      stockPacked: totals.stockPacked + row.stockPacked,
    }),
    { stockTotal: 0, stockAccepted: 0, stockPacked: 0 },
  );
}

export function buildStockExamples(
  rows: OneCStockParsedRow[],
  barcodes: readonly string[] = DEFAULT_STOCK_EXAMPLE_BARCODES,
): OneCStockExamples {
  const examples: OneCStockExamples = {};

  for (const barcode of barcodes) {
    const row = rows.find((item) => item.barcode === barcode);
    examples[barcode] = row
      ? {
          stockTotal: row.stockTotal,
          stockAccepted: row.stockAccepted,
          stockPacked: row.stockPacked,
          nomenclatureRaw: row.nomenclatureRaw,
          characteristicRaw: row.characteristicRaw,
        }
      : null;
  }

  return examples;
}

export function reconcileStockRows(
  rows: OneCStockParsedRow[],
  skuByBarcode: Map<string, SkuItemRecord>,
): {
  reconciledRows: OneCStockReconciledRow[];
  matched: number;
  unmatched: number;
  unmatchedAudit: UnmatchedStockAuditResult;
} {
  const reconciledRows: OneCStockReconciledRow[] = [];
  let matched = 0;
  let unmatched = 0;

  for (const row of rows) {
    const skuItem = row.barcode ? skuByBarcode.get(row.barcode) : undefined;
    const matchStatus: StockSnapshotMatchStatus = skuItem ? "matched" : "unmatched";

    if (skuItem) {
      matched += 1;
    } else if (row.barcode) {
      unmatched += 1;
    }

    reconciledRows.push({
      ...row,
      skuItemId: skuItem?.id ?? null,
      article:
        skuItem?.article ??
        (parseNomenclature(row.nomenclatureRaw).article || null),
      productName:
        skuItem?.product_name ??
        (parseNomenclature(row.nomenclatureRaw).productName || null),
      color:
        skuItem?.color ??
        (parseCharacteristic(row.characteristicRaw).color || null),
      size:
        skuItem?.size ?? (parseCharacteristic(row.characteristicRaw).size || null),
      matchStatus,
      arithmeticOk: row.stockTotal === row.stockAccepted + row.stockPacked,
    });
  }

  const unmatchedAudit = auditUnmatchedStockRows(
    reconciledRows.filter((row) => row.matchStatus === "unmatched"),
    [...skuByBarcode.values()],
  );

  return {
    reconciledRows,
    matched,
    unmatched,
    unmatchedAudit,
  };
}
