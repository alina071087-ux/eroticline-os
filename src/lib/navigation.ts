import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  ShoppingCart,
  Package,
  Users,
  Bot,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/finances", label: "Финансы", icon: Wallet },
  { href: "/sales", label: "Продажи", icon: TrendingUp },
  { href: "/purchases", label: "Закупки", icon: ShoppingCart },
  { href: "/warehouse", label: "Склад", icon: Package },
  { href: "/team", label: "Команда", icon: Users },
  { href: "/ai-cfo", label: "AI CFO", icon: Bot },
  { href: "/settings", label: "Настройки", icon: Settings },
];

export function getPageTitle(pathname: string): string {
  const item = navItems.find(
    (nav) => nav.href === pathname || (nav.href !== "/" && pathname.startsWith(nav.href)),
  );
  return item?.label ?? "Dashboard";
}

export function getLastUpdated(): string {
  return new Date().toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
