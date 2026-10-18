"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const items = [
  { href: "/box", key: "box" },
  { href: "/circuits", key: "circuits" },
  { href: "/kids", key: "kids" },
  { href: "/settings", key: "settings" },
] as const;

export function MainNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <nav aria-label={t("menu")} className="-mx-1 flex gap-1 overflow-x-auto">
      {items.map(({ href, key }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-medium text-header-muted hover:text-header-ink aria-[current=page]:bg-white/10 aria-[current=page]:text-header-ink"
          >
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
