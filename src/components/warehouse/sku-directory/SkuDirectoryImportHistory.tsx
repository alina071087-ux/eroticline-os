"use client";

import type { SkuImportHistoryItem } from "@/lib/types/skuDirectoryPage";
import {
  formatDateTime,
  formatInventoryNumber,
} from "@/lib/data/skuDirectoryPage";

type SkuDirectoryImportHistoryProps = {
  items: SkuImportHistoryItem[];
};

export function SkuDirectoryImportHistory({
  items,
}: SkuDirectoryImportHistoryProps) {
  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-white/[0.06] bg-[#111113] px-4 py-5 text-sm text-zinc-400">
        Последние загрузки 1С пока отсутствуют.
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <div className="px-1">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Последние загрузки 1С
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113] shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead className="bg-[#141416]">
              <tr>
                {[
                  "Дата",
                  "Файл",
                  "Строк",
                  "Добавлено",
                  "Обновлено",
                  "Ошибок",
                  "Статус",
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
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-white/[0.04] text-sm text-zinc-300"
                >
                  <td className="px-3 py-2.5">{formatDateTime(item.importedAt)}</td>
                  <td className="px-3 py-2.5">{item.fileName ?? "—"}</td>
                  <td className="px-3 py-2.5">{formatInventoryNumber(item.totalRows)}</td>
                  <td className="px-3 py-2.5">{formatInventoryNumber(item.addedCount)}</td>
                  <td className="px-3 py-2.5">{formatInventoryNumber(item.updatedCount)}</td>
                  <td className="px-3 py-2.5">{formatInventoryNumber(item.errorCount)}</td>
                  <td className="px-3 py-2.5">{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
