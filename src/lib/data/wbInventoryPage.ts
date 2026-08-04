import type {
  WbInventoryFilters,
  WbInventoryGrouping,
  WbInventoryItem,
  WbInventoryPageMetrics,
  WbInventoryResult,
  WbInventorySortDirection,
  WbInventorySortKey,
  WbInventoryTableRow,
  WbProductSource,
} from "@/lib/types/wbInventoryPage";

const SOURCE_LABELS: Record<WbProductSource, string> = {
  active: "Активная",
  trash: "Корзина WB",
  unknown: "Не сопоставлена",
};

export function getProductSourceLabel(source: WbProductSource): string {
  return SOURCE_LABELS[source];
}

export function getDisplayTitle(item: WbInventoryItem): string {
  if (item.title?.trim()) {
    return item.title.trim();
  }

  return "Карточка в корзине WB";
}

export function buildInventoryMetrics(
  items: WbInventoryItem[],
  result: Pick<
    WbInventoryResult,
    "matchedNmIdsCount" | "stockNmIdsCount"
  >,
): WbInventoryPageMetrics {
  const uniqueNmIds = new Set(items.map((item) => item.nmID));
  const uniqueWarehouses = new Set(items.map((item) => item.warehouseName));

  return {
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    totalInWayToClient: items.reduce(
      (sum, item) => sum + item.inWayToClient,
      0,
    ),
    totalInWayFromClient: items.reduce(
      (sum, item) => sum + item.inWayFromClient,
      0,
    ),
    uniqueNmIds: uniqueNmIds.size,
    uniqueWarehouses: uniqueWarehouses.size,
    matchedNmIdsCount: result.matchedNmIdsCount ?? 0,
    stockNmIdsCount: result.stockNmIdsCount ?? 0,
  };
}

export function groupInventoryItems(
  items: WbInventoryItem[],
  grouping: WbInventoryGrouping,
): WbInventoryItem[] {
  if (grouping === "warehouse") {
    return items;
  }

  const grouped = new Map<number, WbInventoryItem>();

  for (const item of items) {
    const existing = grouped.get(item.nmID);

    if (!existing) {
      grouped.set(item.nmID, {
        ...item,
        warehouseName: "Все склады",
      });
      continue;
    }

    grouped.set(item.nmID, {
      ...existing,
      quantity: existing.quantity + item.quantity,
      inWayToClient: existing.inWayToClient + item.inWayToClient,
      inWayFromClient: existing.inWayFromClient + item.inWayFromClient,
    });
  }

  return [...grouped.values()];
}

export function filterInventoryItems(
  items: WbInventoryItem[],
  filters: WbInventoryFilters,
): WbInventoryItem[] {
  const search = filters.search.trim().toLowerCase();

  return items.filter((item) => {
    if (filters.onlyWithStock && item.quantity <= 0) {
      return false;
    }

    if (filters.warehouse !== "all" && item.warehouseName !== filters.warehouse) {
      return false;
    }

    if (filters.source !== "all" && item.productSource !== filters.source) {
      return false;
    }

    if (!search) {
      return true;
    }

    const title = getDisplayTitle(item).toLowerCase();
    const vendorCode = item.vendorCode?.toLowerCase() ?? "";
    const nmId = String(item.nmID);

    return (
      title.includes(search) ||
      vendorCode.includes(search) ||
      nmId.includes(search)
    );
  });
}

function compareValues(
  left: string | number,
  right: string | number,
  direction: WbInventorySortDirection,
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
  items: WbInventoryItem[],
  sortKey: WbInventorySortKey,
  direction: WbInventorySortDirection,
): WbInventoryItem[] {
  const sorted = [...items];

  sorted.sort((left, right) => {
    switch (sortKey) {
      case "vendorCode":
        return compareValues(
          left.vendorCode ?? "",
          right.vendorCode ?? "",
          direction,
        );
      case "warehouseName":
        return compareValues(
          left.warehouseName,
          right.warehouseName,
          direction,
        );
      case "quantity":
      default:
        return compareValues(left.quantity, right.quantity, direction);
    }
  });

  return sorted;
}

export function toTableRows(items: WbInventoryItem[]): WbInventoryTableRow[] {
  return items.map((item) => ({
    id:
      item.warehouseName === "Все склады"
        ? `product-${item.nmID}`
        : `warehouse-${item.nmID}-${item.warehouseName}`,
    nmID: item.nmID,
    vendorCode: item.vendorCode,
    displayTitle: getDisplayTitle(item),
    warehouseName: item.warehouseName,
    quantity: item.quantity,
    inWayToClient: item.inWayToClient,
    inWayFromClient: item.inWayFromClient,
    productSource: item.productSource,
    productSourceLabel: getProductSourceLabel(item.productSource),
  }));
}

export function getWarehouseOptions(items: WbInventoryItem[]): string[] {
  return [...new Set(items.map((item) => item.warehouseName))]
    .filter((warehouse) => warehouse !== "Все склады")
    .sort((left, right) => left.localeCompare(right, "ru"));
}

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

export function getSafeErrorMessage(result: WbInventoryResult): string {
  if (result.status === "not_configured") {
    return "Токен Wildberries не настроен. Добавьте WB_API_TOKEN в .env.local и перезапустите сервер.";
  }

  return (
    result.error?.message ??
    result.message ??
    "Не удалось загрузить остатки Wildberries."
  );
}
