"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildInventoryMetrics,
  filterInventoryItems,
  formatFetchedAt,
  getSafeErrorMessage,
  getStatusOptions,
  getStockTypeOptions,
  getWarehouseOptions,
  groupInventoryItems,
  sortInventoryItems,
  toTableRows,
} from "@/lib/data/ozonInventoryPage";
import type {
  OzonInventoryFilters,
  OzonInventoryGrouping,
  OzonInventoryResult,
  OzonInventorySortDirection,
  OzonInventorySortKey,
} from "@/lib/types/ozonInventoryPage";
import { OzonInventoryFiltersBar } from "./OzonInventoryFilters";
import { OzonInventoryMetrics } from "./OzonInventoryMetrics";
import {
  OzonInventoryEmpty,
  OzonInventoryError,
  OzonInventoryLoading,
} from "./OzonInventoryStates";
import { OzonInventoryTable } from "./OzonInventoryTable";
import { OzonInventoryPartialLoadWarning } from "./OzonInventoryPartialLoadWarning";
import { OzonInventoryWarning } from "./OzonInventoryWarning";

type LoadState = "idle" | "loading" | "success" | "error";

const defaultFilters: OzonInventoryFilters = {
  search: "",
  warehouse: "all",
  status: "all",
  stockType: "all",
  onlyWithAvailable: false,
  onlyUnmatched: false,
};

export function OzonInventoryView() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [result, setResult] = useState<OzonInventoryResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState<OzonInventoryFilters>(defaultFilters);
  const [grouping, setGrouping] = useState<OzonInventoryGrouping>("warehouse");
  const [sortKey, setSortKey] = useState<OzonInventorySortKey>("available");
  const [sortDirection, setSortDirection] =
    useState<OzonInventorySortDirection>("desc");

  const loadInventory = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/integrations/ozon/inventory", {
        method: "GET",
        cache: "no-store",
      });

      const payload = (await response.json()) as OzonInventoryResult;

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
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/integrations/ozon/inventory", {
          method: "GET",
          cache: "no-store",
        });

        if (cancelled) {
          return;
        }

        const payload = (await response.json()) as OzonInventoryResult;

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
        if (cancelled) {
          return;
        }

        setErrorMessage(
          "Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.",
        );
        setLoadState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const allItems = useMemo(() => result?.items ?? [], [result?.items]);

  const metrics = useMemo(() => {
    if (!result) {
      return null;
    }

    return buildInventoryMetrics(result);
  }, [result]);

  const warehouses = useMemo(
    () => getWarehouseOptions(allItems),
    [allItems],
  );

  const statuses = useMemo(() => getStatusOptions(allItems), [allItems]);

  const stockTypes = useMemo(
    () => getStockTypeOptions(allItems),
    [allItems],
  );

  const tableRows = useMemo(() => {
    const filtered = filterInventoryItems(allItems, filters);
    const grouped = groupInventoryItems(filtered, grouping);
    const sorted = sortInventoryItems(grouped, sortKey, sortDirection);
    return toTableRows(sorted, grouping);
  }, [allItems, filters, grouping, sortDirection, sortKey]);

  const handleSort = (key: OzonInventorySortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(
      key === "available" || key === "present" || key === "reserved"
        ? "desc"
        : "asc",
    );
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 border-b border-white/[0.06] pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
              Остатки Ozon
            </h2>
            <p className="mt-1.5 text-sm text-zinc-400">
              Реальные остатки по складам маркетплейса на уровне товара
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-300">
              Реальные данные Ozon
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
        {loadState === "loading" && <OzonInventoryLoading />}

        {loadState === "error" && errorMessage && (
          <OzonInventoryError message={errorMessage} onRetry={loadInventory} />
        )}

        {loadState === "success" && metrics && (
          <>
            <OzonInventoryPartialLoadWarning show={result?.isComplete === false} />
            <OzonInventoryMetrics metrics={metrics} />
            <OzonInventoryWarning />
            <OzonInventoryFiltersBar
              filters={filters}
              warehouses={warehouses}
              statuses={statuses}
              stockTypes={stockTypes}
              grouping={grouping}
              onFiltersChange={setFilters}
              onGroupingChange={setGrouping}
            />

            {tableRows.length === 0 ? (
              <OzonInventoryEmpty />
            ) : (
              <OzonInventoryTable
                rows={tableRows}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                grouping={grouping}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
