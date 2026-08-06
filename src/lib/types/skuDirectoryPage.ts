import type {
  OneCMatchStatus,
  OneCReconciliationRow,
  OneCSkuAuditResult,
} from "@/lib/integrations/1c/types";

export type SkuDirectoryMatchStatusFilter = OneCMatchStatus | "all" | "matched_both";

export type SkuDirectoryFilters = {
  search: string;
  matchStatus: SkuDirectoryMatchStatusFilter;
  onlyWithErrors: boolean;
  onlyUnmatched: boolean;
  onlyMatchedBoth: boolean;
};

export type { OneCMatchStatus, OneCReconciliationRow, OneCSkuAuditResult };
