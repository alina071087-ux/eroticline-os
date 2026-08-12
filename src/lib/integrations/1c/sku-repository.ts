import "server-only";

import type {
  SkuCatalogItem,
  SkuImportHistoryItem,
  SkuImportRecord,
  SkuItemRecord,
  SkuItemsQuery,
} from "@/lib/integrations/1c/import-types";
import type { OneCReconciliationRow } from "@/lib/integrations/1c/types";
import { getSupabaseServiceClient } from "@/lib/integrations/supabase/service-client";

const SKU_ITEMS_SELECT =
  "id, barcode, article, product_name, nomenclature_raw, characteristic_raw, color, size, wb_nmid, wb_vendor_code, ozon_product_id, ozon_offer_id, match_status, match_method, warnings, import_id, created_at, updated_at";

const SKU_IMPORTS_SELECT =
  "id, source, file_name, imported_at, total_rows, valid_rows, matched_all, matched_wb_only, matched_ozon_only, unmatched, ambiguous, coverage_percent, status, error_count, added_count, updated_count, unchanged_count";

function parseWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export async function fetchSkuItemsMap(): Promise<Map<string, SkuItemRecord>> {
  const supabase = getSupabaseServiceClient();
  const map = new Map<string, SkuItemRecord>();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("sku_items")
      .select(SKU_ITEMS_SELECT)
      .order("barcode", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as SkuItemRecord[];

    for (const row of rows) {
      map.set(row.barcode, {
        ...row,
        warnings: parseWarnings(row.warnings),
      });
    }

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return map;
}

export async function fetchRecentSkuImports(
  limit = 10,
): Promise<SkuImportHistoryItem[]> {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("sku_imports")
    .select(SKU_IMPORTS_SELECT)
    .in("status", ["committed", "completed", "failed"])
    .order("imported_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as SkuImportRecord[]).map((row) => ({
    id: row.id,
    importedAt: row.imported_at,
    fileName: row.file_name,
    totalRows: row.total_rows,
    addedCount: row.added_count,
    updatedCount: row.updated_count,
    errorCount: row.error_count,
    status: row.status,
  }));
}

export async function fetchSkuImportById(
  importId: string,
): Promise<(SkuImportRecord & { preview_payload: OneCReconciliationRow[] | null }) | null> {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("sku_imports")
    .select(`${SKU_IMPORTS_SELECT}, preview_payload`)
    .eq("id", importId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return data as SkuImportRecord & {
    preview_payload: OneCReconciliationRow[] | null;
  };
}

export async function createSkuImportPreview(record: {
  fileName: string;
  totalRows: number;
  validRows: number;
  matchedAll: number;
  matchedWbOnly: number;
  matchedOzonOnly: number;
  unmatched: number;
  ambiguous: number;
  coveragePercent: number;
  errorCount: number;
  previewPayload: OneCReconciliationRow[];
}): Promise<string> {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("sku_imports")
    .insert({
      source: "1c",
      file_name: record.fileName,
      total_rows: record.totalRows,
      valid_rows: record.validRows,
      matched_all: record.matchedAll,
      matched_wb_only: record.matchedWbOnly,
      matched_ozon_only: record.matchedOzonOnly,
      unmatched: record.unmatched,
      ambiguous: record.ambiguous,
      coverage_percent: record.coveragePercent,
      status: "preview",
      error_count: record.errorCount,
      preview_payload: record.previewPayload,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Не удалось сохранить preview импорта");
  }

  return data.id as string;
}

export async function upsertSkuItems(
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.from("sku_items").upsert(rows, {
    onConflict: "barcode",
    ignoreDuplicates: false,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function finalizeSkuImport(
  importId: string,
  payload: {
    addedCount: number;
    updatedCount: number;
    unchangedCount: number;
    errorCount: number;
    status: "committed" | "completed" | "failed";
  },
): Promise<string> {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("sku_imports")
    .update({
      status: payload.status,
      added_count: payload.addedCount,
      updated_count: payload.updatedCount,
      unchanged_count: payload.unchangedCount,
      error_count: payload.errorCount,
      preview_payload: null,
      imported_at: new Date().toISOString(),
    })
    .eq("id", importId)
    .select("imported_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Не удалось обновить запись импорта");
  }

  return data.imported_at as string;
}

function matchesPlatform(
  item: SkuItemRecord,
  platform: SkuItemsQuery["platform"],
): boolean {
  const hasWb = item.wb_nmid !== null;
  const hasOzon = item.ozon_product_id !== null;

  switch (platform) {
    case "wb":
      return hasWb;
    case "ozon":
      return hasOzon;
    case "both":
      return hasWb && hasOzon;
    case "none":
      return !hasWb && !hasOzon;
    case "all":
    default:
      return true;
  }
}

export async function fetchSkuCatalogItems(
  query: SkuItemsQuery,
): Promise<SkuCatalogItem[]> {
  const supabase = getSupabaseServiceClient();

  let request = supabase
    .from("sku_items")
    .select(SKU_ITEMS_SELECT)
    .order("updated_at", { ascending: false });

  if (query.matchStatus && query.matchStatus !== "all") {
    request = request.eq("match_status", query.matchStatus);
  }

  if (query.article?.trim()) {
    request = request.ilike("article", `%${query.article.trim()}%`);
  }

  if (query.color?.trim()) {
    request = request.ilike("color", `%${query.color.trim()}%`);
  }

  if (query.size?.trim()) {
    request = request.ilike("size", `%${query.size.trim()}%`);
  }

  if (query.onlyWithoutWb) {
    request = request.is("wb_nmid", null);
  }

  if (query.onlyWithoutOzon) {
    request = request.is("ozon_product_id", null);
  }

  const { data, error } = await request;

  if (error) {
    throw new Error(error.message);
  }

  const search = query.search?.trim().toLowerCase();

  return ((data ?? []) as SkuItemRecord[])
    .filter((item) => matchesPlatform(item, query.platform))
    .filter((item) => {
      if (!search) {
        return true;
      }

      const haystack = [
        item.barcode,
        item.article,
        item.product_name,
        item.color,
        item.size,
        item.wb_vendor_code,
        String(item.wb_nmid ?? ""),
        String(item.ozon_product_id ?? ""),
        item.ozon_offer_id,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    })
    .map((item) => ({
      barcode: item.barcode,
      article: item.article,
      productName: item.product_name,
      color: item.color,
      size: item.size,
      wbNmId: item.wb_nmid,
      wbVendorCode: item.wb_vendor_code,
      ozonProductId: item.ozon_product_id,
      ozonOfferId: item.ozon_offer_id,
      matchStatus: item.match_status,
      matchMethod: item.match_method,
      updatedAt: item.updated_at,
    }));
}

export async function markSkuImportFailed(
  importId: string,
  errorCount: number,
): Promise<void> {
  const supabase = getSupabaseServiceClient();

  const { error } = await supabase
    .from("sku_imports")
    .update({
      status: "failed",
      error_count: errorCount,
      preview_payload: null,
    })
    .eq("id", importId);

  if (error) {
    throw new Error(error.message);
  }
}
