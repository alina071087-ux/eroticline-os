"use client";

import type {
  WbInventoryFilters,
  WbInventoryGrouping,
  WbInventorySourceFilter,
} from "@/lib/types/wbInventoryPage";

type WbInventoryFiltersBarProps = {
  filters: WbInventoryFilters;
  warehouses: string[];
  grouping: WbInventoryGrouping;
  onFiltersChange: (filters: WbInventoryFilters) => void;
  onGroupingChange: (grouping: WbInventoryGrouping) => void;
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
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-white/[0.08] bg-[#111113] px-3 py-2 text-sm text-zinc-200 outline-none transition-colors focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20"
      >
        {children}
      </select>
    </label>
  );
}

const sourceLabels: Record<WbInventorySourceFilter, string> = {
  all: "Все источники",
  active: "Активная",
  trash: "Корзина WB",
  unknown: "Не сопоставлена",
};

export function WbInventoryFiltersBar({
  filters,
  warehouses,
  grouping,
  onFiltersChange,
  onGroupingChange,
}: WbInventoryFiltersBarProps) {
  const update = <K extends keyof WbInventoryFilters>(
    key: K,
    value: WbInventoryFilters[K],
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.2)]">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="flex flex-col gap-1.5 lg:col-span-2">
          <span className="text-xs font-medium text-zinc-500">
            Поиск по артикулу, названию или nmID
          </span>
          <input
            type="search"
            value={filters.search}
            onChange={(event) => update("search", event.target.value)}
            placeholder="Например: EL-001 или 123456789"
            className="rounded-lg border border-white/[0.08] bg-[#111113] px-3 py-2 text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20"
          />
        </label>

        <SelectField
          label="Склад WB"
          value={filters.warehouse}
          onChange={(value) => update("warehouse", value)}
        >
          <option value="all">Все склады</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse} value={warehouse}>
              {warehouse}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Источник карточки"
          value={filters.source}
          onChange={(value) =>
            update("source", value as WbInventorySourceFilter)
          }
        >
          {Object.entries(sourceLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Группировка"
          value={grouping}
          onChange={(value) =>
            onGroupingChange(value as WbInventoryGrouping)
          }
        >
          <option value="warehouse">По складам</option>
          <option value="product">По товарам</option>
        </SelectField>
      </div>

      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={filters.onlyWithStock}
          onChange={(event) => update("onlyWithStock", event.target.checked)}
          className="h-4 w-4 rounded border-white/20 bg-[#111113] text-violet-500 focus:ring-violet-500/30"
        />
        Только позиции с остатком больше нуля
      </label>
    </section>
  );
}
