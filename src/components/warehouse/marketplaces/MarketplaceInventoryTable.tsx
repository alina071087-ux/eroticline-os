"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Info } from "lucide-react";
import {
  formatInventoryNumber,
  getMatchMethodLabel,
  getMatchMethodStyles,
} from "@/lib/data/marketplaceInventoryPage";
import type {
  MarketplaceSortDirection,
  MarketplaceSortKey,
  MarketplaceUnifiedItem,
} from "@/lib/types/marketplaceInventoryPage";

type MarketplaceInventoryTableProps = {
  rows: MarketplaceUnifiedItem[];
  sortKey: MarketplaceSortKey;
  sortDirection: MarketplaceSortDirection;
  onSort: (key: MarketplaceSortKey) => void;
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
  hint,
}: {
  label: string;
  column: MarketplaceSortKey;
  sortKey: MarketplaceSortKey;
  sortDirection: MarketplaceSortDirection;
  onSort: (key: MarketplaceSortKey) => void;
  align?: "left" | "right";
  hint?: string;
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
      title={hint}
      className={`inline-flex items-center gap-1 transition-colors hover:text-zinc-300 ${
        align === "right" ? "ml-auto" : ""
      } ${isActive ? "text-zinc-200" : ""}`}
    >
      {label}
      {hint && <Info className="h-3 w-3 text-zinc-500" strokeWidth={1.75} />}
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
    </button>
  );
}

function formatBarcodeList(barcodes: string[]): string {
  if (barcodes.length === 0) {
    return "—";
  }

  if (barcodes.length === 1) {
    return barcodes[0];
  }

  return `${barcodes[0]} +${barcodes.length - 1}`;
}

export function MarketplaceInventoryTable({
  rows,
  sortKey,
  sortDirection,
  onSort,
}: MarketplaceInventoryTableProps) {
  return (
    <section className="space-y-3">
      <div className="px-1">
        <h3 className="text-sm font-medium text-zinc-200">
          Товары по площадкам
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          Сначала агрегация по товару внутри площадки, затем объединение по
          штрихкоду и артикулу.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113] shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.2)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse">
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
                <th className={thClass}>Штрихкоды</th>
                <th className={`${thClass} text-right`}>
                  <SortButton
                    label="Wildberries"
                    column="wbQuantity"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={onSort}
                    align="right"
                  />
                </th>
                <th className={`${thClass} text-right`}>
                  <SortButton
                    label="Ozon"
                    column="ozonAvailable"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={onSort}
                    align="right"
                  />
                </th>
                <th className={`${thClass} text-right`}>
                  <SortButton
                    label="Всего по API"
                    column="totalApi"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={onSort}
                    align="right"
                    hint="Сумма технических показателей двух площадок, не бухгалтерский остаток"
                  />
                </th>
                <th className={thClass}>Метод сопоставления</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const allBarcodes = [...row.wbBarcodes, ...row.ozonBarcodes];
                const uniqueBarcodes = [...new Set(allBarcodes)];

                return (
                  <tr
                    key={row.id}
                    className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.02]"
                  >
                    <td className={`${tdClass} font-medium text-zinc-200`}>
                      <div>{row.offerId}</div>
                      {(row.wbNmId || row.ozonProductId) && (
                        <div className="mt-0.5 text-xs text-zinc-500">
                          {row.wbNmId ? `nmID ${row.wbNmId}` : ""}
                          {row.wbNmId && row.ozonProductId ? " · " : ""}
                          {row.ozonProductId
                            ? `product ${row.ozonProductId}`
                            : ""}
                        </div>
                      )}
                    </td>
                    <td className={`${tdClass} max-w-[280px] truncate`}>
                      {row.title}
                    </td>
                    <td className={tdClass}>{formatBarcodeList(uniqueBarcodes)}</td>
                    <td className={`${tdClass} text-right font-medium text-violet-200`}>
                      {formatInventoryNumber(row.wbQuantity)}
                      {row.wbGranularity === "nmId" && row.wbQuantity > 0 && (
                        <div className="text-xs font-normal text-zinc-500">
                          nmID
                        </div>
                      )}
                    </td>
                    <td className={`${tdClass} text-right font-medium text-blue-200`}>
                      {formatInventoryNumber(row.ozonAvailable)}
                    </td>
                    <td className={`${tdClass} text-right font-medium text-zinc-100`}>
                      {formatInventoryNumber(row.totalApi)}
                    </td>
                    <td className={tdClass}>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getMatchMethodStyles(row.matchMethod)}`}
                      >
                        {getMatchMethodLabel(row.matchMethod)}
                      </span>
                      {row.warnings[0] && (
                        <p className="mt-1 max-w-[220px] text-xs text-zinc-500">
                          {row.warnings[0]}
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
