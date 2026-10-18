import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { TrackPlan } from "@/components/TrackPlan";
import { Link } from "@/i18n/navigation";
import { catalog } from "@/lib/catalog";
import { demoOval } from "@/lib/demo";
import { billOfMaterials, isClosed } from "@/lib/track-engine";

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("home");
  const bom = billOfMaterials(demoOval);
  const closed = isClosed(demoOval, catalog);
  const steps = [1, 2, 3] as const;

  return (
    <div className="space-y-16">
      <section className="grid items-center gap-10 md:grid-cols-2">
        <div className="space-y-6">
          <h1 className="font-display text-4xl font-semibold leading-tight md:text-5xl">{t("title")}</h1>
          <p className="text-lg text-muted">{t("subtitle")}</p>
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex min-h-11 items-center rounded-xl bg-accent px-5 font-semibold text-accent-ink">
              {t("soon")}
            </span>
            <Link
              href="/pieces"
              className="inline-flex min-h-11 items-center rounded-xl border border-border bg-surface px-5 font-medium"
            >
              {t("seePieces")}
            </Link>
          </div>
        </div>
        <figure className="space-y-3 rounded-2xl border border-border bg-surface p-5">
          <TrackPlan placements={demoOval} catalog={catalog} title={t("demoTitle")} className="mx-auto max-h-72 w-full" />
          <figcaption className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-lg font-semibold">{t("demoTitle")}</span>
              <span className={`rounded-full px-3 py-1 text-sm font-medium ${closed ? "text-ok" : "text-warn"}`}>
                {closed ? t("demoClosed") : t("demoOpen")}
              </span>
            </div>
            <p className="text-sm text-muted">
              {t("demoText", { curves: bom["curve-large"], straights: bom["straight-long"] })}
            </p>
          </figcaption>
        </figure>
      </section>

      <section className="space-y-6">
        <h2 className="font-display text-2xl font-semibold">{t("stepsTitle")}</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((n) => (
            <li key={n} className="space-y-2 rounded-2xl border border-border bg-surface p-5">
              <span className="font-display text-3xl text-accent">{n}</span>
              <h3 className="font-semibold">{t(`step${n}Title`)}</h3>
              <p className="text-sm text-muted">{t(`step${n}Text`)}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
