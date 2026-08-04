import { AlertTriangle } from "lucide-react";

export function WbInventoryWarning() {
  return (
    <section className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
          strokeWidth={1.75}
        />
        <p className="text-sm leading-relaxed text-amber-100/90">
          Остатки Wildberries получены на уровне nmID и склада. Размер и
          штрихкод в этом отчёте WB не передаются. Для расчёта закупок по
          размеру данные будут объединены с 1С.
        </p>
      </div>
    </section>
  );
}
