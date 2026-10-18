"use client";

import { useTranslations } from "next-intl";
import { TrackPlan } from "@/components/TrackPlan";
import { Check, icons, Stars } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { catalog } from "@/lib/catalog";
import type { Layout } from "@/lib/layouts";
import type { Inventory } from "@/lib/track-engine";

export function LayoutCard({
  layout,
  missing,
  favorite,
  builtCount = 0,
}: {
  layout: Layout;
  missing?: Inventory;
  favorite?: boolean;
  builtCount?: number;
}) {
  const t = useTranslations();
  const name = t(`layouts.${layout.id}`);
  const missingEntries = Object.entries(missing ?? {});

  return (
    <Link
      href={`/circuits/${layout.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border-2 border-border bg-surface transition-transform hover:-translate-y-1 focus-visible:-translate-y-1"
    >
      <div className="wood-floor relative border-b-2 border-border p-4">
        <TrackPlan
          placements={layout.placements}
          catalog={catalog}
          title={name}
          frame={{ width: 1100, height: 760 }}
          showConnectors={false}
          className="aspect-[3/2] w-full"
        />
        {missingEntries.length === 0 ? (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-green px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-ink">
            <Check />
            {t("circuits.buildableBadge")}
          </span>
        ) : null}
        {favorite && (
          <span
            className="absolute left-3 top-3 flex size-8 items-center justify-center rounded-full bg-accent text-accent-ink"
            title={t("circuits.favorite")}
          >
            <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-label={t("circuits.favorite")} role="img">
              <path d={icons.heart} />
            </svg>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-xl font-bold">{name}</h3>
          <Stars level={layout.difficulty} label={t("common.difficulty", { level: layout.difficulty })} />
        </div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-muted">
          <span>{t("common.pieces", { count: layout.placements.length })}</span>
          <span>{t("common.minutes", { count: layout.minutes })}</span>
          <span>{t("common.age", { age: layout.ageMin })}</span>
        </p>
        {builtCount > 0 && (
          <p className="flex items-center gap-1 text-sm font-semibold text-green">
            <Check />
            {t("circuits.built", { count: builtCount })}
          </p>
        )}
        {missingEntries.length > 0 && (
          <div className="mt-auto rounded-2xl bg-accent/10 p-3 text-sm">
            <p className="font-semibold text-accent">{t("circuits.missing")}</p>
            <ul>
              {missingEntries.map(([id, qty]) => (
                <li key={id} className="flex justify-between gap-2">
                  <span>{t(`pieceNames.${id}`)}</span>
                  <span className="font-mono font-semibold text-accent">× {qty}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Link>
  );
}
