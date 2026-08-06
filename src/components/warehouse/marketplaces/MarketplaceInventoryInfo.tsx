import { AlertTriangle, Info } from "lucide-react";

export function MarketplaceInventoryInfo() {
  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
        <div className="flex items-start gap-3">
          <Info
            className="mt-0.5 h-4 w-4 shrink-0 text-blue-300"
            strokeWidth={1.75}
          />
          <p className="text-sm leading-relaxed text-blue-100/90">
            Показатели Wildberries и Ozon рассчитываются разными методами. WB
            передаёт остатки и товары в пути, Ozon Product Info Stocks передаёт
            технические present и reserved. Поэтому показатели площадок нельзя
            трактовать как полностью одинаковые.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
            strokeWidth={1.75}
          />
          <p className="text-sm leading-relaxed text-amber-100/90">
            Остатки WB доступны на уровне nmID, а не размера. Штрихкоды карточек
            используются для идентификации товара, но остаток WB не
            распределяется по размерам без данных 1С.
          </p>
        </div>
      </div>
    </section>
  );
}
