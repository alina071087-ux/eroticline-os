"use client";

import type { SkuCatalogItem } from "@/lib/types/skuDirectoryPage";
import {
  formatDateTime,
  getMatchStatusLabel,
  getMatchStatusStyles,
} from "@/lib/data/skuDirectoryPage";

type SkuDirectoryCatalogTableProps = {
  rows: SkuCatalogItem[];
};

export function SkuDirectoryCatalogTable({ rows }: SkuDirectoryCatalogTableProps) {
  return (
    <section className="space-y-3">
      <div className="px-1">
        <h3 className="text-sm font-medium text-zinc-200">Текущий справочник</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Показано {rows.length} SKU из Supabase.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113] shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.2)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse">
            <thead className="sticky top-0 z-10 bg-[#141416]">
              <tr>
                {[
                  "Штрихкод",
                  "Артикул",
                  "Название",
                  "Цвет",
                  "Размер",
                  "WB nmID",
                  "WB артикул",
                  "Ozon productId",
                  "Ozon offerId",
                  "Статус",
                  "Обновлён",
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
                  key={row.barcode}
                  className="border-t border-white/[0.04] text-sm text-zinc-300"
                >
                  <td className="px-3 py-2.5">{row.barcode}</td>
                  <td className="px-3 py-2.5">{row.article ?? "—"}</td>
                  <td className="max-w-[220px] truncate px-3 py-2.5">
                    {row.productName ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">{row.color ?? "—"}</td>
                  <td className="px-3 py-2.5">{row.size ?? "—"}</td>
                  <td className="px-3 py-2.5">{row.wbNmId ?? "—"}</td>
                  <td className="px-3 py-2.5">{row.wbVendorCode ?? "—"}</td>
                  <td className="px-3 py-2.5">{row.ozonProductId ?? "—"}</td>
                  <td className="px-3 py-2.5">{row.ozonOfferId ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getMatchStatusStyles(row.matchStatus as never)}`}
                    >
                      {getMatchStatusLabel(row.matchStatus as never)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">{formatDateTime(row.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
