import {
  Wallet,
  Banknote,
  TrendingUp,
  BarChart3,
  Gem,
  Package,
  FileText,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import type { FinanceMetricKey } from "@/lib/types/finance";

export type MetricDisplayConfig = {
  icon: LucideIcon;
  accent: string;
  bg: string;
};

export const metricDisplayConfig: Record<FinanceMetricKey, MetricDisplayConfig> =
  {
    total_money: {
      icon: Wallet,
      accent: "text-emerald-400",
      bg: "bg-emerald-400/10",
    },
    free_money: {
      icon: Banknote,
      accent: "text-sky-400",
      bg: "bg-sky-400/10",
    },
    sales_today: {
      icon: TrendingUp,
      accent: "text-violet-400",
      bg: "bg-violet-400/10",
    },
    sales_month: {
      icon: BarChart3,
      accent: "text-indigo-400",
      bg: "bg-indigo-400/10",
    },
    profit: {
      icon: Gem,
      accent: "text-amber-400",
      bg: "bg-amber-400/10",
    },
    inventory: {
      icon: Package,
      accent: "text-orange-400",
      bg: "bg-orange-400/10",
    },
    accounts_receivable: {
      icon: FileText,
      accent: "text-rose-400",
      bg: "bg-rose-400/10",
    },
    accounts_payable: {
      icon: CreditCard,
      accent: "text-fuchsia-400",
      bg: "bg-fuchsia-400/10",
    },
  };
