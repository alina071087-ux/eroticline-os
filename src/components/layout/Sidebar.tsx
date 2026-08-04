"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems, type NavChild } from "@/lib/navigation";

function isPathActive(pathname: string, href: string): boolean {
  return (
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`))
  );
}

function NavChildLinks({
  items,
  pathname,
  depth = 0,
}: {
  items: NavChild[];
  pathname: string;
  depth?: number;
}) {
  return (
    <div
      className={
        depth === 0
          ? "ml-4 mt-1 space-y-0.5 border-l border-white/[0.06] pl-3"
          : "ml-3 mt-0.5 space-y-0.5 border-l border-white/[0.04] pl-3"
      }
    >
      {items.map((child) => {
        const isChildActive = isPathActive(pathname, child.href);
        const hasActiveNested = child.children?.some(
          (nested) =>
            isPathActive(pathname, nested.href) ||
            nested.children?.some((deep) => isPathActive(pathname, deep.href)),
        );

        return (
          <div key={child.href}>
            <Link
              href={child.href}
              className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                isChildActive
                  ? "bg-white/[0.08] font-medium text-zinc-50"
                  : hasActiveNested
                    ? "text-zinc-300"
                    : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
              }`}
            >
              {child.label}
            </Link>

            {child.children &&
              (isChildActive || hasActiveNested) &&
              pathname.startsWith(child.href) && (
                <NavChildLinks
                  items={child.children}
                  pathname={pathname}
                  depth={depth + 1}
                />
              )}
          </div>
        );
      })}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[#0c0c0e]">
      <div className="border-b border-white/[0.06] px-5 py-6">
        <p className="text-sm font-semibold tracking-tight text-zinc-100">
          Eroticline OS
        </p>
        <p className="mt-1 text-xs text-zinc-500">ERP для бизнеса</p>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ href, label, icon: Icon, children }) => {
          const isSectionActive = isPathActive(pathname, href);
          const isExactMatch = pathname === href;

          return (
            <div key={href}>
              <Link
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isExactMatch
                    ? "bg-white/[0.08] text-zinc-50"
                    : isSectionActive
                      ? "text-zinc-200"
                      : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                {label}
              </Link>

              {children && isSectionActive && (
                <NavChildLinks items={children} pathname={pathname} />
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
