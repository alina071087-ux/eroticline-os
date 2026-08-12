import type {
  OneCMatchStatus,
  OneCReconciliationRow,
  OneCSkuAuditResult,
} from "@/lib/integrations/1c/types";
import type {
  SkuCatalogItem,
  SkuImportChangesSummary,
  SkuImportCommitResult,
  SkuImportHistoryItem,
  SkuImportPreviewResult,
  SkuImportPreviewRow,
} from "@/lib/integrations/1c/import-types";

export type SkuDirectoryMatchStatusFilter = OneCMatchStatus | "all" | "matched_both";

export type SkuDirectoryFilters = {
  search: string;
  matchStatus: SkuDirectoryMatchStatusFilter;
  onlyWithErrors: boolean;
  onlyUnmatched: boolean;
  onlyMatchedBoth: boolean;
};

export type SkuDirectoryViewMode = "upload" | "catalog";

export type SkuCatalogFilters = {
  search: string;
  article: string;
  color: string;
  size: string;
  matchStatus: string;
  platform: "all" | "wb" | "ozon" | "both" | "none";
  onlyWithoutWb: boolean;
  onlyWithoutOzon: boolean;
};

export type {
  OneCMatchStatus,
  OneCReconciliationRow,
  OneCSkuAuditResult,
  SkuCatalogItem,
  SkuImportChangesSummary,
  SkuImportCommitResult,
  SkuImportHistoryItem,
  SkuImportPreviewResult,
  SkuImportPreviewRow,
};
