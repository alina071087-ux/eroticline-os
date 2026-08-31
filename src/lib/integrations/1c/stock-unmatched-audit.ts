import "server-only";

import type { SkuItemRecord } from "@/lib/integrations/1c/import-types";
import { parseCharacteristic, parseNomenclature } from "@/lib/integrations/1c/parser";
import type {
  OneCStockReconciledRow,
  UnmatchedDiagnosticCandidate,
  UnmatchedStockAuditResult,
  UnmatchedStockAuditRow,
} from "@/lib/integrations/1c/stock-import-types";

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function buildSkuIndexes(skuItems: SkuItemRecord[]) {
  const byCharacteristic = new Map<string, SkuItemRecord[]>();
  const byArticleCharacteristic = new Map<string, SkuItemRecord[]>();
  const byArticleColorSize = new Map<string, SkuItemRecord[]>();

  for (const item of skuItems) {
    const characteristicKey = normalizeText(item.characteristic_raw);
    if (characteristicKey) {
      const list = byCharacteristic.get(characteristicKey) ?? [];
      list.push(item);
      byCharacteristic.set(characteristicKey, list);
    }

    const article = normalizeText(item.article);
    if (article && characteristicKey) {
      const key = `${article}::${characteristicKey}`;
      const list = byArticleCharacteristic.get(key) ?? [];
      list.push(item);
      byArticleCharacteristic.set(key, list);
    }

    const color = normalizeText(item.color);
    const size = normalizeText(item.size);
    if (article && color && size) {
      const key = `${article}::${color}::${size}`;
      const list = byArticleColorSize.get(key) ?? [];
      list.push(item);
      byArticleColorSize.set(key, list);
    }
  }

  return {
    byCharacteristic,
    byArticleCharacteristic,
    byArticleColorSize,
  };
}

function toCandidate(
  item: SkuItemRecord,
  diagnosticReason: string,
): UnmatchedDiagnosticCandidate {
  return {
    skuItemId: item.id,
    barcode: item.barcode,
    article: item.article,
    productName: item.product_name,
    color: item.color,
    size: item.size,
    nomenclatureRaw: item.nomenclature_raw,
    characteristicRaw: item.characteristic_raw,
    catalogMatchStatus: item.match_status,
    diagnosticReason,
  };
}

function classifyUnmatchedRow(
  row: OneCStockReconciledRow,
  skuItems: SkuItemRecord[],
  indexes: ReturnType<typeof buildSkuIndexes>,
): UnmatchedStockAuditRow {
  const parsedNomenclature = parseNomenclature(row.nomenclatureRaw);
  const parsedCharacteristic = parseCharacteristic(row.characteristicRaw);
  const parsedArticle = parsedNomenclature.article;
  const parsedColor = parsedCharacteristic.color;
  const parsedSize = parsedCharacteristic.size;

  const characteristicKey = normalizeText(row.characteristicRaw);
  const articleCharacteristicKey = `${normalizeText(parsedArticle)}::${characteristicKey}`;
  const articleColorSizeKey = `${normalizeText(parsedArticle)}::${normalizeText(parsedColor)}::${normalizeText(parsedSize)}`;

  const candidates = new Map<string, UnmatchedDiagnosticCandidate>();

  const exactArticleCharacteristic =
    indexes.byArticleCharacteristic.get(articleCharacteristicKey) ?? [];
  for (const item of exactArticleCharacteristic) {
    if (item.barcode === row.barcode) {
      continue;
    }
    candidates.set(
      item.id,
      toCandidate(item, "same article + characteristic_raw, different barcode"),
    );
  }

  const exactArticleColorSize =
    indexes.byArticleColorSize.get(articleColorSizeKey) ?? [];
  for (const item of exactArticleColorSize) {
    if (item.barcode === row.barcode) {
      continue;
    }
    candidates.set(
      item.id,
      toCandidate(item, "same article + color + size, different barcode"),
    );
  }

  const sameCharacteristic = indexes.byCharacteristic.get(characteristicKey) ?? [];
  for (const item of sameCharacteristic) {
    if (item.barcode === row.barcode) {
      continue;
    }
    if (candidates.has(item.id)) {
      continue;
    }
    candidates.set(
      item.id,
      toCandidate(item, "same characteristic_raw, different barcode"),
    );
  }

  const diagnosticCandidates = [...candidates.values()];

  let classification: UnmatchedStockAuditRow["classification"] = "not_in_master";

  if (
    diagnosticCandidates.some((candidate) =>
      candidate.diagnosticReason.includes("article + characteristic_raw"),
    ) ||
    diagnosticCandidates.some((candidate) =>
      candidate.diagnosticReason.includes("article + color + size"),
    )
  ) {
    classification = "same_product_different_barcode";
  } else if (diagnosticCandidates.length > 0) {
    classification = "partial_nomenclature_match";
  }

  return {
    barcode: row.barcode,
    nomenclature: row.nomenclatureRaw,
    characteristic: row.characteristicRaw,
    stockTotal: row.stockTotal,
    parsedArticle,
    parsedColor,
    parsedSize,
    classification,
    diagnosticCandidates,
  };
}

export function auditUnmatchedStockRows(
  unmatchedRows: OneCStockReconciledRow[],
  skuItems: SkuItemRecord[],
): UnmatchedStockAuditResult {
  const indexes = buildSkuIndexes(skuItems);
  const rows = unmatchedRows.map((row) =>
    classifyUnmatchedRow(row, skuItems, indexes),
  );

  return {
    totalUnmatched: rows.length,
    notInMaster: rows.filter((row) => row.classification === "not_in_master").length,
    sameProductDifferentBarcode: rows.filter(
      (row) => row.classification === "same_product_different_barcode",
    ).length,
    partialNomenclatureMatch: rows.filter(
      (row) => row.classification === "partial_nomenclature_match",
    ).length,
    rows: rows.sort((left, right) => right.stockTotal - left.stockTotal),
  };
}
