import "server-only";

import type { OneCReconciliationRow } from "@/lib/integrations/1c/types";
import type {
  SkuComparableField,
  SkuImportChangesSummary,
  SkuImportPreviewRow,
  SkuItemRecord,
} from "@/lib/integrations/1c/import-types";
import { SKU_COMPARE_FIELDS, SKU_MATCH_METHOD } from "@/lib/integrations/1c/import-types";

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normalizeNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function getComparableValues(row: OneCReconciliationRow) {
  return {
    article: normalizeText(row.article),
    productName: normalizeText(row.productName),
    color: normalizeText(row.color),
    size: normalizeText(row.size),
    wbNmId: normalizeNumber(row.wbNmId),
    wbVendorCode: normalizeText(row.wbVendorCode),
    ozonProductId: normalizeNumber(row.ozonProductId),
    ozonOfferId: normalizeText(row.ozonOfferId),
    matchStatus: normalizeText(row.matchStatus),
    matchMethod: SKU_MATCH_METHOD,
  };
}

function getExistingComparableValues(item: SkuItemRecord) {
  return {
    article: normalizeText(item.article),
    productName: normalizeText(item.product_name),
    color: normalizeText(item.color),
    size: normalizeText(item.size),
    wbNmId: normalizeNumber(item.wb_nmid),
    wbVendorCode: normalizeText(item.wb_vendor_code),
    ozonProductId: normalizeNumber(item.ozon_product_id),
    ozonOfferId: normalizeText(item.ozon_offer_id),
    matchStatus: normalizeText(item.match_status),
    matchMethod: normalizeText(item.match_method) || SKU_MATCH_METHOD,
  };
}

const FIELD_LABELS: Record<SkuComparableField, string> = {
  article: "Артикул",
  productName: "Название",
  color: "Цвет",
  size: "Размер",
  wbNmId: "WB nmID",
  wbVendorCode: "WB артикул",
  ozonProductId: "Ozon productId",
  ozonOfferId: "Ozon offerId",
  matchStatus: "Статус",
  matchMethod: "Метод",
};

function diffFields(
  incoming: ReturnType<typeof getComparableValues>,
  existing: ReturnType<typeof getExistingComparableValues>,
): string[] {
  const changed: string[] = [];

  for (const field of SKU_COMPARE_FIELDS) {
    if (incoming[field] !== existing[field]) {
      changed.push(FIELD_LABELS[field]);
    }
  }

  return changed;
}

function isCommitEligible(row: OneCReconciliationRow): boolean {
  if (!row.barcode.trim()) {
    return false;
  }

  if (row.matchStatus === "duplicate_barcode" || row.matchStatus === "invalid") {
    return false;
  }

  return true;
}

export function buildImportPreviewRows(
  rows: OneCReconciliationRow[],
  existingByBarcode: Map<string, SkuItemRecord>,
): { previewRows: SkuImportPreviewRow[]; summary: SkuImportChangesSummary } {
  let newCount = 0;
  let updateCount = 0;
  let unchangedCount = 0;
  let errorCount = 0;

  const previewRows: SkuImportPreviewRow[] = rows.map((row) => {
    if (!isCommitEligible(row)) {
      errorCount += 1;
      return {
        ...row,
        changeType: "error",
        changeFields: [],
      };
    }

    const existing = existingByBarcode.get(row.barcode);

    if (!existing) {
      newCount += 1;
      return {
        ...row,
        changeType: "new",
        changeFields: [],
      };
    }

    const changeFields = diffFields(
      getComparableValues(row),
      getExistingComparableValues(existing),
    );

    if (changeFields.length > 0) {
      updateCount += 1;
      return {
        ...row,
        changeType: "update",
        changeFields,
      };
    }

    unchangedCount += 1;
    return {
      ...row,
      changeType: "unchanged",
      changeFields: [],
    };
  });

  return {
    previewRows,
    summary: {
      newCount,
      updateCount,
      unchangedCount,
      errorCount,
      totalToSave: newCount + updateCount + unchangedCount,
    },
  };
}

export function reconciliationRowToSkuItemInsert(
  row: OneCReconciliationRow,
  importId: string,
) {
  return {
    barcode: row.barcode.trim(),
    article: row.article || null,
    product_name: row.productName || null,
    nomenclature_raw: row.nomenclatureRaw || null,
    characteristic_raw: row.characteristicRaw || null,
    color: row.color || null,
    size: row.size || null,
    wb_nmid: row.wbNmId,
    wb_vendor_code: row.wbVendorCode,
    ozon_product_id: row.ozonProductId,
    ozon_offer_id: row.ozonOfferId,
    match_status: row.matchStatus,
    match_method: SKU_MATCH_METHOD,
    warnings: [...row.parseWarnings, ...row.warnings],
    import_id: importId,
  };
}

export function validateCommitRows(rows: OneCReconciliationRow[]): {
  validRows: OneCReconciliationRow[];
  errorCount: number;
  errors: string[];
} {
  const seenBarcodes = new Set<string>();
  const validRows: OneCReconciliationRow[] = [];
  const errors: string[] = [];

  for (const row of rows) {
    const barcode = row.barcode.trim();

    if (!barcode) {
      errors.push(`Строка ${row.rowNumber}: пустой штрихкод`);
      continue;
    }

    if (seenBarcodes.has(barcode)) {
      errors.push(`Строка ${row.rowNumber}: дублирующийся штрихкод ${barcode}`);
      continue;
    }

    seenBarcodes.add(barcode);

    if (row.matchStatus === "duplicate_barcode" || row.matchStatus === "invalid") {
      errors.push(`Строка ${row.rowNumber}: строка помечена как ${row.matchStatus}`);
      continue;
    }

    validRows.push(row);
  }

  return {
    validRows,
    errorCount: errors.length,
    errors,
  };
}
