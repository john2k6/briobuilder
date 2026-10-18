import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MainNav } from "@/components/MainNav";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import "../globals.css";

const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"] });
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
          <header className="border-b-4 border-accent bg-header text-header-ink print:hidden">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
              <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold">
                <span className="flex size-8 items-center justify-center rounded-lg bg-accent" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    className="size-5 fill-none stroke-white stroke-[2.5] [stroke-linecap:round]"
                  >
                    <path d="M4 18c0-7 4-12 16-12M7 20V16M12 20v-6.5M17 20v-9" />
                  </svg>
                </span>
                {t("app.name")}
              </Link>
              <div className="order-3 w-full md:order-2 md:w-auto">
                <MainNav />
              </div>
              <div className="order-2 md:order-3">
                <LanguageSwitcher />
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">{children}</main>
          <footer className="bg-header print:hidden">
            <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-header-muted md:flex-row md:items-center md:justify-between">
              <p className="max-w-3xl">{t("footer.compat")}</p>
              <Link
                href="/pieces"
                className="inline-flex min-h-11 items-center font-medium text-header-ink underline-offset-4 hover:underline"
              >
                {t("nav.pieces")}
              </Link>
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
