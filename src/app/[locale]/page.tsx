import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { OfficialImage } from "@/components/OfficialImage";
import { TrackPlan, type StepState } from "@/components/TrackPlan";
import { blob, buttonPrimary, buttonSecondary, Check, Icon, icons, SectionTitle, Stars } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { catalog, setList } from "@/lib/catalog";
import { circuitHref } from "@/lib/circuits";
import { officialImage } from "@/lib/official";
import { addSet, FAMILIES, generateLayouts, type Inventory, type TrackSet } from "@/lib/track-engine";

// Calculés une fois au moment du build.
const byRef = (ref: string) => setList.find((s) => s.ref === ref)!;
const HERO = ["33766", "33887", "33512", "36114"].map(byRef);
const POPULAR = ["33512", "33815", "33052", "33887", "33097", "33028", "36114", "33766", "33773", "33989"].map(byRef);
const countFor = (set: TrackSet) => generateLayouts(addSet({}, set), catalog, { limit: 1 }).total.buildable;
const popularCounts = Object.fromEntries(POPULAR.map((s) => [s.id, countFor(s)]));
const deluxe = byRef("33052");
const mix: Inventory = [deluxe, byRef("33307"), byRef("33772")].reduce<Inventory>((inv, s) => addSet(inv, s), {});
const deluxeResult = generateLayouts(addSet({}, deluxe), catalog, { decorate: true, limit: 40 });
const mixTotal = generateLayouts(mix, catalog, { limit: 1 }).total.buildable;
const showcase = ["network", "hill", "terminus", "bean"]
  .map((f) => deluxeResult.buildable.find((c) => c.family === f))
  .filter((c) => c !== undefined);
const simple = deluxeResult.buildable.find((c) => c.family === "oval") ?? deluxeResult.buildable[0];
const productCount = setList.filter((s) => s.ref).length;

function ProductCard({ set, className = "" }: { set: TrackSet; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl bg-white p-2 shadow-lg ring-1 ring-black/5 ${className}`}>
      <OfficialImage
        src={officialImage(set.ref)}
        className="aspect-[520/445] w-full object-contain"
        fallback={<div className="aspect-[520/445] w-full bg-soft" />}
      />
    </div>
  );
}

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("home");
  const tr = useTranslations();
  const name = (c: (typeof showcase)[number]) => `${tr(`families.${c.family}`)} · ${tr(`sizes.${c.size}`)}`;

  // Aperçu du mode enfant : 3 pièces posées, la 4e à poser, le reste à venir.
  const current = 3;
  const kidSteps: Record<string, StepState> = Object.fromEntries(
    simple.placements.map((p, i) => [p.id, i < current ? "done" : i === current ? "current" : "todo"]),
  );

  return (
    <div className="space-y-20 pb-8">
      {/* Accroche : de vrais coffrets */}
      <section className="relative left-1/2 -mt-10 w-screen -translate-x-1/2 overflow-hidden bg-[linear-gradient(180deg,#fff7ec_0%,#f7f0e4_100%)]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 lg:grid-cols-[1fr_1.1fr] lg:py-16">
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
          <figure className="relative">
            <div className="grid grid-cols-6 grid-rows-[auto_auto] gap-4">
              <ProductCard set={HERO[0]} className="col-span-4 -rotate-1" />
              <div className="col-span-2 flex flex-col justify-end gap-4">
                <ProductCard set={HERO[1]} className="rotate-2" />
              </div>
              <ProductCard set={HERO[2]} className="col-span-3 rotate-1" />
              <ProductCard set={HERO[3]} className="col-span-3 -rotate-2" />
            </div>
            <figcaption className="mt-3 text-right text-xs text-muted">{tr("official.credit")}</figcaption>
          </figure>
        </div>
      </section>

      {/* Chiffres */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { value: String(productCount), label: t("statProducts") },
          { value: String(FAMILIES.length), label: t("statFamilies") },
          { value: `${mixTotal}+`, label: t("statCircuits") },
        ].map((s) => (
          <div key={s.label} className={`${blob} bg-soft p-6`}>
            <p className="font-mono text-5xl font-extrabold text-accent">{s.value}</p>
            <p className="mt-2 font-bold text-ink">{s.label}</p>
          </div>
        ))}
      </section>

      {/* Coffrets populaires */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <SectionTitle>{t("popularTitle")}</SectionTitle>
            <p className="text-lg text-muted">{t("popularText")}</p>
          </div>
          <Link href="/box" className={buttonSecondary}>
            {t("seeAll")}
          </Link>
        </div>
        <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4">
          {POPULAR.map((set) => (
            <li key={set.id} className="w-56 shrink-0 snap-start">
              <Link
                href="/box"
                className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white transition hover:-translate-y-1 hover:shadow-lg"
              >
                <OfficialImage
                  src={officialImage(set.ref)}
                  className="aspect-[520/445] w-full object-contain p-2"
                  fallback={<div className="aspect-[520/445] w-full bg-soft" />}
                />
                <span className="flex flex-1 flex-col gap-1 border-t border-border p-3">
                  <span className="font-extrabold leading-tight text-ink">{tr(`setNames.${set.id}`)}</span>
                  <span className="text-xs text-muted">{tr("box.ref", { ref: set.ref ?? "" })}</span>
                  <span className="mt-auto pt-2 text-sm font-bold text-green">
                    {t("circuitsFor", { count: popularCounts[set.id] })}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">{tr("official.credit")}</p>
      </section>

      {/* Ce que le moteur invente */}
      <section className="relative left-1/2 w-screen -translate-x-1/2 bg-green text-green-ink">
        <div className="mx-auto max-w-6xl space-y-8 px-4 py-16">
          <div className="flex flex-wrap items-center gap-6">
            <div className="w-28 shrink-0 overflow-hidden rounded-2xl bg-white p-1">
              <OfficialImage
                src={officialImage(deluxe.ref)}
                className="aspect-[520/445] w-full object-contain"
                fallback={<div className="aspect-[520/445] w-full" />}
              />
            </div>
            <div className="max-w-3xl space-y-3">
              <h2 className="text-3xl font-semibold leading-tight md:text-5xl">
                {t("showcaseTitle", { count: deluxeResult.total.buildable, set: tr(`setNames.${deluxe.id}`) })}
              </h2>
              <p className="text-lg opacity-90">{t("showcaseText")}</p>
            </div>
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
                      frame={{ width: 1800, height: 1300 }}
                      showConnectors={false}
                      className="aspect-[18/13] w-full"
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
