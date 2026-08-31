"use client";

import {
  formatIdList,
  formatInventoryNumber,
  getMatchStatusLabel,
  getMatchStatusStyles,
  getWarningLevelStyles,
} from "@/lib/data/skuUnifiedPage";
import type { SkuUnifiedTableRow } from "@/lib/types/skuUnifiedPage";

type SkuUnifiedTableProps = {
  rows: SkuUnifiedTableRow[];
  selectedBarcode: string | null;
  onSelect: (row: SkuUnifiedTableRow) => void;
};

export function SkuUnifiedTable({
  rows,
  selectedBarcode,
  onSelect,
}: SkuUnifiedTableProps) {
  return (
    <section className="space-y-3">
      <div className="px-1">
        <p className="text-xs text-zinc-500">Показано {rows.length} SKU. Нажмите на строку для карточки.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113] shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.2)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1400px] border-collapse">
            <thead className="sticky top-0 z-10 bg-[#141416]">
              <tr>
                {[
                  "Артикул",
                  "Цвет",
                  "Размер",
                  "Штрихкод",
                  "Наименование",
                  "WB nmID",
                  "WB остаток",
                  "Ozon productId",
                  "Ozon остаток",
                  "Статус",
                  "Предупреждение",
                ].map((title) => (
                  <th
                    key={title}
                    className="whitespace-nowrap px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500"
                  >
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isSelected = selectedBarcode === row.barcode;

                return (
                  <tr
                    key={row.barcode}
                    onClick={() => onSelect(row)}
                    className={`cursor-pointer border-t border-white/[0.04] text-sm text-zinc-300 transition-colors hover:bg-white/[0.03] ${
                      isSelected ? "bg-violet-500/10" : ""
                    }`}
                  >
                    <td className="px-3 py-2.5">{row.article || "—"}</td>
                    <td className="px-3 py-2.5">{row.color || "—"}</td>
                    <td className="px-3 py-2.5">{row.size || "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{row.barcode}</td>
                    <td className="max-w-[220px] truncate px-3 py-2.5">{row.productName || "—"}</td>
                    <td className="px-3 py-2.5">{formatIdList(row.wbNmIds)}</td>
                    <td className="px-3 py-2.5">
                      {row.wbMatchStatus === "matched"
                        ? formatInventoryNumber(row.wbQuantity)
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5">{formatIdList(row.ozonProductIds)}</td>
                    <td className="px-3 py-2.5">
                      {row.ozonMatchStatus === "matched"
                        ? formatInventoryNumber(row.ozonAvailable)
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getMatchStatusStyles(row.matchStatus)}`}
                      >
                        {getMatchStatusLabel(row.matchStatus)}
                      </span>
                    </td>
                    <td className="max-w-[240px] px-3 py-2.5">
                      {row.warningLevel === "none" ? (
                        <span className="text-zinc-500">—</span>
                      ) : (
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getWarningLevelStyles(row.warningLevel)}`}
                        >
                          {row.warningLabel}
                        </span>
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
