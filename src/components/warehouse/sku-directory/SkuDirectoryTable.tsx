"use client";

import type { OneCReconciliationRow } from "@/lib/integrations/1c/types";
import {
  getMatchStatusLabel,
  getMatchStatusStyles,
} from "@/lib/data/skuDirectoryPage";

type SkuDirectoryTableProps = {
  rows: OneCReconciliationRow[];
};

const thClass =
  "whitespace-nowrap px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500";
const tdClass = "whitespace-nowrap px-3 py-2.5 text-sm text-zinc-300";

function formatWarning(row: OneCReconciliationRow): string {
  const warnings = [...row.parseWarnings, ...row.warnings].filter(Boolean);
  return warnings[0] ?? "—";
}

export function SkuDirectoryTable({ rows }: SkuDirectoryTableProps) {
  return (
    <section className="space-y-3">
      <div className="px-1">
        <h3 className="text-sm font-medium text-zinc-200">Результаты сверки</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Показано {rows.length} строк после фильтрации.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113] shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.2)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1400px] border-collapse">
            <thead className="sticky top-0 z-10 bg-[#141416] shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
              <tr>
                <th className={thClass}>Номенклатура 1С</th>
                <th className={thClass}>Характеристика</th>
                <th className={thClass}>Штрихкод</th>
                <th className={thClass}>Артикул</th>
                <th className={thClass}>Название</th>
                <th className={thClass}>Цвет</th>
                <th className={thClass}>Размер</th>
                <th className={thClass}>WB nmID</th>
                <th className={thClass}>WB артикул</th>
                <th className={thClass}>Ozon productId</th>
                <th className={thClass}>Ozon offerId</th>
                <th className={thClass}>Статус</th>
                <th className={thClass}>Предупреждение</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.02]"
                >
                  <td className={`${tdClass} max-w-[220px] truncate`}>
                    {row.nomenclatureRaw}
                  </td>
                  <td className={`${tdClass} max-w-[180px] truncate`}>
                    {row.characteristicRaw || "—"}
                  </td>
                  <td className={tdClass}>{row.barcode || "—"}</td>
                  <td className={tdClass}>{row.article || "—"}</td>
                  <td className={`${tdClass} max-w-[180px] truncate`}>
                    {row.productName || "—"}
                  </td>
                  <td className={tdClass}>{row.color || "—"}</td>
                  <td className={tdClass}>{row.size || "—"}</td>
                  <td className={tdClass}>{row.wbNmId ?? "—"}</td>
                  <td className={tdClass}>{row.wbVendorCode ?? "—"}</td>
                  <td className={tdClass}>{row.ozonProductId ?? "—"}</td>
                  <td className={tdClass}>{row.ozonOfferId ?? "—"}</td>
                  <td className={tdClass}>
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getMatchStatusStyles(row.matchStatus)}`}
                    >
                      {getMatchStatusLabel(row.matchStatus)}
                    </span>
                  </td>
                  <td className={`${tdClass} max-w-[260px] truncate`}>
                    {formatWarning(row)}
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
