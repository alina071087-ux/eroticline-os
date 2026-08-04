import type {
  WbInventoryItem,
  WbInventoryResult,
  WbProductSource,
} from "@/lib/integrations/types";

export type WbInventoryGrouping = "warehouse" | "product";

export type WbInventorySortKey = "quantity" | "vendorCode" | "warehouseName";

export type WbInventorySortDirection = "asc" | "desc";

export type WbInventorySourceFilter = "all" | WbProductSource;

export type WbInventoryFilters = {
  search: string;
  warehouse: string;
  source: WbInventorySourceFilter;
  onlyWithStock: boolean;
};

export type WbInventoryTableRow = {
  id: string;
  nmID: number;
  vendorCode: string | null;
  displayTitle: string;
  warehouseName: string;
  quantity: number;
  inWayToClient: number;
  inWayFromClient: number;
  productSource: WbProductSource;
  productSourceLabel: string;
};

export type WbInventoryPageMetrics = {
  totalQuantity: number;
  totalInWayToClient: number;
  totalInWayFromClient: number;
  uniqueNmIds: number;
  uniqueWarehouses: number;
  matchedNmIdsCount: number;
  stockNmIdsCount: number;
};

export type { WbInventoryItem, WbInventoryResult, WbProductSource };
