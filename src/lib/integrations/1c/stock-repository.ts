import "server-only";

import type { SkuItemRecord } from "@/lib/integrations/1c/import-types";
import type {
  OneCStockReconciledRow,
  SkuStockSnapshotRecord,
  StockImportHistoryItem,
  StockImportRecord,
} from "@/lib/integrations/1c/stock-import-types";
import { getSupabaseServiceClient } from "@/lib/integrations/supabase/service-client";

const STOCK_IMPORTS_SELECT =
  "id, source, stock_date, file_name, file_hash, status, total_rows, matched_rows, unmatched_rows, total_stock, total_accepted, total_packed, created_at";

const SNAPSHOTS_SELECT =
  "id, stock_import_id, sku_item_id, barcode, nomenclature_raw, characteristic_raw, stock_total, stock_accepted, stock_packed, match_status, stock_date, created_at";

export async function fetchStockImportByHash(
  source: string,
  stockDate: string,
  fileHash: string,
): Promise<StockImportRecord | null> {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("stock_imports")
    .select(STOCK_IMPORTS_SELECT)
    .eq("source", source)
    .eq("stock_date", stockDate)
    .eq("file_hash", fileHash)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as StockImportRecord | null) ?? null;
}

export async function insertStockImport(record: {
  source: string;
  stockDate: string;
  fileName: string;
  fileHash: string;
  status: string;
  totalRows: number;
  matchedRows: number;
  unmatchedRows: number;
  totalStock: number;
  totalAccepted: number;
  totalPacked: number;
}): Promise<string> {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("stock_imports")
    .insert({
      source: record.source,
      stock_date: record.stockDate,
      file_name: record.fileName,
      file_hash: record.fileHash,
      status: record.status,
      total_rows: record.totalRows,
      matched_rows: record.matchedRows,
      unmatched_rows: record.unmatchedRows,
      total_stock: record.totalStock,
      total_accepted: record.totalAccepted,
      total_packed: record.totalPacked,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Не удалось сохранить stock_import");
  }

  return data.id as string;
}

export async function insertStockSnapshots(
  stockImportId: string,
  stockDate: string,
  rows: OneCStockReconciledRow[],
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  const supabase = getSupabaseServiceClient();
  const batchSize = 500;
  let inserted = 0;

  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize).map((row) => ({
      stock_import_id: stockImportId,
      sku_item_id: row.skuItemId,
      barcode: row.barcode,
      nomenclature_raw: row.nomenclatureRaw,
      characteristic_raw: row.characteristicRaw,
      stock_total: row.stockTotal,
      stock_accepted: row.stockAccepted,
      stock_packed: row.stockPacked,
      match_status: row.matchStatus,
      stock_date: stockDate,
    }));

    const { error } = await supabase.from("sku_stock_snapshots").insert(batch);

    if (error) {
      throw new Error(error.message);
    }

    inserted += batch.length;
  }

  return inserted;
}

export async function fetchStockImportHistory(
  limit = 20,
): Promise<StockImportHistoryItem[]> {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("stock_imports")
    .select(STOCK_IMPORTS_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as StockImportRecord[]).map((row) => ({
    id: row.id,
    stockDate: row.stock_date,
    fileName: row.file_name,
    status: row.status,
    totalRows: row.total_rows,
    matchedRows: row.matched_rows,
    unmatchedRows: row.unmatched_rows,
    totalStock: row.total_stock,
    totalAccepted: row.total_accepted,
    totalPacked: row.total_packed,
    createdAt: row.created_at,
  }));
}

export async function fetchLatestStockImport(): Promise<StockImportRecord | null> {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("stock_imports")
    .select(STOCK_IMPORTS_SELECT)
    .eq("status", "committed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as StockImportRecord | null) ?? null;
}

export async function fetchSnapshotsByImportId(
  stockImportId: string,
): Promise<SkuStockSnapshotRecord[]> {
  const supabase = getSupabaseServiceClient();
  const pageSize = 1000;
  const snapshots: SkuStockSnapshotRecord[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("sku_stock_snapshots")
      .select(SNAPSHOTS_SELECT)
      .eq("stock_import_id", stockImportId)
      .order("barcode", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as SkuStockSnapshotRecord[];
    snapshots.push(...rows);

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return snapshots;
}

export async function fetchAllSkuItemsForStock(): Promise<SkuItemRecord[]> {
  const supabase = getSupabaseServiceClient();
  const items: SkuItemRecord[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("sku_items")
      .select(
        "id, barcode, article, product_name, nomenclature_raw, characteristic_raw, color, size, wb_nmid, wb_vendor_code, ozon_product_id, ozon_offer_id, match_status, match_method, warnings, import_id, created_at, updated_at",
      )
      .order("barcode", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as SkuItemRecord[];
    items.push(
      ...rows.map((row) => ({
        ...row,
        warnings: Array.isArray(row.warnings)
          ? row.warnings.filter((item): item is string => typeof item === "string")
          : [],
      })),
    );

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return items;
}

export async function fetchStockImportVerification(
  stockImportId: string,
): Promise<{
  snapshotRows: number;
  matchedRows: number;
  unmatchedRows: number;
  totals: {
    stockTotal: number;
    stockAccepted: number;
    stockPacked: number;
  };
}> {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("sku_stock_snapshots")
    .select("match_status, stock_total, stock_accepted, stock_packed")
    .eq("stock_import_id", stockImportId);

  if (error) {
    throw new Error(error.message);
  }

  const rows = data ?? [];
  let matchedRows = 0;
  let unmatchedRows = 0;
  let stockTotal = 0;
  let stockAccepted = 0;
  let stockPacked = 0;

  for (const row of rows) {
    if (row.match_status === "matched") {
      matchedRows += 1;
    } else {
      unmatchedRows += 1;
    }
    stockTotal += row.stock_total ?? 0;
    stockAccepted += row.stock_accepted ?? 0;
    stockPacked += row.stock_packed ?? 0;
  }

  return {
    snapshotRows: rows.length,
    matchedRows,
    unmatchedRows,
    totals: { stockTotal, stockAccepted, stockPacked },
  };
}
