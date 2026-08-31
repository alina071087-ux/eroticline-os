"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { WbInventoryResult } from "@/lib/integrations/types";
import {
  buildInventoryMetrics,
  formatFetchedAt,
  getSafeErrorMessage,
  getWarehouseOptions,
  prepareInventoryDisplayItems,
  sortInventoryItems,
  toTableRows,
} from "@/lib/data/wbInventoryPage";
import type {
  WbInventoryFilters,
  WbInventoryGrouping,
  WbInventorySortDirection,
  WbInventorySortKey,
} from "@/lib/types/wbInventoryPage";
import { WbInventoryFiltersBar } from "./WbInventoryFilters";
import { WbInventoryMetrics } from "./WbInventoryMetrics";
import {
  WbInventoryEmpty,
  WbInventoryError,
  WbInventoryLoading,
} from "./WbInventoryStates";
import { WbInventoryTable } from "./WbInventoryTable";
import { WbInventoryPartialLoadWarning } from "./WbInventoryPartialLoadWarning";
import { WbInventoryWarning } from "./WbInventoryWarning";

type LoadState = "idle" | "loading" | "success" | "error";

const defaultFilters: WbInventoryFilters = {
  search: "",
  warehouse: "all",
  source: "all",
  onlyWithStock: false,
};

export function WbInventoryView() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [result, setResult] = useState<WbInventoryResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState<WbInventoryFilters>(defaultFilters);
  const [grouping, setGrouping] = useState<WbInventoryGrouping>("warehouse");
  const [sortKey, setSortKey] = useState<WbInventorySortKey>("quantity");
  const [sortDirection, setSortDirection] =
    useState<WbInventorySortDirection>("desc");

  const loadInventory = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/integrations/wb/inventory", {
        method: "GET",
        cache: "no-store",
      });

      const payload = (await response.json()) as WbInventoryResult;

      if (!response.ok || payload.status === "error") {
        setResult(payload);
        setErrorMessage(getSafeErrorMessage(payload));
        setLoadState("error");
        return;
      }

      if (payload.status === "not_configured") {
        setResult(payload);
        setErrorMessage(getSafeErrorMessage(payload));
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
    void loadInventory();
  }, [loadInventory]);

  const allItems = useMemo(() => result?.items ?? [], [result?.items]);

  const displayItems = useMemo(
    () => prepareInventoryDisplayItems(allItems, filters),
    [allItems, filters],
  );

  const metrics = useMemo(() => {
    if (!result) {
      return null;
    }

    return buildInventoryMetrics(displayItems, result, allItems);
  }, [displayItems, allItems, result]);

  const warehouses = useMemo(
    () => getWarehouseOptions(allItems),
    [allItems],
  );

  const tableRows = useMemo(() => {
    const sorted = sortInventoryItems(displayItems, sortKey, sortDirection);
    return toTableRows(sorted);
  }, [displayItems, sortDirection, sortKey]);

  const isAllWarehouses = filters.warehouse === "all";

  const handleSort = (key: WbInventorySortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(key === "quantity" ? "desc" : "asc");
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 border-b border-white/[0.06] pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
              Остатки Wildberries
            </h2>
            <p className="mt-1.5 text-sm text-zinc-400">
              Реальные остатки по chrtId (размер) и складу Wildberries
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
              Реальные данные Wildberries
            </span>
            {result?.fetchedAt && (
              <span className="text-xs text-zinc-500">
                Получено: {formatFetchedAt(result.fetchedAt)}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="space-y-4">
        {loadState === "loading" && <WbInventoryLoading />}

        {loadState === "error" && errorMessage && (
          <WbInventoryError message={errorMessage} onRetry={loadInventory} />
        )}

        {loadState === "success" && metrics && (
          <>
            <WbInventoryPartialLoadWarning show={result?.isComplete === false} />
            <WbInventoryMetrics metrics={metrics} />
            <WbInventoryWarning />
            <WbInventoryFiltersBar
              filters={filters}
              warehouses={warehouses}
              grouping={grouping}
              onFiltersChange={setFilters}
              onGroupingChange={setGrouping}
            />

            {tableRows.length === 0 ? (
              <WbInventoryEmpty />
            ) : (
              <WbInventoryTable
                rows={tableRows}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                isAllWarehouses={isAllWarehouses}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
