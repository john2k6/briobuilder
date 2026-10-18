import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { circuitHref } from "@/lib/circuits";
import { TrackPlan, type StepState } from "@/components/TrackPlan";
import { blob, buttonPrimary, buttonSecondary, Check, Icon, icons, SectionTitle, Stars } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { catalog, setList } from "@/lib/catalog";
import { addSet, generateLayouts } from "@/lib/track-engine";

// Calculés une fois au moment du build : ce que permet une seule boîte.
const travel = setList.find((s) => s.id === "travel-switching")!;
const travelResult = generateLayouts(addSet({}, travel), catalog, { decorate: true, limit: 60 });
const travelCircuits = travelResult.buildable;
const hero = travelCircuits.find((c) => c.family === "hill") ?? travelCircuits[0];
const showcase = travelCircuits.filter((c) => c.code !== hero.code).slice(0, 4);
const simple = travelCircuits.find((c) => c.family === "oval") ?? travelCircuits[0];

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("home");
  const tr = useTranslations();
  const name = (c: (typeof travelCircuits)[number]) => `${tr(`families.${c.family}`)} · ${tr(`sizes.${c.size}`)}`;

  // Aperçu du mode enfant : 3 pièces posées, la 4e à poser, le reste à venir.
  const current = 3;
  const kidSteps: Record<string, StepState> = Object.fromEntries(
    simple.placements.map((p, i) => [p.id, i < current ? "done" : i === current ? "current" : "todo"]),
  );

  const tiles = [
    { href: "/box", title: t("tileBoxes"), icon: icons.box },
    { href: "/circuits", title: t("tileCreate"), icon: icons.sparkle },
    { href: "/kids", title: t("tileKids"), icon: icons.star },
    { href: "/pieces", title: t("tilePieces"), icon: icons.bridge },
  ] as const;

  return (
    <div className="space-y-20 pb-8">
      {/* Accroche */}
      <section className="grid items-center gap-10 pt-2 lg:grid-cols-[1fr_1.05fr]">
        <div className="space-y-6">
          <p className="text-sm font-extrabold uppercase tracking-widest text-green">{t("eyebrow")}</p>
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            {t.rich("title", { hl: (chunks) => <span className="font-extrabold text-accent">{chunks}</span> })}
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted">{t("subtitle")}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/box" className={buttonPrimary}>
              {t("start")}
              <Icon d={icons.right} className="size-5" />
            </Link>
            <Link href="/circuits" className={buttonSecondary}>
              {t("tryGenerator")}
            </Link>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold text-ink">
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

        <figure className={`${blob} relative border border-border`}>
          <div className="wood-floor p-4 sm:p-6">
            <TrackPlan
              placements={hero.placements}
              catalog={catalog}
              accessories={hero.accessories}
              title={name(hero)}
              train
              showConnectors={false}
              className="w-full"
            />
          </div>
          <figcaption className="flex flex-wrap items-center justify-between gap-2 bg-accent px-6 py-4 text-accent-ink">
            <span className="text-lg font-extrabold">{name(hero)}</span>
            <span className="flex items-center gap-1 text-sm font-bold">
              <Check />
              {t("checked")}
            </span>
          </figcaption>
        </figure>
      </section>

      {/* Rubriques */}
      <section>
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {tiles.map((tile, i) => (
            <li key={tile.href}>
              <Link
                href={tile.href}
                className={`${i % 2 === 0 ? "rounded-tl-[2.5rem]" : "rounded-br-[2.5rem]"} flex h-full flex-col overflow-hidden rounded-xl transition-transform hover:-translate-y-1`}
              >
                <span className="flex aspect-[5/3] items-center justify-center bg-soft text-accent">
                  <Icon d={tile.icon} className="size-14" />
                </span>
                <span className="flex flex-1 items-center justify-center bg-accent px-4 py-5 text-center text-lg font-bold leading-tight text-accent-ink md:text-2xl">
                  {tile.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Ce que permet une seule boîte */}
      <section className="relative left-1/2 w-screen -translate-x-1/2 bg-green text-green-ink">
        <div className="mx-auto max-w-6xl space-y-8 px-4 py-16">
          <div className="max-w-3xl space-y-3">
            <h2 className="text-3xl font-semibold leading-tight md:text-5xl">
              {t("showcaseTitle", { count: travelResult.total.buildable, set: tr(`setNames.${travel.id}`) })}
            </h2>
            <p className="text-lg opacity-90">{t("showcaseText")}</p>
          </div>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {showcase.map((c) => (
              <li key={c.code}>
                <Link
                  href={circuitHref(c.code)}
                  className={`${blob} flex h-full flex-col bg-surface text-foreground transition-transform hover:-translate-y-1`}
                >
                  <div className="wood-floor p-3">
                    <TrackPlan
                      placements={c.placements}
                      catalog={catalog}
                      accessories={c.accessories}
                      title={name(c)}
                      frame={{ width: 1500, height: 1050 }}
                      showConnectors={false}
                      className="aspect-[10/7] w-full"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-extrabold leading-tight text-ink">{name(c)}</h3>
                      <Stars level={c.difficulty} label={tr("common.difficulty", { level: c.difficulty })} />
                    </div>
                    <p className="text-sm font-semibold text-muted">{tr("common.pieces", { count: c.pieces })}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="space-y-8">
        <SectionTitle>{t("stepsTitle")}</SectionTitle>
        <ol className="grid gap-5 md:grid-cols-3">
          {([1, 2, 3] as const).map((n) => (
            <li key={n} className={`${blob} space-y-3 border border-border bg-surface p-6`}>
              <span className="flex size-12 items-center justify-center rounded-full bg-accent text-xl font-extrabold text-accent-ink">
                {n}
              </span>
              <h3 className="text-xl font-extrabold text-ink">{t(`step${n}Title`)}</h3>
              <p className="leading-relaxed text-muted">{t(`step${n}Text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Mode enfant */}
      <section className="grid items-center gap-10 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <div className={`${blob} border-[10px] border-ink bg-surface shadow-xl`} aria-hidden="true">
            <div className="flex items-center justify-between gap-3 bg-background px-5 py-3">
              <span className="text-lg font-extrabold uppercase text-ink">
                {t("kidStep", { step: current + 1, total: simple.placements.length })}
              </span>
              <span className="flex size-12 items-center justify-center rounded-full bg-green text-green-ink">
                <Icon d={icons.sound} />
              </span>
            </div>
            <div className="wood-floor px-6 py-4">
              <TrackPlan
                placements={simple.placements}
                catalog={catalog}
                title=""
                steps={kidSteps}
                showConnectors={false}
                className="mx-auto max-h-56 w-full"
              />
            </div>
            <p className="bg-background px-5 pt-4 text-center text-xl font-extrabold uppercase text-ink">
              {t("kidInstruction")}
            </p>
            <div className="grid grid-cols-2 gap-3 bg-background p-5">
              <span className="flex min-h-16 items-center justify-center rounded-2xl bg-soft text-lg font-extrabold uppercase text-ink">
                {t("kidPrev")}
              </span>
              <span className="flex min-h-16 items-center justify-center rounded-2xl bg-accent text-lg font-extrabold uppercase text-accent-ink">
                {t("kidNext")}
              </span>
            </div>
          </div>
        </div>
        <div className="order-1 space-y-5 lg:order-2">
          <p className="text-sm font-extrabold uppercase tracking-widest text-green">{t("kidEyebrow")}</p>
          <SectionTitle>{t("kidTitle")}</SectionTitle>
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
