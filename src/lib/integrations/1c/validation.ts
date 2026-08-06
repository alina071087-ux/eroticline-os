import "server-only";

import type {
  OneCFileQualityMetrics,
  OneCParsedRow,
} from "@/lib/integrations/1c/types";

export type OneCValidationResult = {
  metrics: OneCFileQualityMetrics;
  duplicateBarcodes: Set<string>;
};

export function validateOneCRows(rows: OneCParsedRow[]): OneCValidationResult {
  const barcodeCounts = new Map<string, number>();
  const pairCounts = new Map<string, number>();

  for (const row of rows) {
    if (row.barcode) {
      barcodeCounts.set(row.barcode, (barcodeCounts.get(row.barcode) ?? 0) + 1);
    }

    const pairKey = `${row.nomenclatureRaw}\u0000${row.characteristicRaw}`;
    pairCounts.set(pairKey, (pairCounts.get(pairKey) ?? 0) + 1);
  }

  const duplicateBarcodes = new Set<string>();
  for (const [barcode, count] of barcodeCounts) {
    if (count > 1) {
      duplicateBarcodes.add(barcode);
    }
  }

  let duplicatePairs = 0;
  for (const count of pairCounts.values()) {
    if (count > 1) {
      duplicatePairs += 1;
    }
  }

  const emptyBarcodes = rows.filter((row) => !row.barcode).length;
  const parseErrorRows = rows.filter((row) => row.parseWarnings.length > 0).length;
  const validRows = rows.filter(
    (row) => row.barcode && !duplicateBarcodes.has(row.barcode),
  ).length;

  return {
    duplicateBarcodes,
    metrics: {
      totalRows: rows.length,
      validRows,
      emptyBarcodes,
      duplicateBarcodes: duplicateBarcodes.size,
      duplicateNomenclatureCharacteristicPairs: duplicatePairs,
      parseErrorRows,
      uniqueArticles: new Set(rows.map((row) => row.article).filter(Boolean)).size,
      uniqueColors: new Set(rows.map((row) => row.color).filter(Boolean)).size,
      uniqueSizes: new Set(rows.map((row) => row.size).filter(Boolean)).size,
    },
  };
}
