"use client";

import type { SkuImportChangesSummary } from "@/lib/types/skuDirectoryPage";
import { formatInventoryNumber } from "@/lib/data/skuDirectoryPage";

type SkuDirectoryChangesSummaryProps = {
  summary: SkuImportChangesSummary;
};

export function SkuDirectoryChangesSummary({
  summary,
}: SkuDirectoryChangesSummaryProps) {
  const cards = [
    { title: "Новых SKU", value: summary.newCount },
    { title: "Обновляемых SKU", value: summary.updateCount },
    { title: "Без изменений", value: summary.unchangedCount },
    { title: "Ошибок", value: summary.errorCount },
    { title: "Всего к сохранению", value: summary.totalToSave },
  ];

  return (
    <div className="space-y-3">
      <div className="px-1">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Изменения перед сохранением
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((card) => (
          <article
            key={card.title}
            className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
          >
            <p className="text-xs font-medium text-zinc-400">{card.title}</p>
            <p className="mt-1.5 text-lg font-semibold text-zinc-50">
              {formatInventoryNumber(card.value)}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
