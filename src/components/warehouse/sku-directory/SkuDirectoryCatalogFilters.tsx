"use client";

import type { SkuCatalogFilters } from "@/lib/types/skuDirectoryPage";

type SkuDirectoryCatalogFiltersProps = {
  filters: SkuCatalogFilters;
  onFiltersChange: (filters: SkuCatalogFilters) => void;
};

export function SkuDirectoryCatalogFilters({
  filters,
  onFiltersChange,
}: SkuDirectoryCatalogFiltersProps) {
  const update = <K extends keyof SkuCatalogFilters>(
    key: K,
    value: SkuCatalogFilters[K],
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.2)]">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs font-medium text-zinc-500">Поиск</span>
          <input
            type="search"
            value={filters.search}
            onChange={(event) => update("search", event.target.value)}
            className="rounded-lg border border-white/[0.08] bg-[#0d0d0f] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-white/[0.14]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-500">Артикул</span>
          <input
            type="search"
            value={filters.article}
            onChange={(event) => update("article", event.target.value)}
            className="rounded-lg border border-white/[0.08] bg-[#0d0d0f] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-white/[0.14]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-500">Цвет</span>
          <input
            type="search"
            value={filters.color}
            onChange={(event) => update("color", event.target.value)}
            className="rounded-lg border border-white/[0.08] bg-[#0d0d0f] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-white/[0.14]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-500">Размер</span>
          <input
            type="search"
            value={filters.size}
            onChange={(event) => update("size", event.target.value)}
            className="rounded-lg border border-white/[0.08] bg-[#0d0d0f] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-white/[0.14]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-500">Площадка</span>
          <select
            value={filters.platform}
            onChange={(event) =>
              update("platform", event.target.value as SkuCatalogFilters["platform"])
            }
            className="rounded-lg border border-white/[0.08] bg-[#0d0d0f] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-white/[0.14]"
          >
            <option value="all">Все</option>
            <option value="both">WB + Ozon</option>
            <option value="wb">Wildberries</option>
            <option value="ozon">Ozon</option>
            <option value="none">Без площадок</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-500">Статус</span>
          <select
            value={filters.matchStatus}
            onChange={(event) => update("matchStatus", event.target.value)}
            className="rounded-lg border border-white/[0.08] bg-[#0d0d0f] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-white/[0.14]"
          >
            <option value="all">Все</option>
            <option value="matched_all">WB + Ozon</option>
            <option value="matched_wb_only">Только WB</option>
            <option value="matched_ozon_only">Только Ozon</option>
            <option value="unmatched">Не найдено</option>
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-4">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={filters.onlyWithoutWb}
            onChange={(event) => update("onlyWithoutWb", event.target.checked)}
            className="rounded border-white/[0.12] bg-[#0d0d0f]"
          />
          Только без WB
        </label>

        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={filters.onlyWithoutOzon}
            onChange={(event) => update("onlyWithoutOzon", event.target.checked)}
            className="rounded border-white/[0.12] bg-[#0d0d0f]"
          />
          Только без Ozon
        </label>
      </div>
    </section>
  );
}
