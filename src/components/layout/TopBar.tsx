"use client";

import { usePathname } from "next/navigation";
import { getLastUpdated, getPageTitle } from "@/lib/navigation";

export function TopBar() {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);
  const lastUpdated = getLastUpdated();
  const isRealWbInventoryPage = pathname.startsWith(
    "/warehouse/marketplaces/wildberries",
  );

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#09090b]/80 px-6 backdrop-blur-sm">
      <h1 className="text-sm font-semibold text-zinc-100">{pageTitle}</h1>

      <div className="flex items-center gap-4 text-xs text-zinc-500">
        {!isRealWbInventoryPage && (
          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 font-medium text-amber-400/90">
            Данные тестовые
          </span>
        )}
        <span>Обновлено: {lastUpdated}</span>
      </div>
    </header>
  );
}
