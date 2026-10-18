import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MainNav } from "@/components/MainNav";
import { ServiceWorker } from "@/components/ServiceWorker";
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
  return {
    title: t("name"),
    description: t("description"),
    appleWebApp: { capable: true, title: t("name"), statusBarStyle: "black" },
    icons: { apple: "/icons/apple-touch-icon.png" },
  };
}

export const viewport: Viewport = {
  themeColor: "#2e3236",
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <html lang={locale}>
      <body className={`${display.variable} ${sans.variable} font-sans antialiased flex min-h-dvh flex-col`}>
        <NextIntlClientProvider>
          <ServiceWorker />
          <header className="border-b-4 border-accent bg-header text-header-ink print:hidden">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
              <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold">
                <svg viewBox="0 0 64 64" className="size-8 shrink-0" aria-hidden="true">
                  <rect width="64" height="64" rx="14" fill="var(--accent)" />
                  <path d="M26 64A38 38 0 0 1 64 26" fill="none" stroke="#a6773f" strokeWidth="18" />
                  <path d="M26 64A38 38 0 0 1 64 26" fill="none" stroke="#ddb67f" strokeWidth="14.5" />
                  <g transform="translate(37.1 37.1) rotate(-45)">
                    <rect x="-10" y="-7" width="20" height="14" rx="3" fill="#2e3236" />
                    <circle cx="5" cy="0" r="2.6" fill="#ddb67f" />
                  </g>
                </svg>
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
