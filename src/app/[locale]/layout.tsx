import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import "../globals.css";

const display = Fraunces({ variable: "--font-display", subsets: ["latin"] });
const sans = Inter({ variable: "--font-sans", subsets: ["latin"] });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "app" });
  return { title: t("name"), description: t("description") };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <html lang={locale}>
      <body className={`${display.variable} ${sans.variable} font-sans antialiased flex min-h-dvh flex-col`}>
        <NextIntlClientProvider>
          <header className="border-b-4 border-accent bg-header text-header-ink">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
              <Link href="/" className="font-display text-xl font-semibold">
                {t("app.name")}
              </Link>
              <div className="flex items-center gap-2">
                <Link href="/pieces" className="min-h-11 rounded-lg px-3 py-2 text-sm text-header-muted hover:text-header-ink">
                  {t("nav.pieces")}
                </Link>
                <LanguageSwitcher />
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">{children}</main>
          <footer className="bg-header">
            <p className="mx-auto max-w-5xl px-4 py-6 text-xs text-header-muted">{t("footer.compat")}</p>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
