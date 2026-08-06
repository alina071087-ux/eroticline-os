import type { IntegrationError } from "@/lib/integrations/types";

export type OneCErrorCode =
  | "MISSING_FILE"
  | "INVALID_EXTENSION"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE"
  | "PARSE_ERROR"
  | "EMPTY_FILE"
  | "INTERNAL_ERROR"
  | "API_ERROR";

export type OneCError = {
  code: OneCErrorCode;
  message: string;
};

export type OneCParsedRow = {
  rowNumber: number;
  nomenclatureRaw: string;
  characteristicRaw: string;
  barcode: string;
  article: string;
  productName: string;
  color: string;
  size: string;
  parseWarnings: string[];
};

export type OneCMatchStatus =
  | "matched_all"
  | "matched_wb_only"
  | "matched_ozon_only"
  | "unmatched"
  | "duplicate_barcode"
  | "ambiguous"
  | "invalid";

export type OneCReconciliationRow = {
  id: string;
  rowNumber: number;
  nomenclatureRaw: string;
  characteristicRaw: string;
  barcode: string;
  article: string;
  productName: string;
  color: string;
  size: string;
  wbNmId: number | null;
  wbVendorCode: string | null;
  wbMatched: boolean;
  ozonProductId: number | null;
  ozonOfferId: string | null;
  ozonMatched: boolean;
  matchStatus: OneCMatchStatus;
  warnings: string[];
  parseWarnings: string[];
};

export type OneCFileQualityMetrics = {
  totalRows: number;
  validRows: number;
  emptyBarcodes: number;
  duplicateBarcodes: number;
  duplicateNomenclatureCharacteristicPairs: number;
  parseErrorRows: number;
  uniqueArticles: number;
  uniqueColors: number;
  uniqueSizes: number;
};

export type OneCMatchingMetrics = {
  matchedAll: number;
  matchedWbOnly: number;
  matchedOzonOnly: number;
  unmatched: number;
  ambiguous: number;
  invalid: number;
  duplicateBarcode: number;
  wbBarcodesOutsideFile: number;
  ozonBarcodesOutsideFile: number;
  coveragePercent: number;
};

export type OneCSkuAuditResult = {
  source: "1c";
  status: "ok" | "error" | "partial";
  fileName: string;
  fetchedAt: string;
  durationMs: number;
  message?: string;
  error?: OneCError;
  fileQuality?: OneCFileQualityMetrics;
  matching?: OneCMatchingMetrics;
  rows?: OneCReconciliationRow[];
  partialErrors?: {
    wbProducts?: IntegrationError;
    ozonInventory?: IntegrationError;
  };
};

export type WbBarcodeHit = {
  nmId: number;
  vendorCode: string;
  techSize: string;
};

export type OzonBarcodeHit = {
  productId: number;
  offerId: string;
};

export const REQUIRED_1C_COLUMNS = [
  "Номенклатура",
  "Характеристика",
  "Штрихкод",
] as const;

export const WB_GRANULARITY_WARNING =
  "Wildberries передаёт остатки на уровне nmID, а не размера. Справочник 1С используется для идентификации SKU по штрихкоду, но не распределяет остаток WB по размерам без отдельного источника остатков 1С.";
