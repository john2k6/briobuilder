"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { ChildPicker } from "@/components/ChildPicker";
import { CircuitCard } from "@/components/CircuitCard";
import { buttonPrimary, card, Icon, icons, PageHeader } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { generate } from "@/lib/circuits";
import { actions, useAppState, type GeneratorPrefs } from "@/lib/store";
import { totalPieces, type GeneratedLayout, type Size } from "@/lib/track-engine";

type Tab = "buildable" | "almost";
const SIZES: Size[] = ["small", "medium", "large"];

function Toggle({
  pressed,
  onClick,
  icon,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-border bg-surface px-4 font-bold text-ink transition-colors aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-ink"
    >
      {icon && <Icon d={icon} className="size-5" />}
      {children}
    </button>
  );
}

export function CircuitsView() {
  const t = useTranslations();
  const { inventory, prefs, activeChildId, builds, favorites, ready } = useAppState();
  const [tab, setTab] = useState<Tab>("buildable");
  const [result, setResult] = useState<{ key: string; buildable: GeneratedLayout[]; almost: GeneratedLayout[] } | null>(
    null,
  );

  const key = useMemo(() => JSON.stringify({ inventory, prefs }), [inventory, prefs]);
  const loading = ready && result?.key !== key;

  // Le calcul prend quelques centaines de millisecondes : on laisse d'abord l'écran s'afficher.
  useEffect(() => {
    if (!ready || totalPieces(inventory) === 0) return;
    const timer = window.setTimeout(() => {
      const r = generate(inventory, {
        sizes: prefs.sizes,
        require: { bridge: prefs.bridge, switches: prefs.switches, crossing: prefs.crossing },
        decorate: prefs.decorate,
        limit: 18,
      });
      setResult({ key, ...r });
    }, 30);
    return () => window.clearTimeout(timer);
  }, [key, ready, inventory, prefs]);

  const builtCount = (code: string) => builds.filter((b) => b.childId === activeChildId && b.layoutId === code).length;
  const isFavorite = (code: string) => favorites.some((f) => f.childId === activeChildId && f.layoutId === code);
  const setPrefs = (patch: Partial<GeneratorPrefs>) => actions.setPrefs(patch);

  // « Quelle pièce acheter ? » : les pièces qui, seules, débloquent le plus de circuits presque réalisables.
  const suggestions = useMemo(() => {
    const byPiece = new Map<string, { quantity: number; circuits: number }>();
    for (const r of result?.almost ?? []) {
      const entries = Object.entries(r.missing);
      if (entries.length !== 1) continue;
      const [id, qty] = entries[0];
      const s = byPiece.get(id) ?? { quantity: 0, circuits: 0 };
      byPiece.set(id, { quantity: Math.max(s.quantity, qty), circuits: s.circuits + 1 });
    }
    return [...byPiece.entries()].sort((a, b) => b[1].circuits - a[1].circuits).slice(0, 3);
  }, [result]);

  if (ready && totalPieces(inventory) === 0) {
    return (
      <div className="space-y-8">
        <PageHeader title={t("generator.title")} />
        <div className={`${card} flex flex-col items-start gap-5 p-8`}>
          <span className="flex size-14 items-center justify-center rounded-2xl bg-soft text-accent">
            <Icon d={icons.box} className="size-7" />
          </span>
          <p className="max-w-lg text-lg">{t("circuits.emptyBox")}</p>
          <Link href="/box" className={buttonPrimary}>
            {t("circuits.fillBox")}
          </Link>
        </div>
      </div>
    );
  }

  const list = (tab === "buildable" ? result?.buildable : result?.almost) ?? [];

  return (
    <div className="space-y-10">
      <PageHeader title={t("generator.title")} intro={t("generator.intro")} />

      {/* Configuration */}
      <section className="space-y-6 rounded-tl-[2.5rem] rounded-br-[2.5rem] rounded-tr-xl rounded-bl-xl bg-soft p-6 md:p-8">
        <div className="space-y-3">
          <h2 className="text-xl font-extrabold text-ink">{t("generator.size")}</h2>
          <div className="flex flex-wrap gap-2">
            <Toggle pressed={prefs.sizes.length === 0} onClick={() => setPrefs({ sizes: [] })}>
              {t("generator.allSizes")}
            </Toggle>
            {SIZES.map((size) => (
              <Toggle
                key={size}
                pressed={prefs.sizes.includes(size)}
                onClick={() =>
                  setPrefs({
                    sizes: prefs.sizes.includes(size) ? prefs.sizes.filter((s) => s !== size) : [...prefs.sizes, size],
                  })
                }
              >
                {t(`sizes.${size}`)}
                <span className="text-xs font-semibold opacity-80">{t(`generator.sizeHint.${size}`)}</span>
              </Toggle>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="text-xl font-extrabold text-ink">{t("generator.want")}</h2>
          <div className="flex flex-wrap gap-2">
            <Toggle pressed={prefs.bridge} onClick={() => setPrefs({ bridge: !prefs.bridge })} icon={icons.bridge}>
              {t("generator.bridge")}
            </Toggle>
            <Toggle
              pressed={prefs.switches}
              onClick={() => setPrefs({ switches: !prefs.switches })}
              icon={icons.switch}
            >
              {t("generator.switches")}
            </Toggle>
            <Toggle pressed={prefs.crossing} onClick={() => setPrefs({ crossing: !prefs.crossing })} icon={icons.cross}>
              {t("generator.crossing")}
            </Toggle>
            <Toggle
              pressed={prefs.decorate}
              onClick={() => setPrefs({ decorate: !prefs.decorate })}
              icon={icons.sparkle}
            >
              {t("generator.decorate")}
            </Toggle>
          </div>
        </div>
      </section>

      <ChildPicker />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" className="inline-flex rounded-full bg-soft p-1">
          {(["buildable", "almost"] as const).map((id) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full px-5 font-bold text-muted aria-selected:bg-surface aria-selected:text-ink aria-selected:shadow"
            >
              {t(id === "buildable" ? "circuits.tabBuildable" : "circuits.tabAlmost")}
              <span
                className={`rounded-full px-2 text-sm ${id === "buildable" ? "bg-green text-green-ink" : "bg-accent text-accent-ink"}`}
              >
                {result && !loading ? (id === "buildable" ? result.buildable.length : result.almost.length) : "–"}
              </span>
            </button>
          ))}
        </div>
        <p className="text-sm text-muted" aria-live="polite">
          {loading ? t("generator.loading") : t("generator.checked")}
        </p>
      </div>

      {!ready || loading ? (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="aspect-[4/5] animate-pulse rounded-tl-[2.5rem] rounded-br-[2.5rem] rounded-tr-xl rounded-bl-xl bg-soft"
            />
          ))}
        </ul>
      ) : list.length === 0 ? (
        <p className={`${card} p-6 text-muted`}>
          {tab === "buildable" ? t("circuits.noneBuildable") : t("circuits.noneAlmost")}
        </p>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <li key={c.code}>
              <CircuitCard
                circuit={c}
                missing={tab === "almost" ? c.missing : undefined}
                favorite={isFavorite(c.code)}
                builtCount={builtCount(c.code)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Idée cadeau (EF-25) */}
      {!loading && suggestions.length > 0 && (
        <section className="space-y-4 rounded-tl-[2.5rem] rounded-br-[2.5rem] rounded-tr-xl rounded-bl-xl bg-green p-6 text-green-ink md:p-8">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-white/15">
              <Icon d={icons.cart} />
            </span>
            <div>
              <h2 className="text-2xl font-extrabold">{t("circuits.buy")}</h2>
              <p className="opacity-90">{t("circuits.buyIntro")}</p>
            </div>
          </div>
          <ul className="grid gap-3 md:grid-cols-3">
            {suggestions.map(([id, s]) => (
              <li key={id} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/20">
                <p className="font-extrabold">
                  +{s.quantity} {t(`pieceNames.${id}`)}
                </p>
                <p className="text-sm opacity-90">{t("circuits.buyUnlocks", { count: s.circuits })}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
