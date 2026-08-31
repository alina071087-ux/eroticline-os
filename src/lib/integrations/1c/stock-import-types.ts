export type StockSnapshotMatchStatus = "matched" | "unmatched";

export type OneCStockParsedRow = {
  rowNumber: number;
  nomenclatureRaw: string;
  characteristicRaw: string;
  barcode: string;
  stockTotal: number;
  stockAccepted: number;
  stockPacked: number;
};

export type OneCStockReconciledRow = OneCStockParsedRow & {
  skuItemId: string | null;
  article: string | null;
  productName: string | null;
  color: string | null;
  size: string | null;
  matchStatus: StockSnapshotMatchStatus;
  arithmeticOk: boolean;
};

export type OneCStockArithmeticMismatch = {
  rowNumber: number;
  barcode: string;
  nomenclatureRaw: string;
  characteristicRaw: string;
  stockTotal: number;
  stockAccepted: number;
  stockPacked: number;
  expectedSum: number;
  diff: number;
};

export type OneCStockExamples = Record<
  string,
  {
    stockTotal: number;
    stockAccepted: number;
    stockPacked: number;
    nomenclatureRaw: string;
    characteristicRaw: string;
  } | null
>;

export type OneCStockTotals = {
  stockTotal: number;
  stockAccepted: number;
  stockPacked: number;
};

export type StockImportRecord = {
  id: string;
  source: string;
  stock_date: string;
  file_name: string | null;
  file_hash: string;
  status: string;
  total_rows: number;
  matched_rows: number;
  unmatched_rows: number;
  total_stock: number;
  total_accepted: number;
  total_packed: number;
  created_at: string;
};

export type SkuStockSnapshotRecord = {
  id: string;
  stock_import_id: string;
  sku_item_id: string | null;
  barcode: string;
  nomenclature_raw: string | null;
  characteristic_raw: string | null;
  stock_total: number;
  stock_accepted: number;
  stock_packed: number;
  match_status: string;
  stock_date: string;
  created_at: string;
};

export type StockImportPreviewResult = {
  source: "1c";
  status: "ok" | "error";
  fileName: string;
  fileHash: string;
  stockDate: string;
  fetchedAt: string;
  durationMs: number;
  message?: string;
  rows: OneCStockReconciledRow[];
  matched: number;
  unmatched: number;
  totals: OneCStockTotals;
  arithmeticMismatches: OneCStockArithmeticMismatch[];
  examples: OneCStockExamples;
  unmatchedAudit?: UnmatchedStockAuditResult;
  error?: { code: string; message: string };
};

export type StockImportCommitResult = {
  source: "1c";
  status: "ok" | "error";
  stockImportId: string;
  fileName: string;
  stockDate: string;
  fetchedAt: string;
  durationMs: number;
  message?: string;
  totalRows: number;
  matchedRows: number;
  unmatchedRows: number;
  totals: OneCStockTotals;
  unknownSkuItemsCount: number;
  error?: { code: string; message: string };
};

export type StockImportHistoryItem = {
  id: string;
  stockDate: string;
  fileName: string | null;
  status: string;
  totalRows: number;
  matchedRows: number;
  unmatchedRows: number;
  totalStock: number;
  totalAccepted: number;
  totalPacked: number;
  createdAt: string;
};

export type KnownStockSnapshotItem = {
  stockStatus: "known";
  skuItemId: string;
  barcode: string;
  article: string | null;
  productName: string | null;
  color: string | null;
  size: string | null;
  nomenclatureRaw: string | null;
  characteristicRaw: string | null;
  stockTotal: number;
  stockAccepted: number;
  stockPacked: number;
  matchStatus: string;
  catalogMatchStatus: string | null;
};

export type UnknownStockSkuItem = {
  stockStatus: "unknown";
  skuItemId: string;
  barcode: string;
  article: string | null;
  productName: string | null;
  color: string | null;
  size: string | null;
  catalogMatchStatus: string | null;
};

export type LatestStockSnapshotResult = {
  source: "1c";
  status: "ok" | "not_found" | "error";
  fetchedAt: string;
  stockImport: StockImportHistoryItem | null;
  stockDate: string | null;
  known: KnownStockSnapshotItem[];
  unknownSkuItems: UnknownStockSkuItem[];
  unmatchedSnapshots: Array<{
    barcode: string;
    nomenclatureRaw: string | null;
    characteristicRaw: string | null;
    stockTotal: number;
    stockAccepted: number;
    stockPacked: number;
  }>;
  totals: OneCStockTotals & {
    knownRows: number;
    unknownSkuItems: number;
    unmatchedRows: number;
  };
  message?: string;
  error?: { code: string; message: string };
};

export type UnmatchedDiagnosticCandidate = {
  skuItemId: string;
  barcode: string;
  article: string | null;
  productName: string | null;
  color: string | null;
  size: string | null;
  nomenclatureRaw: string | null;
  characteristicRaw: string | null;
  catalogMatchStatus: string | null;
  diagnosticReason: string;
};

export type UnmatchedStockAuditRow = {
  barcode: string;
  nomenclature: string;
  characteristic: string;
  stockTotal: number;
  parsedArticle: string;
  parsedColor: string;
  parsedSize: string;
  classification:
    | "not_in_master"
    | "same_product_different_barcode"
    | "partial_nomenclature_match";
  diagnosticCandidates: UnmatchedDiagnosticCandidate[];
};

export type UnmatchedStockAuditResult = {
  totalUnmatched: number;
  notInMaster: number;
  sameProductDifferentBarcode: number;
  partialNomenclatureMatch: number;
  rows: UnmatchedStockAuditRow[];
};

export const DEFAULT_STOCK_EXAMPLE_BARCODES = [
  "2036757032191",
  "2036757032207",
  "2036757032214",
] as const;
