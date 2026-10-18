"use client";

import { useTranslations } from "next-intl";
import { TrackPlan } from "@/components/TrackPlan";
import { blob, Check, Icon, icons, Stars } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { catalog } from "@/lib/catalog";
import { circuitHref, type Circuit } from "@/lib/circuits";
import type { Inventory } from "@/lib/track-engine";

/** Nom lisible d'un circuit : sa forme et sa taille. */
export function useCircuitName() {
  const t = useTranslations();
  return (c: Pick<Circuit, "family" | "size">) => `${t(`families.${c.family}`)} · ${t(`sizes.${c.size}`)}`;
}

export function FeatureBadges({ circuit }: { circuit: Pick<Circuit, "features"> }) {
  const t = useTranslations("generator");
  const list = [
    circuit.features.bridge && { key: "bridge", icon: icons.bridge },
    circuit.features.switches && { key: "switches", icon: icons.switch },
    circuit.features.crossing && { key: "crossing", icon: icons.cross },
  ].filter(Boolean) as { key: string; icon: string }[];
  if (!list.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {list.map((f) => (
        <span
          key={f.key}
          className="inline-flex items-center gap-1 rounded-full bg-soft px-2 py-0.5 text-xs font-bold text-ink"
        >
          <Icon d={f.icon} className="size-3.5" />
          {t(f.key)}
        </span>
      ))}
    </span>
  );
}

export function CircuitCard({
  circuit,
  missing,
  favorite,
  builtCount = 0,
}: {
  circuit: Circuit;
  missing?: Inventory;
  favorite?: boolean;
  builtCount?: number;
}) {
  const t = useTranslations();
  const name = useCircuitName()(circuit);
  const missingEntries = Object.entries(missing ?? {});

  return (
    <Link
      href={circuitHref(circuit.code)}
      className={`${blob} group flex h-full flex-col border border-border bg-surface transition-transform hover:-translate-y-1 focus-visible:-translate-y-1`}
    >
      <div className="wood-floor relative p-3">
        <TrackPlan
          placements={circuit.placements}
          catalog={catalog}
          title={name}
          accessories={circuit.accessories}
          frame={{ width: 1500, height: 1050 }}
          showConnectors={false}
          className="aspect-[10/7] w-full"
        />
        {missingEntries.length === 0 && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-green px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-green-ink">
            <Check />
            {t("circuits.buildableBadge")}
          </span>
        )}
        {favorite && (
          <span className="absolute left-3 top-3 flex size-8 items-center justify-center rounded-full bg-accent text-accent-ink">
            <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-label={t("circuits.favorite")} role="img">
              <path d={icons.heart} />
            </svg>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 bg-surface p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-extrabold leading-tight text-ink">{name}</h3>
          <Stars level={circuit.difficulty} label={t("common.difficulty", { level: circuit.difficulty })} />
        </div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-muted">
          <span>{t("common.pieces", { count: circuit.pieces })}</span>
          <span>{t("common.minutes", { count: circuit.minutes })}</span>
        </p>
        <FeatureBadges circuit={circuit} />
        {builtCount > 0 && (
          <p className="flex items-center gap-1 text-sm font-bold text-green">
            <Check />
            {t("circuits.built", { count: builtCount })}
          </p>
        )}
        {missingEntries.length > 0 && (
          <div className="mt-auto rounded-xl bg-accent/10 p-3 text-sm">
            <p className="font-extrabold text-accent">{t("circuits.missing")}</p>
            <ul>
              {missingEntries.map(([id, qty]) => (
                <li key={id} className="flex justify-between gap-2">
                  <span>{t(`pieceNames.${id}`)}</span>
                  <span className="font-mono font-bold text-accent">× {qty}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Link>
  );
}
