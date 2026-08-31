"use client";

import type { SkuUnifiedFilters } from "@/lib/types/skuUnifiedPage";

type SkuUnifiedFiltersBarProps = {
  filters: SkuUnifiedFilters;
  onFiltersChange: (filters: SkuUnifiedFilters) => void;
};

export function SkuUnifiedFiltersBar({
  filters,
  onFiltersChange,
}: SkuUnifiedFiltersBarProps) {
  const update = <K extends keyof SkuUnifiedFilters>(
    key: K,
    value: SkuUnifiedFilters[K],
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.2)]">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <span className="text-xs font-medium text-zinc-500">Штрихкод</span>
          <input
            type="search"
            value={filters.barcode}
            onChange={(event) => update("barcode", event.target.value)}
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

        <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
          <span className="text-xs font-medium text-zinc-500">Площадка</span>
          <select
            value={filters.platform}
            onChange={(event) =>
              update("platform", event.target.value as SkuUnifiedFilters["platform"])
            }
            className="rounded-lg border border-white/[0.08] bg-[#0d0d0f] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-white/[0.14]"
          >
            <option value="all">Все</option>
            <option value="wb">Только WB</option>
            <option value="ozon">Только Ozon</option>
            <option value="both">Обе площадки</option>
            <option value="none">Без площадок</option>
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-4">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={filters.wbZeroStock}
            onChange={(event) => update("wbZeroStock", event.target.checked)}
            className="rounded border-white/[0.12] bg-[#0d0d0f]"
          />
          WB остаток = 0
        </label>

        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={filters.wbPositiveStock}
            onChange={(event) => update("wbPositiveStock", event.target.checked)}
            className="rounded border-white/[0.12] bg-[#0d0d0f]"
          />
          WB остаток &gt; 0
        </label>

        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={filters.ozonZeroStock}
            onChange={(event) => update("ozonZeroStock", event.target.checked)}
            className="rounded border-white/[0.12] bg-[#0d0d0f]"
          />
          Ozon остаток = 0
        </label>
      </div>
    </section>
  );
}
