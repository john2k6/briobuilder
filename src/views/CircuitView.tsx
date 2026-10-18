"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ChildPicker } from "@/components/ChildPicker";
import { TrackPlan } from "@/components/TrackPlan";
import { buttonPrimary, buttonSecondary, card, Check, Icon, icons, Stars } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { catalog } from "@/lib/catalog";
import { layoutById } from "@/lib/layouts";
import { actions, useAppState } from "@/lib/store";

export function CircuitView({ id }: { id: string }) {
  const t = useTranslations();
  const layout = layoutById[id];
  const { inventory, activeChildId, favorites, ready } = useAppState();
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const name = t(`layouts.${id}`);
  const entries = Object.entries(layout.bom);
  const missingCount = ready
    ? entries.reduce((sum, [pid, need]) => sum + Math.max(0, need - (inventory[pid] ?? 0)), 0)
    : 0;
  const favorite = favorites.some((f) => f.childId === activeChildId && f.layoutId === id);

  const toggle = (pid: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });

  return (
    <div className="space-y-8">
      <Link
        href="/circuits"
        className="inline-flex min-h-11 items-center gap-1 font-semibold text-muted hover:text-foreground print:hidden"
      >
        <Icon d={icons.left} className="size-5" />
        {t("common.back")}
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">{name}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-medium text-muted">
            <Stars level={layout.difficulty} label={t("common.difficulty", { level: layout.difficulty })} />
            <span>{t("common.pieces", { count: layout.placements.length })}</span>
            <span>{t("common.minutes", { count: layout.minutes })}</span>
            <span>{t("common.age", { age: layout.ageMin })}</span>
            <span>{t(`themes.${layout.theme}`)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {activeChildId && (
            <button
              type="button"
              aria-pressed={favorite}
              onClick={() => actions.toggleFavorite(activeChildId, id)}
              className={`${buttonSecondary} aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-ink`}
            >
              <svg
                viewBox="0 0 24 24"
                className={`size-5 stroke-current stroke-2 ${favorite ? "fill-current" : "fill-none"}`}
                aria-hidden="true"
              >
                <path d={icons.heart} />
              </svg>
              {favorite ? t("circuit.removeFavorite") : t("circuit.addFavorite")}
            </button>
          )}
          <button type="button" className={buttonSecondary} onClick={() => window.print()}>
            <Icon d={icons.print} className="size-5" />
            {t("circuit.print")}
          </button>
        </div>
      </header>

      <div className="print:hidden">
        <ChildPicker />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <figure className="wood-floor rounded-[2rem] border-4 border-header p-4 sm:p-8 print:border-2">
          <TrackPlan placements={layout.placements} catalog={catalog} title={t("circuit.plan")} className="w-full" />
        </figure>

        <section className="space-y-4">
          <div>
            <h2 className="font-display text-2xl font-bold">{t("circuit.bom")}</h2>
            <p className="text-muted">
              {t("circuit.bomHint")} · {t("circuit.checked", { done: checked.size, total: entries.length })}
            </p>
          </div>
          <ul className="space-y-2">
            {entries.map(([pid, need]) => {
              const have = inventory[pid] ?? 0;
              const lacking = ready && have < need;
              const isChecked = checked.has(pid);
              return (
                <li key={pid}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isChecked}
                    onClick={() => toggle(pid)}
                    className={`${card} flex w-full items-center gap-3 p-3 text-left ${lacking ? "border-accent" : ""} ${isChecked ? "opacity-60" : ""}`}
                  >
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-lg border-2 ${isChecked ? "border-green bg-green text-green-ink" : "border-border"}`}
                    >
                      {isChecked && <Check />}
                    </span>
                    <span className="wood-floor w-16 shrink-0 rounded-xl p-1">
                      <TrackPlan
                        placements={[{ id: pid, pieceTypeId: pid, x: 0, y: 0, rotation: 0, flipped: false }]}
                        catalog={catalog}
                        title=""
                        frame={{ width: 280, height: 200 }}
                        showConnectors={false}
                        className="w-full"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block font-semibold ${isChecked ? "line-through" : ""}`}>
                        {t(`pieceNames.${pid}`)}
                      </span>
                      {ready && (
                        <span className={`block text-sm ${lacking ? "font-semibold text-accent" : "text-muted"}`}>
                          {t("circuit.have", { count: have })}
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-2xl font-bold">×{need}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {missingCount > 0 && (
            <p className="rounded-2xl bg-accent/10 p-4 font-semibold text-accent">
              {t("circuit.missingCount", { count: missingCount })}
            </p>
          )}

          <Link href={`/circuits/${id}/build`} className={`${buttonPrimary} w-full text-lg print:hidden`}>
            {t("circuit.build")}
            <Icon d={icons.right} className="size-5" />
          </Link>
        </section>
      </div>
    </div>
  );
}
