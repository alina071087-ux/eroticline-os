import { AlertTriangle, Info } from "lucide-react";

export function OzonInventoryWarning() {
  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
            strokeWidth={1.75}
          />
          <p className="text-sm leading-relaxed text-amber-100/90">
            Ozon Product Info Stocks передаёт технические остатки present и
            reserved. Расчётный остаток API = present − reserved и может быть
            выше показателя &ldquo;Доступно к продаже&rdquo; в кабинете Ozon,
            потому что включает товары в дополнительных статусах, например
            &ldquo;Готовим к вывозу&rdquo;.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
        <div className="flex items-start gap-3">
          <Info
            className="mt-0.5 h-4 w-4 shrink-0 text-blue-300"
            strokeWidth={1.75}
          />
          <div className="space-y-1">
            <p className="text-sm font-medium text-blue-100/95">По данным API</p>
            <p className="text-sm leading-relaxed text-blue-100/80">
              Для точного показателя &ldquo;Доступно к продаже&rdquo; требуется
              отдельная выгрузка Ozon или другой метод API, если он станет
              доступен.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
