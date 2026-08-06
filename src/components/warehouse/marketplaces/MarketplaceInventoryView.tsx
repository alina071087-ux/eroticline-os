"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MarketplaceInventoryResult } from "@/lib/integrations/marketplaces/types";
import {
  filterUnifiedProducts,
  sortUnifiedProducts,
} from "@/lib/data/marketplaceInventoryPage";
import type {
  MarketplaceInventoryFilters,
  MarketplaceSortDirection,
  MarketplaceSortKey,
} from "@/lib/types/marketplaceInventoryPage";
import { MarketplaceInventoryFiltersBar } from "./MarketplaceInventoryFilters";
import { MarketplaceInventoryInfo } from "./MarketplaceInventoryInfo";
import { MarketplaceInventorySummary } from "./MarketplaceInventorySummary";
import { MarketplaceMatchMetrics } from "./MarketplaceMatchMetrics";
import {
  MarketplacePlatformCards,
  getMarketplaceErrorMessage,
} from "./MarketplacePlatformCards";
import {
  MarketplaceInventoryEmpty,
  MarketplaceInventoryError,
  MarketplaceInventoryLoading,
} from "./MarketplaceInventoryStates";
import { MarketplaceInventoryTable } from "./MarketplaceInventoryTable";
import { MarketplacePartialLoadWarning } from "./MarketplacePartialLoadWarning";

type LoadState = "loading" | "success" | "error";

const defaultFilters: MarketplaceInventoryFilters = {
  search: "",
  platform: "all",
  matchMethod: "all",
  onlyWithStock: false,
  onlySinglePlatform: false,
  onlyWithoutIdentifier: false,
  onlyAmbiguous: false,
};

export function MarketplaceInventoryView() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [result, setResult] = useState<MarketplaceInventoryResult | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filters, setFilters] =
    useState<MarketplaceInventoryFilters>(defaultFilters);
  const [sortKey, setSortKey] = useState<MarketplaceSortKey>("totalApi");
  const [sortDirection, setSortDirection] =
    useState<MarketplaceSortDirection>("desc");

  const loadInventory = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/integrations/marketplaces/inventory", {
        method: "GET",
        cache: "no-store",
      });

      const payload = (await response.json()) as MarketplaceInventoryResult;

      if (payload.status === "not_configured") {
        setResult(payload);
        setErrorMessage(getMarketplaceErrorMessage(payload, ""));
        setLoadState("error");
        return;
      }

      if (!response.ok && payload.status === "error" && !payload.items?.length) {
        setResult(payload);
        setErrorMessage(getMarketplaceErrorMessage(payload, ""));
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

  const unifiedProducts = useMemo(() => result?.items ?? [], [result?.items]);

  const tableRows = useMemo(() => {
    const filtered = filterUnifiedProducts(unifiedProducts, filters);
    return sortUnifiedProducts(filtered, sortKey, sortDirection);
  }, [unifiedProducts, filters, sortKey, sortDirection]);

  const handleSort = (key: MarketplaceSortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(key === "offerId" ? "asc" : "desc");
  };

  const bothPlatformsFailed =
    result?.wb?.status !== "ok" && result?.ozon?.status !== "ok";

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 border-b border-white/[0.06] pb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            Остатки маркетплейсов
          </h2>
          <p className="mt-1.5 text-sm text-zinc-400">
            Серверное объединение Wildberries и Ozon по штрихкодам карточек и
            артикулам продавца
          </p>
        </div>
      </header>

      <div className="space-y-4">
        {loadState === "loading" && <MarketplaceInventoryLoading />}

        {loadState === "error" && errorMessage && (
          <MarketplaceInventoryError
            message={errorMessage}
            onRetryAll={() => void loadInventory()}
          />
        )}

        {loadState === "success" && result && (
          <>
            <MarketplacePartialLoadWarning
              wbIncomplete={
                result.wb?.isComplete === false ||
                Boolean(result.partialErrors?.wbInventory) ||
                Boolean(result.partialErrors?.wbProducts)
              }
              ozonIncomplete={
                result.ozon?.isComplete === false ||
                Boolean(result.partialErrors?.ozonInventory)
              }
            />

            {!bothPlatformsFailed && (
              <>
                <MarketplacePlatformCards
                  result={result}
                  loadState="success"
                  onRetry={() => void loadInventory()}
                />

                <MarketplaceInventorySummary result={result} />
                <MarketplaceInventoryInfo />
                <MarketplaceMatchMetrics result={result} />

                <MarketplaceInventoryFiltersBar
                  filters={filters}
                  onFiltersChange={setFilters}
                />

                {tableRows.length === 0 ? (
                  <MarketplaceInventoryEmpty />
                ) : (
                  <MarketplaceInventoryTable
                    rows={tableRows}
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                )}
              </>
            )}

            {bothPlatformsFailed && (
              <MarketplaceInventoryError
                message={getMarketplaceErrorMessage(
                  result,
                  "Не удалось загрузить остатки обеих площадок.",
                )}
                onRetryAll={() => void loadInventory()}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
