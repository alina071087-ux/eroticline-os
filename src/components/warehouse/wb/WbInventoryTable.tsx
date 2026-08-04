"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type {
  WbInventorySortDirection,
  WbInventorySortKey,
  WbInventoryTableRow,
} from "@/lib/types/wbInventoryPage";
import { formatInventoryNumber } from "@/lib/data/wbInventoryPage";

type WbInventoryTableProps = {
  rows: WbInventoryTableRow[];
  sortKey: WbInventorySortKey;
  sortDirection: WbInventorySortDirection;
  onSort: (key: WbInventorySortKey) => void;
  grouping: "warehouse" | "product";
};

const thClass =
  "whitespace-nowrap px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500";
const tdClass = "whitespace-nowrap px-3 py-2.5 text-sm text-zinc-300";

function SortButton({
  label,
  column,
  sortKey,
  sortDirection,
  onSort,
  align = "left",
}: {
  label: string;
  column: WbInventorySortKey;
  sortKey: WbInventorySortKey;
  sortDirection: WbInventorySortDirection;
  onSort: (key: WbInventorySortKey) => void;
  align?: "left" | "right";
}) {
  const isActive = sortKey === column;
  const Icon = !isActive
    ? ArrowUpDown
    : sortDirection === "asc"
      ? ArrowUp
      : ArrowDown;

  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={`inline-flex items-center gap-1 transition-colors hover:text-zinc-300 ${
        align === "right" ? "ml-auto" : ""
      } ${isActive ? "text-zinc-200" : ""}`}
    >
      {label}
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
    </button>
  );
}

function SourceBadge({ label }: { label: string }) {
  const styles =
    label === "Активная"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      : label === "Корзина WB"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
        : "border-zinc-500/20 bg-zinc-500/10 text-zinc-400";

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {label}
    </span>
  );
}

export function WbInventoryTable({
  rows,
  sortKey,
  sortDirection,
  onSort,
  grouping,
}: WbInventoryTableProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113] shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.2)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse">
          <thead className="sticky top-0 z-10 bg-[#141416] shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
            <tr>
              <th className={thClass}>
                <SortButton
                  label="Артикул"
                  column="vendorCode"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                />
              </th>
              <th className={thClass}>Название</th>
              <th className={thClass}>nmID</th>
              <th className={thClass}>
                {grouping === "product" ? (
                  "Склад WB"
                ) : (
                  <SortButton
                    label="Склад WB"
                    column="warehouseName"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={onSort}
                  />
                )}
              </th>
              <th className={`${thClass} text-right`}>
                <SortButton
                  label="Остаток"
                  column="quantity"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                  align="right"
                />
              </th>
              <th className={`${thClass} text-right`}>В пути к покупателю</th>
              <th className={`${thClass} text-right`}>Возврат в пути</th>
              <th className={thClass}>Источник карточки</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.02]"
              >
                <td className={`${tdClass} font-medium text-zinc-200`}>
                  {row.vendorCode ?? "—"}
                </td>
                <td className={`${tdClass} max-w-[280px] truncate`}>
                  {row.displayTitle}
                </td>
                <td className={tdClass}>{row.nmID}</td>
                <td className={tdClass}>{row.warehouseName}</td>
                <td className={`${tdClass} text-right font-medium text-zinc-100`}>
                  {formatInventoryNumber(row.quantity)}
                </td>
                <td className={`${tdClass} text-right`}>
                  {formatInventoryNumber(row.inWayToClient)}
                </td>
                <td className={`${tdClass} text-right`}>
                  {formatInventoryNumber(row.inWayFromClient)}
                </td>
                <td className={tdClass}>
                  <SourceBadge label={row.productSourceLabel} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
