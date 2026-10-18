"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { ChildPicker } from "@/components/ChildPicker";
import { LayoutCard } from "@/components/LayoutCard";
import { buttonPrimary, card, Icon, icons, PageHeader } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { pieceList } from "@/lib/catalog";
import { layoutById, layouts, type Layout } from "@/lib/layouts";
import { AGE_OF_BAND, useAppState } from "@/lib/store";
import { matchInventory, relevance, suggestPurchases, totalPieces, type MatchResult } from "@/lib/track-engine";

type Tab = "buildable" | "almost";
type Sort = "relevance" | "usage" | "new" | "never";

const NEW_DAYS = 30;

export function CircuitsView() {
  const t = useTranslations();
  const { inventory, children, activeChildId, builds, favorites, ready } = useAppState();
  const [tab, setTab] = useState<Tab>("buildable");
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [sort, setSort] = useState<Sort>("relevance");
  const [now] = useState(() => Date.now());

  const child = children.find((c) => c.id === activeChildId);
  const builtCount = (id: string) => builds.filter((b) => b.childId === activeChildId && b.layoutId === id).length;
  const isFavorite = (id: string) => favorites.some((f) => f.childId === activeChildId && f.layoutId === id);

  const { buildable, almost } = useMemo(() => matchInventory(inventory, layouts), [inventory]);
  const suggestions = useMemo(
    () =>
      suggestPurchases(
        inventory,
        layouts,
        pieceList.map((p) => p.id),
      ).slice(0, 3),
    [inventory],
  );

  const sorted = (list: MatchResult<Layout>[]) => {
    const ctx = {
      inventory,
      childAge: child ? AGE_OF_BAND[child.ageBand] : undefined,
      builtIds: new Set(builds.filter((b) => b.childId === activeChildId).map((b) => b.layoutId)),
      favoriteThemes: new Set(
        favorites.filter((f) => f.childId === activeChildId).map((f) => layoutById[f.layoutId]?.theme),
      ),
      newIds: new Set(layouts.filter((l) => now - Date.parse(l.addedAt) < NEW_DAYS * 86_400_000).map((l) => l.id)),
    };
    const score: Record<Sort, (l: Layout) => number> = {
      relevance: (l) => relevance(l, ctx),
      usage: (l) => l.placements.length,
      new: (l) => Date.parse(l.addedAt),
      never: (l) => (ctx.builtIds.has(l.id) ? 0 : 1) + relevance(l, ctx) / 100,
    };
    return list
      .filter((m) => difficulty === null || m.layout.difficulty === difficulty)
      .sort((a, b) => a.missingCount - b.missingCount || score[sort](b.layout) - score[sort](a.layout));
  };

  const list = sorted(tab === "buildable" ? buildable : almost);

  if (ready && totalPieces(inventory) === 0) {
    return (
      <div className="space-y-8">
        <PageHeader title={t("circuits.title")} />
        <div className={`${card} flex flex-col items-start gap-5 p-8`}>
          <span className="flex size-14 items-center justify-center rounded-2xl bg-wood text-header">
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

  const tabs: { id: Tab; count: number }[] = [
    { id: "buildable", count: buildable.length },
    { id: "almost", count: almost.length },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title={t("circuits.title")} intro={t("circuits.intro")} />
      <ChildPicker />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" className="inline-flex rounded-full bg-border p-1">
          {tabs.map(({ id, count }) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full px-5 font-semibold text-muted aria-selected:bg-surface aria-selected:text-foreground aria-selected:shadow"
            >
              {t(id === "buildable" ? "circuits.tabBuildable" : "circuits.tabAlmost")}
              <span
                className={`rounded-full px-2 text-sm ${id === "buildable" ? "bg-green text-green-ink" : "bg-accent text-accent-ink"}`}
              >
                {ready ? count : "–"}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label={t("circuits.filterDifficulty")} className="flex gap-1">
            {[null, 1, 2, 3].map((d) => (
              <button
                key={d ?? "all"}
                type="button"
                aria-pressed={difficulty === d}
                onClick={() => setDifficulty(d)}
                className="min-h-11 rounded-full border-2 border-border px-3 text-sm font-semibold aria-pressed:border-header aria-pressed:bg-header aria-pressed:text-header-ink"
              >
                {d === null ? t("circuits.all") : "★".repeat(d)}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            {t("circuits.sort")}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="min-h-11 rounded-full border-2 border-border bg-surface px-3"
            >
              <option value="relevance">{t("circuits.sortRelevance")}</option>
              <option value="usage">{t("circuits.sortUsage")}</option>
              <option value="new">{t("circuits.sortNew")}</option>
              <option value="never">{t("circuits.sortNever")}</option>
            </select>
          </label>
        </div>
      </div>

      {!ready ? (
        <p className="text-muted">{t("common.loading")}</p>
      ) : list.length === 0 ? (
        <p className={`${card} p-6 text-muted`}>
          {tab === "buildable" ? t("circuits.noneBuildable") : t("circuits.noneAlmost")}
        </p>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((m) => (
            <li key={m.layout.id}>
              <LayoutCard
                layout={m.layout}
                missing={tab === "almost" ? m.missing : undefined}
                favorite={isFavorite(m.layout.id)}
                builtCount={builtCount(m.layout.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Parcours secondaire : idée cadeau (EF-25) */}
      {ready && suggestions.length > 0 && (
        <section className="space-y-4 rounded-3xl bg-header p-6 text-header-ink md:p-8">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-accent">
              <Icon d={icons.cart} />
            </span>
            <div>
              <h2 className="font-display text-2xl font-bold">{t("circuits.buy")}</h2>
              <p className="text-header-muted">{t("circuits.buyIntro")}</p>
            </div>
          </div>
          <ul className="grid gap-3 md:grid-cols-3">
            {suggestions.map((s) => (
              <li key={s.pieceTypeId} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <p className="font-semibold">
                  <span className="font-mono text-accent">+{s.quantity}</span> {t(`pieceNames.${s.pieceTypeId}`)}
                </p>
                <p className="text-sm font-semibold text-header-muted">
                  {t("circuits.buyUnlocks", { count: s.unlocks.length })}
                </p>
                <p className="text-sm text-header-muted">{s.unlocks.map((id) => t(`layouts.${id}`)).join(", ")}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
