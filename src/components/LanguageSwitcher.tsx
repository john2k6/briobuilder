"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LanguageSwitcher() {
  const t = useTranslations("nav");
  const current = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t("language")} className="flex gap-1 rounded-full border border-border p-0.5">
      {routing.locales.map((locale) => {
        // Nom de la langue dans sa propre langue : rien à traduire quand on en ajoute une.
        const name = new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;
        return (
          <Link
            key={locale}
            href={pathname}
            locale={locale}
            aria-current={locale === current ? "true" : undefined}
            aria-label={name}
            title={name}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 text-sm font-bold uppercase text-muted hover:text-ink aria-[current]:bg-soft aria-[current]:text-ink"
          >
            {locale}
          </Link>
        );
      })}
    </nav>
  );
}
