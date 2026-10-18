import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use, type ReactNode } from "react";
import { TrackPlan, type StepState } from "@/components/TrackPlan";
import { Link } from "@/i18n/navigation";
import { catalog } from "@/lib/catalog";
import { demoOval, starterMatches } from "@/lib/demo";
import { isClosed } from "@/lib/track-engine";
import { buttonPrimary, Check, Stars } from "@/components/ui";

const icon = "size-6 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]";

const stepIcons: Record<1 | 2 | 3, ReactNode> = {
  1: (
    <svg viewBox="0 0 24 24" className={icon} aria-hidden="true">
      <path d="M3 8l9-4 9 4-9 4-9-4z" />
      <path d="M3 8v8l9 4 9-4V8M12 12v8" />
    </svg>
  ),
  2: (
    <svg viewBox="0 0 24 24" className={icon} aria-hidden="true">
      <rect x="4" y="6" width="16" height="12" rx="6" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  3: (
    <svg viewBox="0 0 24 24" className={icon} aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
};

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("home");
  const tl = useTranslations("layouts");
  const tc = useTranslations("common");
  const closed = isClosed(demoOval, catalog);
  const buildable = starterMatches.buildable.map((m) => m.layout);

  // Aperçu du mode enfant : 3 pièces posées, la 4e à poser, le reste à venir.
  const current = 3;
  const kidSteps: Record<string, StepState> = Object.fromEntries(
    demoOval.map((p, i) => [p.id, i < current ? "done" : i === current ? "current" : "todo"]),
  );

  return (
    <div className="space-y-24 pb-8">
      {/* Accroche */}
      <section className="grid items-center gap-10 pt-4 lg:grid-cols-[1.05fr_1fr]">
        <div className="space-y-7">
          <p className="text-sm font-semibold uppercase tracking-widest text-green">{t("eyebrow")}</p>
          <h1 className="font-display text-5xl font-bold leading-[1.1] tracking-tight md:text-6xl">
            {t.rich("title", {
              hl: (chunks) => (
                <span className="relative whitespace-nowrap text-accent">
                  {chunks}
                  <svg
                    viewBox="0 0 200 12"
                    preserveAspectRatio="none"
                    className="absolute -bottom-1 left-0 h-2.5 w-full"
                    aria-hidden="true"
                  >
                    <path
                      d="M2 9 Q 50 2 100 7 T 198 5"
                      fill="none"
                      stroke="var(--wood)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              ),
            })}
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted">{t("subtitle")}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/box" className={buttonPrimary}>
              {t("soon")}
            </Link>
            <Link
              href="/pieces"
              className="inline-flex min-h-12 items-center rounded-full border-2 border-header px-6 font-semibold transition-colors hover:bg-header hover:text-header-ink"
            >
              {t("seePieces")}
            </Link>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
            {(["trustAds", "trustAge", "trustEu"] as const).map((key) => (
              <li key={key} className="flex items-center gap-2">
                <span className="text-green">
                  <Check />
                </span>
                {t(key)}
              </li>
            ))}
          </ul>
        </div>

        <figure className="relative">
          <div className="wood-floor rounded-[2rem] border-4 border-header p-4 sm:p-6">
            <TrackPlan
              placements={demoOval}
              catalog={catalog}
              title={t("planTitle")}
              train
              showConnectors={false}
              className="w-full"
            />
          </div>
          <figcaption className="absolute -bottom-5 left-6 flex items-center gap-2 rounded-full bg-green px-4 py-2 text-sm font-semibold text-green-ink shadow-lg">
            <Check />
            {closed ? t("closed") : t("open")} · {t("checked")}
          </figcaption>
        </figure>
      </section>

      {/* Le problème */}
      <section className="relative left-1/2 w-screen -translate-x-1/2 bg-header text-header-ink">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-[1.4fr_1fr] md:items-center">
          <p className="font-display text-3xl font-bold leading-tight md:text-4xl">{t("problem")}</p>
          <p className="text-lg leading-relaxed text-header-muted">{t("problemText")}</p>
        </div>
      </section>

      {/* Circuits réalisables avec un coffret de démarrage */}
      <section className="space-y-8">
        <div className="max-w-2xl space-y-3">
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            {t("showcaseTitle", { count: buildable.length })}
          </h2>
          <p className="text-lg text-muted">{t("showcaseText")}</p>
        </div>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {buildable.map((layout) => (
            <li key={layout.id}>
              <Link
                href={`/circuits/${layout.id}`}
                className="group flex flex-col overflow-hidden rounded-3xl border-2 border-border bg-surface transition-transform hover:-translate-y-1"
              >
                <div className="wood-floor relative border-b-2 border-border p-5">
                  <TrackPlan
                    placements={layout.placements}
                    catalog={catalog}
                    title={tl(layout.id)}
                    frame={{ width: 900, height: 620 }}
                    showConnectors={false}
                    className="aspect-[3/2] w-full"
                  />
                  <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-green px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-ink">
                    <Check />
                    {t("buildable")}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-xl font-bold">{tl(layout.id)}</h3>
                    <Stars level={layout.difficulty} label={tc("difficulty", { level: layout.difficulty })} />
                  </div>
                  <p className="flex gap-4 text-sm font-medium text-muted">
                    <span>{tc("pieces", { count: layout.placements.length })}</span>
                    <span>{tc("minutes", { count: layout.minutes })}</span>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Comment ça marche */}
      <section className="space-y-8">
        <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{t("stepsTitle")}</h2>
        <ol className="grid gap-5 md:grid-cols-3">
          {([1, 2, 3] as const).map((n) => (
            <li key={n} className="relative space-y-3 rounded-3xl bg-surface p-6 ring-2 ring-border">
              <div className="flex items-center justify-between">
                <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-ink">
                  {stepIcons[n]}
                </span>
                <span className="font-display text-5xl font-bold text-border">{n}</span>
              </div>
              <h3 className="font-display text-xl font-bold">{t(`step${n}Title`)}</h3>
              <p className="leading-relaxed text-muted">{t(`step${n}Text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Mode enfant */}
      <section className="grid items-center gap-10 lg:grid-cols-2">
        <div className="order-2 space-y-5 lg:order-1">
          <div
            className="overflow-hidden rounded-[2rem] border-[10px] border-header bg-surface shadow-xl"
            aria-hidden="true"
          >
            <div className="flex items-center justify-between gap-3 bg-background px-5 py-3">
              <span className="font-display text-lg font-bold uppercase">
                {t("kidStep", { step: current + 1, total: demoOval.length })}
              </span>
              <span className="flex size-12 items-center justify-center rounded-full bg-green text-green-ink">
                <svg viewBox="0 0 24 24" className={icon}>
                  <path d="M4 9v6h4l5 4V5L8 9H4zM16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11" />
                </svg>
              </span>
            </div>
            <div className="wood-floor px-6 py-4">
              <TrackPlan
                placements={demoOval}
                catalog={catalog}
                title=""
                steps={kidSteps}
                showConnectors={false}
                className="mx-auto max-h-56 w-full"
              />
            </div>
            <p className="bg-background px-5 pt-4 text-center font-display text-xl font-bold uppercase">
              {t("kidInstruction")}
            </p>
            <div className="grid grid-cols-2 gap-3 bg-background p-5">
              <span className="flex min-h-16 items-center justify-center rounded-2xl bg-border text-lg font-bold uppercase">
                {t("kidPrev")}
              </span>
              <span className="flex min-h-16 items-center justify-center rounded-2xl bg-accent text-lg font-bold uppercase text-accent-ink shadow-[0_5px_0_0_var(--accent-dark)]">
                {t("kidNext")}
              </span>
            </div>
          </div>
        </div>
        <div className="order-1 space-y-5 lg:order-2">
          <p className="text-sm font-semibold uppercase tracking-widest text-green">{t("kidEyebrow")}</p>
          <h2 className="font-display text-4xl font-bold tracking-tight">{t("kidTitle")}</h2>
          <p className="text-lg text-muted">{t("kidText")}</p>
          <ul className="space-y-3">
            {(["kidPoint1", "kidPoint2", "kidPoint3", "kidPoint4"] as const).map((key) => (
              <li key={key} className="flex items-start gap-3 text-lg">
                <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-green text-green-ink">
                  <Check />
                </span>
                {t(key)}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
