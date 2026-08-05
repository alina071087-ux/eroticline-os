import type {
  OzonInventoryFilters,
  OzonInventoryGrouping,
  OzonInventoryItem,
  OzonInventoryPageMetrics,
  OzonInventoryResult,
  OzonInventorySortDirection,
  OzonInventorySortKey,
  OzonInventoryTableRow,
} from "@/lib/types/ozonInventoryPage";

export function formatInventoryNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function formatFetchedAt(isoDate: string): string {
  return new Date(isoDate).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getDisplayName(item: OzonInventoryItem): string {
  if (item.name?.trim()) {
    return item.name.trim();
  }

  return "Без названия";
}

export function getDisplayBarcode(item: OzonInventoryItem): string | null {
  if (item.barcode?.trim()) {
    return item.barcode.trim();
  }

  if (item.barcodes?.length) {
    return item.barcodes[0] ?? null;
  }

  return null;
}

export function getWarehouseLabel(item: OzonInventoryItem): string {
  if (item.warehouseName?.trim()) {
    return item.warehouseName.trim();
  }

  if (item.warehouseId) {
    return `Склад ${item.warehouseId}`;
  }

  return "—";
}

export function getMatchedLabel(matched: boolean): string {
  return matched ? "Сопоставлен" : "Не сопоставлен";
}

export function getStockTypeLabel(stockType: string): string {
  switch (stockType.toLowerCase()) {
    case "fbo":
      return "FBO — склады Ozon";
    case "fbs":
      return "FBS — наш склад";
    default:
      return stockType;
  }
}

export function getStockTypeMetricLabel(stockType: string): string {
  switch (stockType.toLowerCase()) {
    case "fbo":
      return "На складах Ozon (FBO)";
    case "fbs":
      return "На нашем складе (FBS)";
    default:
      return `Доступно (${stockType})`;
  }
}

export function getAvailableForStockType(
  totalsByType: OzonInventoryResult["totals"],
  stockType: string,
): number {
  return totalsByType?.totalsByType?.[stockType]?.available ?? 0;
}

export function buildInventoryMetrics(
  result: OzonInventoryResult,
): OzonInventoryPageMetrics {
  const totalsByType = result.totals?.totalsByType ?? {};

  return {
    totalPresent: result.totals?.present ?? 0,
    fboAvailable: getAvailableForStockType(result.totals, "fbo"),
    fbsAvailable: getAvailableForStockType(result.totals, "fbs"),
    totalReserved: result.totals?.reserved ?? 0,
    totalAvailable: result.totals?.available ?? 0,
    totalUniqueProducts: result.totalUniqueProducts ?? 0,
    totalInventoryRows: result.totalInventoryRows ?? 0,
    matchedProductsCount: result.matchedProductsCount ?? 0,
    stockTypes: result.stockTypes ?? Object.keys(totalsByType),
    totalsByType,
  };
}

export function groupInventoryItems(
  items: OzonInventoryItem[],
  grouping: OzonInventoryGrouping,
): OzonInventoryItem[] {
  if (grouping === "warehouse") {
    return items;
  }

  const grouped = new Map<number, OzonInventoryItem>();

  for (const item of items) {
    const existing = grouped.get(item.productId);

    if (!existing) {
      grouped.set(item.productId, {
        ...item,
        warehouseName: undefined,
        warehouseId: undefined,
        stockType: "all",
      });
      continue;
    }

    grouped.set(item.productId, {
      ...existing,
      present: existing.present + item.present,
      reserved: existing.reserved + item.reserved,
      available: existing.available + item.available,
      matched: existing.matched && item.matched,
    });
  }

  return [...grouped.values()];
}

export function filterInventoryItems(
  items: OzonInventoryItem[],
  filters: OzonInventoryFilters,
): OzonInventoryItem[] {
  const search = filters.search.trim().toLowerCase();

  return items.filter((item) => {
    if (filters.onlyWithAvailable && item.available <= 0) {
      return false;
    }

    if (filters.onlyUnmatched && item.matched) {
      return false;
    }

    if (filters.stockType !== "all" && item.stockType !== filters.stockType) {
      return false;
    }

    const warehouseLabel = getWarehouseLabel(item);
    if (filters.warehouse !== "all" && warehouseLabel !== filters.warehouse) {
      return false;
    }

    const status = item.productStatus?.trim() || "Без статуса";
    if (filters.status !== "all" && status !== filters.status) {
      return false;
    }

    if (!search) {
      return true;
    }

    const offerId = item.offerId.toLowerCase();
    const name = getDisplayName(item).toLowerCase();
    const productId = String(item.productId);
    const barcode = getDisplayBarcode(item)?.toLowerCase() ?? "";

    return (
      offerId.includes(search) ||
      name.includes(search) ||
      productId.includes(search) ||
      barcode.includes(search)
    );
  });
}

function compareValues(
  left: string | number,
  right: string | number,
  direction: OzonInventorySortDirection,
): number {
  if (typeof left === "number" && typeof right === "number") {
    return direction === "asc" ? left - right : right - left;
  }

  const leftValue = String(left).toLowerCase();
  const rightValue = String(right).toLowerCase();

  if (leftValue === rightValue) {
    return 0;
  }

  if (direction === "asc") {
    return leftValue < rightValue ? -1 : 1;
  }

  return leftValue > rightValue ? -1 : 1;
}

export function sortInventoryItems(
  items: OzonInventoryItem[],
  sortKey: OzonInventorySortKey,
  direction: OzonInventorySortDirection,
): OzonInventoryItem[] {
  const sorted = [...items];

  sorted.sort((left, right) => {
    switch (sortKey) {
      case "offerId":
        return compareValues(left.offerId, right.offerId, direction);
      case "warehouse":
        return compareValues(
          getWarehouseLabel(left),
          getWarehouseLabel(right),
          direction,
        );
      case "present":
        return compareValues(left.present, right.present, direction);
      case "reserved":
        return compareValues(left.reserved, right.reserved, direction);
      case "available":
      default:
        return compareValues(left.available, right.available, direction);
    }
  });

  return sorted;
}

export function toTableRows(
  items: OzonInventoryItem[],
  grouping: OzonInventoryGrouping,
): OzonInventoryTableRow[] {
  return items.map((item) => {
    const warehouseLabel =
      grouping === "product" ? "Все склады" : getWarehouseLabel(item);
    const stockType =
      grouping === "product" && item.stockType === "all"
        ? "all"
        : item.stockType;

    return {
      id:
        grouping === "product"
          ? `product-${item.productId}`
          : `warehouse-${item.productId}-${item.stockType}-${warehouseLabel}`,
      offerId: item.offerId || "—",
      displayName: getDisplayName(item),
      productId: item.productId,
      barcode: getDisplayBarcode(item),
      warehouseLabel,
      stockType,
      stockTypeLabel:
        stockType === "all" ? "Все схемы" : getStockTypeLabel(stockType),
      present: item.present,
      reserved: item.reserved,
      available: item.available,
      productStatus: item.productStatus?.trim() || null,
      matched: item.matched,
      matchedLabel: getMatchedLabel(item.matched),
    };
  });
}

export function getWarehouseOptions(items: OzonInventoryItem[]): string[] {
  return [...new Set(items.map((item) => getWarehouseLabel(item)))]
    .filter((warehouse) => warehouse !== "—" && warehouse !== "Все склады")
    .sort((left, right) => left.localeCompare(right, "ru"));
}

export function getStatusOptions(items: OzonInventoryItem[]): string[] {
  return [
    ...new Set(
      items.map((item) => item.productStatus?.trim() || "Без статуса"),
    ),
  ].sort((left, right) => left.localeCompare(right, "ru"));
}

export function getStockTypeOptions(items: OzonInventoryItem[]): string[] {
  return [...new Set(items.map((item) => item.stockType))]
    .filter((stockType) => stockType !== "all")
    .sort((left, right) => left.localeCompare(right, "ru"));
}

export function getSafeErrorMessage(result: OzonInventoryResult): string {
  if (result.status === "not_configured") {
    return "Учётные данные Ozon не настроены. Добавьте OZON_CLIENT_ID и OZON_API_KEY в .env.local и перезапустите сервер.";
  }

  return (
    result.error?.message ??
    result.message ??
    "Не удалось загрузить остатки Ozon."
  );
}
