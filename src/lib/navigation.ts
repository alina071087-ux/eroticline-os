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

export type NavChild = {
  href: string;
  label: string;
  children?: NavChild[];
};

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  children?: NavChild[];
};

export const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/finances", label: "Финансы", icon: Wallet },
  { href: "/sales", label: "Продажи", icon: TrendingUp },
  {
    href: "/purchases",
    label: "Закупки",
    icon: ShoppingCart,
    children: [{ href: "/purchases/planning", label: "План закупок" }],
  },
  {
    href: "/warehouse",
    label: "Склад",
    icon: Package,
    children: [
      {
        href: "/warehouse/marketplaces",
        label: "Остатки маркетплейсов",
        children: [
          {
            href: "/warehouse/marketplaces",
            label: "Все площадки",
          },
          {
            href: "/warehouse/marketplaces/wildberries",
            label: "Wildberries",
          },
          {
            href: "/warehouse/marketplaces/ozon",
            label: "Ozon",
          },
        ],
      },
      {
        href: "/warehouse/sku",
        label: "Единый справочник SKU",
      },
      {
        href: "/warehouse/sku-directory",
        label: "Справочник SKU",
      },
    ],
  },
  { href: "/team", label: "Команда", icon: Users },
  { href: "/ai-cfo", label: "AI CFO", icon: Bot },
  { href: "/settings", label: "Настройки", icon: Settings },
];

function findNavLabel(children: NavChild[], pathname: string): string | null {
  for (const child of children) {
    if (
      pathname === child.href ||
      (child.href !== "/" && pathname.startsWith(`${child.href}/`))
    ) {
      if (child.children) {
        const nested = findNavLabel(child.children, pathname);
        if (nested) {
          return nested;
        }
      }

      return child.label;
    }

    if (child.children) {
      const nested = findNavLabel(child.children, pathname);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

export function getPageTitle(pathname: string): string {
  for (const item of navItems) {
    if (item.children) {
      const childLabel = findNavLabel(item.children, pathname);
      if (childLabel) {
        return childLabel;
      }
    }
  }

  const item = navItems.find(
    (nav) =>
      nav.href === pathname ||
      (nav.href !== "/" && pathname.startsWith(nav.href)),
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
