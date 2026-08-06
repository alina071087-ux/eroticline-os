"use client";

import { AlertTriangle } from "lucide-react";
import { WB_GRANULARITY_WARNING } from "@/lib/integrations/1c/types";

export function SkuDirectoryWarning() {
  return (
    <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
          strokeWidth={1.75}
        />
        <p className="text-sm text-amber-100/90">{WB_GRANULARITY_WARNING}</p>
      </div>
    </section>
  );
}
