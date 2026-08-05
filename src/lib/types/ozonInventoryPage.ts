import type {
  OzonInventoryItem,
  OzonInventoryResult,
} from "@/lib/integrations/ozon/types";
import type { OzonStockTypeTotals } from "@/lib/integrations/ozon/types";

export type OzonInventoryGrouping = "warehouse" | "product";

export type OzonInventorySortKey =
  | "offerId"
  | "warehouse"
  | "present"
  | "reserved"
  | "available";

export type OzonInventorySortDirection = "asc" | "desc";

export type OzonInventoryFilters = {
  search: string;
  warehouse: string;
  status: string;
  stockType: string;
  onlyWithAvailable: boolean;
  onlyUnmatched: boolean;
};

export type OzonInventoryTableRow = {
  id: string;
  offerId: string;
  displayName: string;
  productId: number;
  barcode: string | null;
  warehouseLabel: string;
  stockType: string;
  stockTypeLabel: string;
  present: number;
  reserved: number;
  available: number;
  productStatus: string | null;
  matched: boolean;
  matchedLabel: string;
};

export type OzonInventoryPageMetrics = {
  totalPresent: number;
  fboAvailable: number;
  fbsAvailable: number;
  totalReserved: number;
  totalAvailable: number;
  totalUniqueProducts: number;
  totalInventoryRows: number;
  matchedProductsCount: number;
  stockTypes: string[];
  totalsByType: Record<string, OzonStockTypeTotals>;
};

export type { OzonInventoryItem, OzonInventoryResult };
