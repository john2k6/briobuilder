"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LanguageSwitcher() {
  const t = useTranslations("nav");
  const current = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t("language")} className="flex gap-1">
      {routing.locales.map((locale) => {
        // Nom de la langue dans sa propre langue : rien à traduire quand on en ajoute une.
        const name = new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;
        return (
          <Link
            key={locale}
            href={pathname}
            locale={locale}
            aria-current={locale === current ? "true" : undefined}
            className="min-h-11 rounded-lg px-3 py-2 text-sm capitalize text-header-muted hover:text-header-ink aria-[current]:bg-accent aria-[current]:font-semibold aria-[current]:text-accent-ink"
          >
            {name}
          </Link>
        );
      })}
    </nav>
  );
}
