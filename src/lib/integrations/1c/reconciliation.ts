import "server-only";

import type { OzonInventoryItem } from "@/lib/integrations/ozon/types";
import { normalizeBarcodeValue } from "@/lib/integrations/1c/parser";
import type {
  OneCMatchStatus,
  OneCMatchingMetrics,
  OneCParsedRow,
  OneCReconciliationRow,
  OzonBarcodeHit,
  WbBarcodeHit,
} from "@/lib/integrations/1c/types";
import { WB_GRANULARITY_WARNING } from "@/lib/integrations/1c/types";
import type { WbProductCard } from "@/lib/integrations/types";
import { extractBarcodesFromCard } from "@/lib/integrations/wb/product-cards";

function uniqueWbHitsByNmId(hits: WbBarcodeHit[]): WbBarcodeHit[] {
  const byNmId = new Map<number, WbBarcodeHit>();
  for (const hit of hits) {
    byNmId.set(hit.nmId, hit);
  }
  return [...byNmId.values()];
}

function uniqueOzonHitsByProduct(hits: OzonBarcodeHit[]): OzonBarcodeHit[] {
  const byProduct = new Map<number, OzonBarcodeHit>();
  for (const hit of hits) {
    byProduct.set(hit.productId, hit);
  }
  return [...byProduct.values()];
}

export function buildWbBarcodeIndex(
  products: WbProductCard[],
): Map<string, WbBarcodeHit[]> {
  const index = new Map<string, WbBarcodeHit[]>();

  for (const product of products) {
    for (const size of product.sizes) {
      for (const barcode of size.barcodes) {
        const normalized = normalizeBarcodeValue(barcode);
        if (!normalized) {
          continue;
        }

        const bucket = index.get(normalized) ?? [];
        bucket.push({
          nmId: product.nmID,
          vendorCode: product.vendorCode,
          techSize: size.techSize,
        });
        index.set(normalized, bucket);
      }
    }

    for (const barcode of extractBarcodesFromCard(product)) {
      const normalized = normalizeBarcodeValue(barcode);
      if (!normalized) {
        continue;
      }

      const bucket = index.get(normalized) ?? [];
      const exists = bucket.some((hit) => hit.nmId === product.nmID);
      if (!exists) {
        bucket.push({
          nmId: product.nmID,
          vendorCode: product.vendorCode,
          techSize: "",
        });
        index.set(normalized, bucket);
      }
    }
  }

  for (const [barcode, hits] of index) {
    const unique = new Map<string, WbBarcodeHit>();
    for (const hit of hits) {
      unique.set(`${hit.nmId}:${hit.vendorCode}:${hit.techSize}`, hit);
    }
    index.set(barcode, [...unique.values()]);
  }

  return index;
}

function extractOzonBarcodes(item: OzonInventoryItem): string[] {
  const barcodes = new Set<string>();
  const primary = normalizeBarcodeValue(item.barcode);
  if (primary) {
    barcodes.add(primary);
  }

  for (const barcode of item.barcodes ?? []) {
    const normalized = normalizeBarcodeValue(barcode);
    if (normalized) {
      barcodes.add(normalized);
    }
  }

  return [...barcodes];
}

export function buildOzonBarcodeIndex(
  items: OzonInventoryItem[],
): Map<string, OzonBarcodeHit[]> {
  const index = new Map<string, OzonBarcodeHit[]>();

  for (const item of items) {
    for (const barcode of extractOzonBarcodes(item)) {
      const bucket = index.get(barcode) ?? [];
      bucket.push({
        productId: item.productId,
        offerId: item.offerId?.trim() || "—",
      });
      index.set(barcode, bucket);
    }
  }

  for (const [barcode, hits] of index) {
    const unique = new Map<string, OzonBarcodeHit>();
    for (const hit of hits) {
      unique.set(`${hit.productId}:${hit.offerId}`, hit);
    }
    index.set(barcode, [...unique.values()]);
  }

  return index;
}

function resolveMatchStatus(
  parsed: OneCParsedRow,
  duplicateBarcodes: Set<string>,
  wbHits: WbBarcodeHit[],
  ozonHits: OzonBarcodeHit[],
): OneCMatchStatus {
  if (!parsed.barcode) {
    return "invalid";
  }

  if (duplicateBarcodes.has(parsed.barcode)) {
    return "duplicate_barcode";
  }

  if (wbHits.length > 1 || ozonHits.length > 1) {
    return "ambiguous";
  }

  if (wbHits.length > 0 && ozonHits.length > 0) {
    return "matched_all";
  }

  if (wbHits.length > 0) {
    return "matched_wb_only";
  }

  if (ozonHits.length > 0) {
    return "matched_ozon_only";
  }

  return "unmatched";
}

export function reconcileOneCRows(
  rows: OneCParsedRow[],
  duplicateBarcodes: Set<string>,
  wbIndex: Map<string, WbBarcodeHit[]>,
  ozonIndex: Map<string, OzonBarcodeHit[]>,
): OneCReconciliationRow[] {
  return rows.map((parsed, index) => {
    const warnings = [...parsed.parseWarnings];

    if (!parsed.barcode) {
      warnings.push("Строка 1С без штрихкода");
      return buildRow(parsed, index, {
        matchStatus: "invalid",
        warnings,
      });
    }

    if (duplicateBarcodes.has(parsed.barcode)) {
      warnings.push("Дублирующийся штрихкод в выгрузке 1С");
    }

    const wbHits = uniqueWbHitsByNmId(wbIndex.get(parsed.barcode) ?? []);
    const ozonHits = uniqueOzonHitsByProduct(ozonIndex.get(parsed.barcode) ?? []);
    const matchStatus = resolveMatchStatus(
      parsed,
      duplicateBarcodes,
      wbHits,
      ozonHits,
    );

    if (matchStatus === "ambiguous") {
      if (wbHits.length > 1) {
        warnings.push(
          `Штрихкод найден в нескольких nmID WB: ${wbHits
            .slice(0, 5)
            .map((hit) => hit.nmId)
            .join(", ")}`,
        );
      }
      if (ozonHits.length > 1) {
        warnings.push(
          `Штрихкод найден в нескольких productId Ozon: ${ozonHits
            .slice(0, 5)
            .map((hit) => hit.productId)
            .join(", ")}`,
        );
      }
    }

    if (matchStatus === "unmatched") {
      warnings.push("Штрихкод не найден ни в WB, ни в Ozon");
    }

    const wbHit = wbHits[0];
    const ozonHit = ozonHits[0];

    if (wbHit) {
      warnings.push(WB_GRANULARITY_WARNING);
    }

    return buildRow(parsed, index, {
      matchStatus,
      warnings,
      wbNmId: wbHit?.nmId ?? null,
      wbVendorCode: wbHit?.vendorCode ?? null,
      wbMatched: Boolean(wbHit),
      ozonProductId: ozonHit?.productId ?? null,
      ozonOfferId: ozonHit?.offerId ?? null,
      ozonMatched: Boolean(ozonHit),
    });
  });
}

function buildRow(
  parsed: OneCParsedRow,
  index: number,
  overrides: Partial<OneCReconciliationRow> & { matchStatus: OneCMatchStatus },
): OneCReconciliationRow {
  return {
    id: `1c-row-${parsed.rowNumber}-${index}`,
    rowNumber: parsed.rowNumber,
    nomenclatureRaw: parsed.nomenclatureRaw,
    characteristicRaw: parsed.characteristicRaw,
    barcode: parsed.barcode,
    article: parsed.article,
    productName: parsed.productName,
    color: parsed.color,
    size: parsed.size,
    wbNmId: null,
    wbVendorCode: null,
    wbMatched: false,
    ozonProductId: null,
    ozonOfferId: null,
    ozonMatched: false,
    parseWarnings: parsed.parseWarnings,
    warnings: [],
    ...overrides,
  };
}

export function buildMatchingMetrics(
  rows: OneCReconciliationRow[],
  oneCBarcodes: Set<string>,
  wbIndex: Map<string, WbBarcodeHit[]>,
  ozonIndex: Map<string, OzonBarcodeHit[]>,
): OneCMatchingMetrics {
  let matchedAll = 0;
  let matchedWbOnly = 0;
  let matchedOzonOnly = 0;
  let unmatched = 0;
  let ambiguous = 0;
  let invalid = 0;
  let duplicateBarcode = 0;

  for (const row of rows) {
    switch (row.matchStatus) {
      case "matched_all":
        matchedAll += 1;
        break;
      case "matched_wb_only":
        matchedWbOnly += 1;
        break;
      case "matched_ozon_only":
        matchedOzonOnly += 1;
        break;
      case "unmatched":
        unmatched += 1;
        break;
      case "ambiguous":
        ambiguous += 1;
        break;
      case "invalid":
        invalid += 1;
        break;
      case "duplicate_barcode":
        duplicateBarcode += 1;
        break;
    }
  }

  const wbBarcodes = new Set(wbIndex.keys());
  const ozonBarcodes = new Set(ozonIndex.keys());
  const rowsWithBarcode = rows.filter((row) => row.barcode).length;
  const matchedAny = matchedAll + matchedWbOnly + matchedOzonOnly;
  const coveragePercent =
    rowsWithBarcode > 0 ? Math.round((matchedAny / rowsWithBarcode) * 1000) / 10 : 0;

  return {
    matchedAll,
    matchedWbOnly,
    matchedOzonOnly,
    unmatched,
    ambiguous,
    invalid,
    duplicateBarcode,
    wbBarcodesOutsideFile: [...wbBarcodes].filter((barcode) => !oneCBarcodes.has(barcode))
      .length,
    ozonBarcodesOutsideFile: [...ozonBarcodes].filter(
      (barcode) => !oneCBarcodes.has(barcode),
    ).length,
    coveragePercent,
  };
}
