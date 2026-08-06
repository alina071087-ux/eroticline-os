"use client";

import type { ReactNode } from "react";
import { getMatchMethodLabel } from "@/lib/data/marketplaceInventoryPage";
import type {
  MarketplaceInventoryFilters,
  MarketplaceMatchMethodFilter,
  MarketplacePlatformFilter,
} from "@/lib/types/marketplaceInventoryPage";

type MarketplaceInventoryFiltersBarProps = {
  filters: MarketplaceInventoryFilters;
  onFiltersChange: (filters: MarketplaceInventoryFilters) => void;
};

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-white/[0.08] bg-[#0d0d0f] px-3 py-2 text-sm text-zinc-200 outline-none transition-colors focus:border-white/[0.14]"
      >
        {children}
      </select>
    </label>
  );
}

export function MarketplaceInventoryFiltersBar({
  filters,
  onFiltersChange,
}: MarketplaceInventoryFiltersBarProps) {
  const update = <K extends keyof MarketplaceInventoryFilters>(
    key: K,
    value: MarketplaceInventoryFilters[K],
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.2)]">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs font-medium text-zinc-500">
            Поиск по артикулу, названию или штрихкоду
          </span>
          <input
            type="search"
            value={filters.search}
            onChange={(event) => update("search", event.target.value)}
            placeholder="Например: 1022Bчерный75B"
            className="rounded-lg border border-white/[0.08] bg-[#0d0d0f] px-3 py-2 text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-white/[0.14]"
          />
        </label>

        <SelectField
          label="Площадка"
          value={filters.platform}
          onChange={(value) => update("platform", value as MarketplacePlatformFilter)}
        >
          <option value="all">Все площадки</option>
          <option value="wb">Wildberries</option>
          <option value="ozon">Ozon</option>
        </SelectField>

        <SelectField
          label="Метод сопоставления"
          value={filters.matchMethod}
          onChange={(value) =>
            update("matchMethod", value as MarketplaceMatchMethodFilter)
          }
        >
          <option value="all">Все методы</option>
          <option value="cross_platform">WB + Ozon (любой метод)</option>
          <option value="barcode_exact">
            {getMatchMethodLabel("barcode_exact")}
          </option>
          <option value="offer_exact">
            {getMatchMethodLabel("offer_exact")}
          </option>
          <option value="offer_normalized">
            {getMatchMethodLabel("offer_normalized")}
          </option>
          <option value="ambiguous">{getMatchMethodLabel("ambiguous")}</option>
          <option value="wb_only">{getMatchMethodLabel("wb_only")}</option>
          <option value="ozon_only">{getMatchMethodLabel("ozon_only")}</option>
          <option value="no_identifier">
            {getMatchMethodLabel("no_identifier")}
          </option>
        </SelectField>
      </div>

      <div className="mt-3 flex flex-wrap gap-4">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={filters.onlyWithStock}
            onChange={(event) => update("onlyWithStock", event.target.checked)}
            className="rounded border-white/[0.12] bg-[#0d0d0f]"
          />
          Только товары с остатком
        </label>

        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={filters.onlySinglePlatform}
            onChange={(event) =>
              update("onlySinglePlatform", event.target.checked)
            }
            className="rounded border-white/[0.12] bg-[#0d0d0f]"
          />
          Только на одной площадке
        </label>

        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={filters.onlyWithoutIdentifier}
            onChange={(event) =>
              update("onlyWithoutIdentifier", event.target.checked)
            }
            className="rounded border-white/[0.12] bg-[#0d0d0f]"
          />
          Только без идентификатора
        </label>

        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={filters.onlyAmbiguous}
            onChange={(event) =>
              update("onlyAmbiguous", event.target.checked)
            }
            className="rounded border-white/[0.12] bg-[#0d0d0f]"
          />
          Только неоднозначные
        </label>
      </div>
    </section>
  );
}
