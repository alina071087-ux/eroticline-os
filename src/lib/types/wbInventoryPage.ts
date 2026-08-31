import type {
  WbInventoryItem,
  WbInventoryResult,
  WbProductSource,
} from "@/lib/integrations/types";

export type WbInventoryGrouping = "warehouse" | "size";

export type WbInventorySortKey =
  | "quantity"
  | "vendorCode"
  | "warehouseName"
  | "techSize";

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
  chrtId: number | null;
  techSize: string | null;
  barcode: string | null;
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
  uniqueChrtIds: number;
  uniqueWarehouses: number;
  matchedNmIdsCount: number;
  stockNmIdsCount: number;
  serverTotalQuantity: number;
  totalsMatch: boolean;
};

export type { WbInventoryItem, WbInventoryResult, WbProductSource };
