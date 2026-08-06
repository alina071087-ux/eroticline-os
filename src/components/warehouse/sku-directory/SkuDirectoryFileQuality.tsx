"use client";

import type { OneCFileQualityMetrics } from "@/lib/integrations/1c/types";
import { formatInventoryNumber } from "@/lib/data/skuDirectoryPage";

type SkuDirectoryFileQualityProps = {
  metrics: OneCFileQualityMetrics;
};

export function SkuDirectoryFileQuality({ metrics }: SkuDirectoryFileQualityProps) {
  const cards = [
    { title: "Всего строк", value: metrics.totalRows },
    { title: "Валидных строк", value: metrics.validRows },
    { title: "Пустых штрихкодов", value: metrics.emptyBarcodes },
    { title: "Дублей штрихкодов", value: metrics.duplicateBarcodes },
    {
      title: "Дублей «Номенклатура + Характеристика»",
      value: metrics.duplicateNomenclatureCharacteristicPairs,
    },
    { title: "Строк с ошибкой разбора", value: metrics.parseErrorRows },
    { title: "Уникальных артикулов", value: metrics.uniqueArticles },
    { title: "Уникальных цветов", value: metrics.uniqueColors },
    { title: "Уникальных размеров", value: metrics.uniqueSizes },
  ];

  return (
    <div className="space-y-3">
      <div className="px-1">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Качество файла
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
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
