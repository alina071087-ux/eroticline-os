import "server-only";

export const OZON_MAX_PAGES = 500;
export const OZON_PRODUCT_LIST_PAGE_SIZE = 1000;
export const OZON_INFO_LIST_BATCH_SIZE = 1000;
export const OZON_STOCKS_PAGE_SIZE = 1000;
export const OZON_MAX_PRODUCTS = 100_000;
export const OZON_MAX_STOCK_ROWS = 500_000;
export const OZON_FETCH_TIMEOUT_MS = 120_000;

export function readNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function readProductId(value: unknown): number | null {
  const id = readNumber(value);
  return id > 0 ? id : null;
}

export function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function extractResult(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  const result = record.result;

  if (result && typeof result === "object") {
    return result as Record<string, unknown>;
  }

  return record;
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export function computeAvailable(present: number, reserved: number): number {
  return Math.max(0, present - reserved);
}
