"use client";

import type {
  OzonInventoryFilters,
  OzonInventoryGrouping,
} from "@/lib/types/ozonInventoryPage";
import { getStockTypeLabel } from "@/lib/data/ozonInventoryPage";

type OzonInventoryFiltersBarProps = {
  filters: OzonInventoryFilters;
  warehouses: string[];
  statuses: string[];
  stockTypes: string[];
  grouping: OzonInventoryGrouping;
  onFiltersChange: (filters: OzonInventoryFilters) => void;
  onGroupingChange: (grouping: OzonInventoryGrouping) => void;
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

export function OzonInventoryFiltersBar({
  filters,
  warehouses,
  statuses,
  stockTypes,
  grouping,
  onFiltersChange,
  onGroupingChange,
}: OzonInventoryFiltersBarProps) {
  const update = <K extends keyof OzonInventoryFilters>(
    key: K,
    value: OzonInventoryFilters[K],
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.2)]">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <label className="flex flex-col gap-1.5 sm:col-span-2 xl:col-span-2">
          <span className="text-xs font-medium text-zinc-500">
            Поиск по артикулу, названию, Product ID или штрихкоду
          </span>
          <input
            type="search"
            value={filters.search}
            onChange={(event) => update("search", event.target.value)}
            placeholder="Например: 1022Bчерный75B или 531795276"
            className="rounded-lg border border-white/[0.08] bg-[#111113] px-3 py-2 text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20"
          />
        </label>

        <SelectField
          label="Схема хранения"
          value={filters.stockType}
          onChange={(value) => update("stockType", value)}
        >
          <option value="all">Все схемы</option>
          {stockTypes.map((stockType) => (
            <option key={stockType} value={stockType}>
              {getStockTypeLabel(stockType)}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Склад Ozon"
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
          label="Статус товара"
          value={filters.status}
          onChange={(value) => update("status", value)}
        >
          <option value="all">Все статусы</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Группировка"
          value={grouping}
          onChange={(value) =>
            onGroupingChange(value as OzonInventoryGrouping)
          }
        >
          <option value="warehouse">По складам</option>
          <option value="product">По товарам</option>
        </SelectField>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={filters.onlyWithAvailable}
            onChange={(event) =>
              update("onlyWithAvailable", event.target.checked)
            }
            className="h-4 w-4 rounded border-white/20 bg-[#111113] text-violet-500 focus:ring-violet-500/30"
          />
          Только позиции с доступным остатком больше нуля
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={filters.onlyUnmatched}
            onChange={(event) => update("onlyUnmatched", event.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-[#111113] text-violet-500 focus:ring-violet-500/30"
          />
          Только несопоставленные
        </label>
      </div>
    </section>
  );
}
