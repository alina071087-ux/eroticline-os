"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  computePageMetrics,
  enrichSkuUnifiedRow,
  filterSkuUnifiedRows,
  formatDateTime,
} from "@/lib/data/skuUnifiedPage";
import type { SkuUnifiedResult } from "@/lib/integrations/sku-unified/types";
import type { SkuUnifiedFilters, SkuUnifiedTableRow } from "@/lib/types/skuUnifiedPage";
import { SkuUnifiedDetailPanel } from "./SkuUnifiedDetailPanel";
import { SkuUnifiedFiltersBar } from "./SkuUnifiedFilters";
import { SkuUnifiedMetrics } from "./SkuUnifiedMetrics";
import {
  SkuUnifiedEmpty,
  SkuUnifiedError,
  SkuUnifiedLoading,
} from "./SkuUnifiedStates";
import { SkuUnifiedTable } from "./SkuUnifiedTable";

type LoadState = "loading" | "success" | "error";

const defaultFilters: SkuUnifiedFilters = {
  article: "",
  barcode: "",
  color: "",
  size: "",
  platform: "all",
  wbZeroStock: false,
  wbPositiveStock: false,
  ozonZeroStock: false,
};

export function SkuUnifiedView() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [result, setResult] = useState<SkuUnifiedResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState<SkuUnifiedFilters>(defaultFilters);
  const [selectedRow, setSelectedRow] = useState<SkuUnifiedTableRow | null>(null);

  const loadUnifiedSku = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/integrations/sku-unified", {
        method: "GET",
        cache: "no-store",
      });

      const payload = (await response.json()) as SkuUnifiedResult;

      if (!response.ok && payload.status === "error" && !payload.items?.length) {
        setResult(payload);
        setErrorMessage(payload.message || "Не удалось загрузить единый справочник SKU.");
        setLoadState("error");
        return;
      }

      setResult(payload);
      setLoadState("success");
    } catch {
      setErrorMessage(
        "Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.",
      );
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void loadUnifiedSku();
  }, [loadUnifiedSku]);

  const allItems = useMemo(() => result?.items ?? [], [result?.items]);

  const pageMetrics = useMemo(() => {
    const local = computePageMetrics(allItems);

    if (!result?.metrics) {
      return local;
    }

    return {
      totalSku: result.metrics.totalSku,
      skuWithWb: result.metrics.skuWithWb,
      skuWithOzon: result.metrics.skuWithOzon,
      skuWithBoth: result.metrics.skuWithBoth,
      skuWithoutMarketplaces: result.metrics.skuWithoutMarketplaces,
      wbZeroStock: result.metrics.skuWithWbQuantityZero ?? local.wbZeroStock,
      ozonZeroStock: local.ozonZeroStock,
    };
  }, [allItems, result?.metrics]);

  const tableRows = useMemo(() => {
    const filtered = filterSkuUnifiedRows(allItems, filters);
    return filtered.map(enrichSkuUnifiedRow);
  }, [allItems, filters]);

  useEffect(() => {
    if (!selectedRow) {
      return;
    }

    const stillVisible = tableRows.some((row) => row.barcode === selectedRow.barcode);
    if (!stillVisible) {
      setSelectedRow(null);
    }
  }, [selectedRow, tableRows]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 border-b border-white/[0.06] pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
              Единый справочник SKU
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
              Сопоставление справочника 1С с Wildberries и Ozon по штрихкоду. WB остаток
              рассчитан по chrtId — конкретному размеру SKU. Общий остаток карточки nmID
              равен сумме размеров.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadUnifiedSku()}
            disabled={loadState === "loading"}
            className="inline-flex items-center gap-2 self-start rounded-lg border border-white/[0.08] bg-[#111113] px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-[#141416] disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${loadState === "loading" ? "animate-spin" : ""}`}
              strokeWidth={1.75}
            />
            Обновить
          </button>
        </div>

        {result && loadState === "success" && (
          <p className="mt-3 text-xs text-zinc-500">
            Загружено: {formatDateTime(result.fetchedAt)} · {result.message}
          </p>
        )}
      </header>

      {loadState === "loading" && <SkuUnifiedLoading />}

      {loadState === "error" && (
        <SkuUnifiedError
          message={errorMessage ?? "Не удалось загрузить данные."}
          onRetry={() => void loadUnifiedSku()}
        />
      )}

      {loadState === "success" && result && (
        <div className="space-y-6">
          {result.status === "partial" && (
            <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100/90">
              {result.message}
            </section>
          )}

          <SkuUnifiedMetrics metrics={pageMetrics} />
          <SkuUnifiedFiltersBar filters={filters} onFiltersChange={setFilters} />

          {tableRows.length === 0 ? (
            <SkuUnifiedEmpty />
          ) : (
            <SkuUnifiedTable
              rows={tableRows}
              selectedBarcode={selectedRow?.barcode ?? null}
              onSelect={setSelectedRow}
            />
          )}
        </div>
      )}

      {selectedRow && result && (
        <SkuUnifiedDetailPanel
          row={selectedRow}
          fetchedAt={result.fetchedAt}
          onClose={() => setSelectedRow(null)}
        />
      )}
    </div>
  );
}
