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
    <nav aria-label={t("menu")} className="-mx-2 flex gap-1 overflow-x-auto">
      {items.map(({ href, key }) => {
        const active =
          pathname === href ||
          pathname.startsWith(`${href}/`) ||
          (href === "/circuits" && pathname.startsWith("/circuit"));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="relative inline-flex min-h-12 shrink-0 items-center px-3 font-bold text-ink after:absolute after:inset-x-3 after:bottom-1 after:h-[3px] after:rounded-full after:bg-accent after:opacity-0 hover:text-accent aria-[current=page]:text-accent aria-[current=page]:after:opacity-100"
          >
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
