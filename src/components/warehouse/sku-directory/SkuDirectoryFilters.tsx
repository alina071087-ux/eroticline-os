"use client";

import type { ReactNode } from "react";
import type {
  SkuDirectoryFilters,
  SkuDirectoryMatchStatusFilter,
} from "@/lib/types/skuDirectoryPage";
import { getMatchStatusLabel } from "@/lib/data/skuDirectoryPage";
import type { OneCMatchStatus } from "@/lib/integrations/1c/types";

type SkuDirectoryFiltersBarProps = {
  filters: SkuDirectoryFilters;
  onFiltersChange: (filters: SkuDirectoryFilters) => void;
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

const STATUS_OPTIONS: Array<OneCMatchStatus | "all" | "matched_both"> = [
  "all",
  "matched_both",
  "matched_all",
  "matched_wb_only",
  "matched_ozon_only",
  "unmatched",
  "ambiguous",
  "duplicate_barcode",
  "invalid",
];

export function SkuDirectoryFiltersBar({
  filters,
  onFiltersChange,
}: SkuDirectoryFiltersBarProps) {
  const update = <K extends keyof SkuDirectoryFilters>(
    key: K,
    value: SkuDirectoryFilters[K],
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.2)]">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
          <span className="text-xs font-medium text-zinc-500">
            Поиск по артикулу, названию, цвету, размеру, штрихкоду
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
          label="Статус сопоставления"
          value={filters.matchStatus}
          onChange={(value) =>
            update("matchStatus", value as SkuDirectoryMatchStatusFilter)
          }
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status === "all"
                ? "Все статусы"
                : status === "matched_both"
                  ? "Только WB + Ozon"
                  : getMatchStatusLabel(status)}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="mt-3 flex flex-wrap gap-4">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={filters.onlyWithErrors}
            onChange={(event) => update("onlyWithErrors", event.target.checked)}
            className="rounded border-white/[0.12] bg-[#0d0d0f]"
          />
          Только с ошибками
        </label>

        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={filters.onlyUnmatched}
            onChange={(event) => update("onlyUnmatched", event.target.checked)}
            className="rounded border-white/[0.12] bg-[#0d0d0f]"
          />
          Только не найденные
        </label>

        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={filters.onlyMatchedBoth}
            onChange={(event) =>
              update("onlyMatchedBoth", event.target.checked)
            }
            className="rounded border-white/[0.12] bg-[#0d0d0f]"
          />
          Только на обеих площадках
        </label>
      </div>
    </section>
  );
}
