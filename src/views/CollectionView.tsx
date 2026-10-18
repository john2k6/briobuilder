"use client";

import { useTranslations } from "next-intl";
import { PieceThumb } from "@/components/PieceThumb";
import { SetArt } from "@/components/SetArt";
import { blob, buttonPrimary, buttonSecondary, card, Icon, icons, PageHeader, SectionTitle } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { pieceList, setList } from "@/lib/catalog";
import { useAppState } from "@/lib/store";
import type { PieceCategory } from "@/lib/track-engine";

/** Ordre d'affichage des familles de pièces. */
const ORDER: PieceCategory[] = [
  "straight",
  "curve",
  "switch",
  "crossing",
  "ramp",
  "bridge",
  "buffer",
  "adapter",
  "building",
  "accessory",
  "vehicle",
];

/** Ma collection : tout ce que la famille possède, coffrets et pièces réunis. */
export function CollectionView() {
  const t = useTranslations();
  const { inventory, sets, ready } = useAppState();

  const owned = pieceList.filter((p) => (inventory[p.id] ?? 0) > 0);
  const ownedSets = setList.filter((s) => (sets[s.id] ?? 0) > 0 && s.kind !== "vehicle");
  const trains = setList.filter((s) => (sets[s.id] ?? 0) > 0 && s.kind === "vehicle");
  const qty = (ids: string[]) => ids.reduce((sum, id) => sum + (inventory[id] ?? 0), 0);
  const ofCategory = (...categories: PieceCategory[]) =>
    owned.filter((p) => categories.includes(p.category)).map((p) => p.id);
  const tracks = owned.filter((p) => p.lengthMm > 0 && !["building", "accessory", "vehicle"].includes(p.category));
  const meters = tracks.reduce((sum, p) => sum + p.lengthMm * (inventory[p.id] ?? 0), 0) / 1000;

  if (ready && owned.length === 0 && trains.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader title={t("collection.title")} intro={t("collection.intro")} />
        <div className={`${card} flex flex-col items-start gap-5 p-8`}>
          <p className="max-w-lg text-lg">{t("collection.empty")}</p>
          <Link href="/box" className={buttonPrimary}>
            {t("circuits.fillBox")}
          </Link>
        </div>
      </div>
    );
  }

  const stats = [
    { label: t("collection.sets"), value: Object.values(sets).reduce((s, n) => s + n, 0) },
    { label: t("collection.tracks"), value: qty(tracks.map((p) => p.id)) },
    { label: t("collection.length"), value: t("collection.meters", { value: meters.toFixed(1) }) },
    { label: t("collection.switches"), value: qty(ofCategory("switch")) },
    { label: t("collection.bridges"), value: qty(ofCategory("bridge", "ramp")) },
    { label: t("collection.buildings"), value: qty(ofCategory("building")) },
    { label: t("collection.vehicles"), value: trains.reduce((s, set) => s + (sets[set.id] ?? 0), 0) },
  ];

  return (
    <div className="space-y-12">
      <PageHeader title={t("collection.title")} intro={t("collection.intro")}>
        <Link href="/box" className={buttonSecondary}>
          <Icon d={icons.box} className="size-5" />
          {t("collection.edit")}
        </Link>
      </PageHeader>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {stats.map((s, i) => (
          <li
            key={s.label}
            className={`${i === 0 ? "bg-accent text-accent-ink" : "bg-soft text-ink"} flex flex-col gap-1 rounded-2xl p-4`}
          >
            <span className="font-mono text-3xl font-extrabold">{ready ? s.value : "–"}</span>
            <span className="text-sm font-bold opacity-80">{s.label}</span>
          </li>
        ))}
      </ul>

      {ownedSets.length > 0 && (
        <section className="space-y-5">
          <SectionTitle>{t("collection.mySets")}</SectionTitle>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {ownedSets.map((set) => (
              <li key={set.id} className={`${blob} flex flex-col border border-border bg-surface`}>
                <SetArt set={set} />
                <div className="p-3">
                  <p className="text-sm font-extrabold leading-tight text-ink">{t(`setNames.${set.id}`)}</p>
                  <p className="text-xs text-muted">
                    {set.ref && t("box.ref", { ref: set.ref })}
                    {(sets[set.id] ?? 0) > 1 && ` · ×${sets[set.id]}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ORDER.map((category) => {
        const pieces = owned.filter((p) => p.category === category);
        if (pieces.length === 0) return null;
        return (
          <section key={category} className="space-y-4">
            <h2 className="flex items-baseline gap-3 text-2xl font-extrabold text-ink">
              {t(`categories.${category}`)}
              <span className="font-mono text-lg text-muted">{qty(pieces.map((p) => p.id))}</span>
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {pieces.map((piece) => (
                <li key={piece.id} className={`${card} flex flex-col gap-2 p-3`}>
                  <span className="wood-floor rounded-xl p-2">
                    <PieceThumb id={piece.id} className="h-16 w-full" />
                  </span>
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-bold leading-tight">{t(`pieceNames.${piece.id}`)}</span>
                    <span className="font-mono text-xl font-extrabold text-ink">×{inventory[piece.id]}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {trains.length > 0 && (
        <section className="space-y-4">
          <h2 className="flex items-baseline gap-3 text-2xl font-extrabold text-ink">
            {t("categories.vehicle")}
            <span className="font-mono text-lg text-muted">{trains.length}</span>
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {trains.map((set) => (
              <li key={set.id} className={`${card} flex flex-col overflow-hidden`}>
                <SetArt set={set} />
                <span className="flex items-start justify-between gap-2 p-3">
                  <span className="text-sm font-bold leading-tight">{t(`setNames.${set.id}`)}</span>
                  {(sets[set.id] ?? 0) > 1 && <span className="font-mono font-extrabold">×{sets[set.id]}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link href="/circuits" className={`${buttonPrimary} text-lg`}>
        {t("collection.create")}
        <Icon d={icons.right} className="size-5" />
      </Link>
    </div>
  );
}
