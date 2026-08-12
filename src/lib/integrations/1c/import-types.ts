import type {
  OneCFileQualityMetrics,
  OneCMatchingMetrics,
  OneCMatchStatus,
  OneCReconciliationRow,
} from "@/lib/integrations/1c/types";

export type SkuImportStatus = "preview" | "committed" | "completed" | "failed";

export type SkuImportRecord = {
  id: string;
  source: string;
  file_name: string | null;
  imported_at: string;
  total_rows: number;
  valid_rows: number;
  matched_all: number;
  matched_wb_only: number;
  matched_ozon_only: number;
  unmatched: number;
  ambiguous: number;
  coverage_percent: number | null;
  status: SkuImportStatus | string;
  error_count: number;
  added_count: number;
  updated_count: number;
  unchanged_count: number;
};

export type SkuItemRecord = {
  id: string;
  barcode: string;
  article: string | null;
  product_name: string | null;
  nomenclature_raw: string | null;
  characteristic_raw: string | null;
  color: string | null;
  size: string | null;
  wb_nmid: number | null;
  wb_vendor_code: string | null;
  ozon_product_id: number | null;
  ozon_offer_id: string | null;
  match_status: string;
  match_method: string;
  warnings: string[];
  import_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SkuImportChangesSummary = {
  newCount: number;
  updateCount: number;
  unchangedCount: number;
  errorCount: number;
  totalToSave: number;
};

export type SkuImportPreviewRow = OneCReconciliationRow & {
  changeType: "new" | "update" | "unchanged" | "error";
  changeFields: string[];
};

export type SkuImportPreviewResult = {
  source: "1c";
  status: "ok" | "error" | "partial";
  importPreviewId: string;
  fileName: string;
  fetchedAt: string;
  durationMs: number;
  message?: string;
  metrics?: {
    fileQuality: OneCFileQualityMetrics;
    matching: OneCMatchingMetrics;
  };
  rows?: SkuImportPreviewRow[];
  changesSummary?: SkuImportChangesSummary;
  error?: { code: string; message: string };
};

export type SkuImportCommitResult = {
  source: "1c";
  status: "ok" | "error";
  importId: string;
  importPreviewId: string;
  fetchedAt: string;
  durationMs: number;
  message?: string;
  addedCount: number;
  updatedCount: number;
  unchangedCount: number;
  errorCount: number;
  importedAt?: string;
  error?: { code: string; message: string };
};

export type SkuImportHistoryItem = {
  id: string;
  importedAt: string;
  fileName: string | null;
  totalRows: number;
  addedCount: number;
  updatedCount: number;
  errorCount: number;
  status: string;
};

export type SkuCatalogItem = {
  barcode: string;
  article: string | null;
  productName: string | null;
  color: string | null;
  size: string | null;
  wbNmId: number | null;
  wbVendorCode: string | null;
  ozonProductId: number | null;
  ozonOfferId: string | null;
  matchStatus: OneCMatchStatus | string;
  matchMethod: string;
  updatedAt: string;
};

export const SKU_COMPARE_FIELDS = [
  "article",
  "productName",
  "color",
  "size",
  "wbNmId",
  "wbVendorCode",
  "ozonProductId",
  "ozonOfferId",
  "matchStatus",
  "matchMethod",
] as const;

export type SkuComparableField = (typeof SKU_COMPARE_FIELDS)[number];

export const SKU_MATCH_METHOD = "barcode";

export type SkuItemsQuery = {
  search?: string;
  article?: string;
  color?: string;
  size?: string;
  matchStatus?: string;
  platform?: "all" | "wb" | "ozon" | "both" | "none";
  onlyWithoutWb?: boolean;
  onlyWithoutOzon?: boolean;
};
