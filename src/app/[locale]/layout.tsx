import type { Metadata, Viewport } from "next";
import { Nunito_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MainNav } from "@/components/MainNav";
import { ServiceWorker } from "@/components/ServiceWorker";
import { Logo } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import "../globals.css";

const sans = Nunito_Sans({ variable: "--font-sans", subsets: ["latin"] });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "app" });
  return {
    title: t("name"),
    description: t("description"),
    appleWebApp: { capable: true, title: t("name"), statusBarStyle: "default" },
    icons: { apple: "/icons/apple-touch-icon.png" },
  };
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <html lang={locale}>
      <body className={`${sans.variable} flex min-h-dvh flex-col font-sans antialiased`}>
        <NextIntlClientProvider>
          <ServiceWorker />
          <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur print:hidden">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-2">
              <Link
                href="/"
                className="flex min-h-12 items-center gap-2 text-xl font-extrabold tracking-tight text-ink"
              >
                <Logo className="size-9" />
                {t("app.name")}
              </Link>
              <div className="order-3 w-full md:order-2 md:w-auto md:flex-1">
                <MainNav />
              </div>
              <div className="order-2 md:order-3">
                <LanguageSwitcher />
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">{children}</main>
          <footer className="border-t border-border bg-soft print:hidden">
            <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-muted md:flex-row md:items-center md:justify-between">
              <div className="max-w-3xl space-y-1">
                <p>{t("footer.compat")}</p>
                <p>{t("footer.images")}</p>
              </div>
              <Link
                href="/pieces"
                className="inline-flex min-h-11 items-center font-bold text-ink underline-offset-4 hover:underline"
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
