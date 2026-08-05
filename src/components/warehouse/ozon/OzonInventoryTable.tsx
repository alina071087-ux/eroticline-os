"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type {
  OzonInventoryGrouping,
  OzonInventorySortDirection,
  OzonInventorySortKey,
  OzonInventoryTableRow,
} from "@/lib/types/ozonInventoryPage";
import { formatInventoryNumber } from "@/lib/data/ozonInventoryPage";

type OzonInventoryTableProps = {
  rows: OzonInventoryTableRow[];
  sortKey: OzonInventorySortKey;
  sortDirection: OzonInventorySortDirection;
  onSort: (key: OzonInventorySortKey) => void;
  grouping: OzonInventoryGrouping;
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
  column: OzonInventorySortKey;
  sortKey: OzonInventorySortKey;
  sortDirection: OzonInventorySortDirection;
  onSort: (key: OzonInventorySortKey) => void;
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

function MatchedBadge({ matched, label }: { matched: boolean; label: string }) {
  const styles = matched
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
    : "border-amber-500/20 bg-amber-500/10 text-amber-300";

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {label}
    </span>
  );
}

export function OzonInventoryTable({
  rows,
  sortKey,
  sortDirection,
  onSort,
  grouping,
}: OzonInventoryTableProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113] shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.2)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse">
          <thead className="sticky top-0 z-10 bg-[#141416] shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
            <tr>
              <th className={thClass}>
                <SortButton
                  label="Артикул"
                  column="offerId"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                />
              </th>
              <th className={thClass}>Название</th>
              <th className={thClass}>Product ID</th>
              <th className={thClass}>Штрихкод</th>
              <th className={thClass}>Схема</th>
              <th className={thClass}>
                {grouping === "product" ? (
                  "Склад Ozon"
                ) : (
                  <SortButton
                    label="Склад Ozon"
                    column="warehouse"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={onSort}
                  />
                )}
              </th>
              <th className={`${thClass} text-right`}>
                <SortButton
                  label="Учтено Ozon"
                  column="present"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                  align="right"
                />
              </th>
              <th className={`${thClass} text-right`}>
                <SortButton
                  label="В резерве"
                  column="reserved"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                  align="right"
                />
              </th>
              <th className={`${thClass} text-right`}>
                <SortButton
                  label="Расчётный остаток"
                  column="available"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                  align="right"
                />
              </th>
              <th className={thClass}>Статус товара</th>
              <th className={thClass}>Сопоставление</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.02]"
              >
                <td className={`${tdClass} font-medium text-zinc-200`}>
                  {row.offerId}
                </td>
                <td className={`${tdClass} max-w-[280px] truncate`}>
                  {row.displayName}
                </td>
                <td className={tdClass}>{row.productId}</td>
                <td className={tdClass}>{row.barcode ?? "—"}</td>
                <td className={tdClass}>{row.stockTypeLabel}</td>
                <td className={tdClass}>{row.warehouseLabel}</td>
                <td className={`${tdClass} text-right font-medium text-zinc-100`}>
                  {formatInventoryNumber(row.present)}
                </td>
                <td className={`${tdClass} text-right`}>
                  {formatInventoryNumber(row.reserved)}
                </td>
                <td className={`${tdClass} text-right font-medium text-emerald-300/90`}>
                  {formatInventoryNumber(row.available)}
                </td>
                <td className={`${tdClass} max-w-[180px] truncate`}>
                  {row.productStatus ?? "—"}
                </td>
                <td className={tdClass}>
                  <MatchedBadge matched={row.matched} label={row.matchedLabel} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
