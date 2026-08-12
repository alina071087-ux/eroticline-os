"use client";

import type { SkuImportPreviewRow } from "@/lib/types/skuDirectoryPage";
import {
  getChangeTypeLabel,
  getChangeTypeStyles,
  getMatchStatusLabel,
  getMatchStatusStyles,
} from "@/lib/data/skuDirectoryPage";

type SkuDirectoryPreviewTableProps = {
  rows: SkuImportPreviewRow[];
};

export function SkuDirectoryPreviewTable({ rows }: SkuDirectoryPreviewTableProps) {
  return (
    <section className="space-y-3">
      <div className="px-1">
        <h3 className="text-sm font-medium text-zinc-200">
          Результат последней загрузки
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          Показано {rows.length} строк preview.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113] shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.2)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1300px] border-collapse">
            <thead className="sticky top-0 z-10 bg-[#141416]">
              <tr>
                {[
                  "Изменение",
                  "Штрихкод",
                  "Артикул",
                  "Название",
                  "WB nmID",
                  "Ozon productId",
                  "Статус",
                  "Поля",
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
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-white/[0.04] text-sm text-zinc-300"
                >
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getChangeTypeStyles(row.changeType)}`}
                    >
                      {getChangeTypeLabel(row.changeType)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">{row.barcode || "—"}</td>
                  <td className="px-3 py-2.5">{row.article || "—"}</td>
                  <td className="max-w-[240px] truncate px-3 py-2.5">
                    {row.productName || "—"}
                  </td>
                  <td className="px-3 py-2.5">{row.wbNmId ?? "—"}</td>
                  <td className="px-3 py-2.5">{row.ozonProductId ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getMatchStatusStyles(row.matchStatus)}`}
                    >
                      {getMatchStatusLabel(row.matchStatus)}
                    </span>
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2.5">
                    {row.changeFields.join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
