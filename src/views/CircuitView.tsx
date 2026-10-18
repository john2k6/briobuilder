"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChildPicker } from "@/components/ChildPicker";
import { FeatureBadges, useCircuitName } from "@/components/CircuitCard";
import { circuitHref } from "@/lib/circuits";
import { PieceThumb } from "@/components/PieceThumb";
import { TrackPlan } from "@/components/TrackPlan";
import { buttonPrimary, buttonSecondary, card, Check, Icon, icons, Stars } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { catalog } from "@/lib/catalog";
import { circuitFromCode } from "@/lib/circuits";
import { actions, useAppState } from "@/lib/store";

export function CircuitView() {
  const t = useTranslations();
  const code = useSearchParams().get("c") ?? "";
  const circuit = circuitFromCode(code);
  const nameOf = useCircuitName();
  const { inventory, activeChildId, favorites, ready } = useAppState();
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const back = (
    <Link
      href="/circuits"
      className="inline-flex min-h-11 items-center gap-1 font-bold text-muted hover:text-ink print:hidden"
    >
      <Icon d={icons.left} className="size-5" />
      {t("common.back")}
    </Link>
  );

  if (!circuit) {
    return (
      <div className="space-y-6">
        {back}
        <p className={`${card} p-6 text-lg`}>{t("circuit.notFound")}</p>
      </div>
    );
  }

  const name = nameOf(circuit);
  const entries = Object.entries(circuit.bom);
  const missingCount = ready
    ? entries.reduce((sum, [pid, need]) => sum + Math.max(0, need - (inventory[pid] ?? 0)), 0)
    : 0;
  const favorite = favorites.some((f) => f.childId === activeChildId && f.layoutId === code);

  const toggle = (pid: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });

  return (
    <div className="space-y-8">
      {back}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{name}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-semibold text-muted">
            <Stars level={circuit.difficulty} label={t("common.difficulty", { level: circuit.difficulty })} />
            <span>{t("common.pieces", { count: circuit.pieces })}</span>
            <span>{t("common.minutes", { count: circuit.minutes })}</span>
            <FeatureBadges circuit={circuit} />
          </div>
          <p className="text-sm text-muted">
            {circuit.gap < 0.5 ? t("circuit.exact") : t("circuit.play", { gap: Math.ceil(circuit.gap) })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {activeChildId && (
            <button
              type="button"
              aria-pressed={favorite}
              onClick={() => actions.toggleFavorite(activeChildId, code)}
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
        <figure className="wood-floor self-start overflow-hidden rounded-tl-[2.5rem] rounded-br-[2.5rem] rounded-tr-xl rounded-bl-xl border border-border p-4 sm:p-8">
          <TrackPlan
            placements={circuit.placements}
            catalog={catalog}
            title={t("circuit.plan")}
            accessories={circuit.accessories}
            train
            className="w-full"
          />
        </figure>

        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-extrabold text-ink">{t("circuit.bom")}</h2>
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
                    <span className="wood-floor w-16 shrink-0 rounded-lg p-1">
                      <PieceThumb id={pid} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block font-bold ${isChecked ? "line-through" : ""}`}>
                        {t(`pieceNames.${pid}`)}
                      </span>
                      {ready && (
                        <span className={`block text-sm ${lacking ? "font-bold text-accent" : "text-muted"}`}>
                          {t("circuit.have", { count: have })}
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-2xl font-extrabold text-ink">×{need}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {missingCount > 0 && (
            <p className="rounded-xl bg-accent/10 p-4 font-bold text-accent">
              {t("circuit.missingCount", { count: missingCount })}
            </p>
          )}

          <Link href={circuitHref(code, true)} className={`${buttonPrimary} w-full text-lg print:hidden`}>
            {t("circuit.build")}
            <Icon d={icons.right} className="size-5" />
          </Link>
        </section>
      </div>
    </div>
  );
}
