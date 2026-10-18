"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { OfficialImage } from "@/components/OfficialImage";
import { PieceThumb } from "@/components/PieceThumb";
import { SetArt } from "@/components/SetArt";
import { buttonPrimary, buttonSecondary, card, Icon, icons, PageHeader } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { pieceList, setList } from "@/lib/catalog";
import { officialImage, officialPage } from "@/lib/official";
import { useAppState } from "@/lib/store";
import type { PieceCategory, PieceType, TrackSet } from "@/lib/track-engine";

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
];

/** Groupes de produits, puis les pièces elles-mêmes. */
const GROUPS = ["sets", "extensions", "buildings", "trains", "pieces"] as const;
type Group = (typeof GROUPS)[number];
const GROUP_OF: Record<TrackSet["kind"], Group> = {
  set: "sets",
  expansion: "extensions",
  pack: "extensions",
  building: "buildings",
  vehicle: "trains",
};

const NOT_TRACK = new Set<PieceCategory>(["building", "accessory", "vehicle"]);
const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Lien vers la page officielle du produit (nouvel onglet), sinon simple bloc. */
function ProductLink({
  productRef,
  children,
  className,
}: {
  productRef: string | null;
  children: React.ReactNode;
  className: string;
}) {
  const locale = useLocale();
  const href = officialPage(productRef, locale);
  if (!href) return <div className={className}>{children}</div>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={`${className} transition hover:border-accent`}
    >
      {children}
    </a>
  );
}

/** Ma collection : tout ce que la famille possède, coffrets, trains et pièces réunis. */
export function CollectionView() {
  const t = useTranslations();
  const { inventory, sets, ready } = useAppState();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [group, setGroup] = useState<Group | "all">("all");
  const [query, setQuery] = useState("");

  const q = normalize(query.trim());
  const matches = (name: string, ref: string | null) => !q || normalize(name).includes(q) || (ref ?? "").includes(q);
  const ownedProducts = setList.filter((s) => (sets[s.id] ?? 0) > 0);
  const ownedPieces = pieceList.filter((p) => (inventory[p.id] ?? 0) > 0);
  const qty = (list: PieceType[]) => list.reduce((sum, p) => sum + (inventory[p.id] ?? 0), 0);
  const tracks = ownedPieces.filter((p) => !NOT_TRACK.has(p.category));
  const meters = tracks.reduce((sum, p) => sum + p.lengthMm * (inventory[p.id] ?? 0), 0) / 1000;
  const count = (g: Group) =>
    g === "pieces" ? ownedPieces.length : ownedProducts.filter((s) => GROUP_OF[s.kind] === g).length;

  if (ready && ownedPieces.length === 0 && ownedProducts.length === 0) {
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
    { label: t("collection.sets"), value: ownedProducts.filter((s) => s.kind !== "vehicle").length },
    { label: t("collection.tracks"), value: qty(tracks) },
    { label: t("collection.length"), value: t("collection.meters", { value: meters.toFixed(1) }) },
    { label: t("collection.switches"), value: qty(ownedPieces.filter((p) => p.category === "switch")) },
    {
      label: t("collection.bridges"),
      value: qty(ownedPieces.filter((p) => p.category === "bridge" || p.category === "ramp")),
    },
    { label: t("collection.buildings"), value: qty(ownedPieces.filter((p) => p.category === "building")) },
    { label: t("collection.vehicles"), value: ownedProducts.filter((s) => s.kind === "vehicle").length },
  ];

  const productSection = (g: Exclude<Group, "pieces">) => {
    const items = ownedProducts.filter((s) => GROUP_OF[s.kind] === g && matches(t(`setNames.${s.id}`), s.ref));
    if (items.length === 0) return null;
    return (
      <section key={g} className="space-y-4">
        <h2 className="flex items-baseline gap-3 text-2xl font-extrabold text-ink">
          {t(`collection.groups.${g}`)}
          <span className="font-mono text-lg text-muted">{items.length}</span>
        </h2>
        {view === "grid" ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {items.map((set) => (
              <li key={set.id}>
                <ProductLink productRef={set.ref} className={`${card} flex h-full flex-col overflow-hidden`}>
                  <SetArt set={set} />
                  <span className="flex flex-1 flex-col gap-1 p-3">
                    <span className="text-sm font-extrabold leading-tight text-ink">{t(`setNames.${set.id}`)}</span>
                    <span className="text-xs text-muted">
                      {set.ref && `${t("box.ref", { ref: set.ref })} · `}
                      {t("common.pieces", { count: set.pieceCount })}
                      {(sets[set.id] ?? 0) > 1 && ` · ×${sets[set.id]}`}
                    </span>
                  </span>
                </ProductLink>
              </li>
            ))}
          </ul>
        ) : (
          <ul className={`${card} divide-y divide-border overflow-hidden`}>
            {items.map((set) => (
              <li key={set.id}>
                <ProductLink productRef={set.ref} className="flex items-center gap-3 p-2 pr-4">
                  <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
                    <OfficialImage
                      src={officialImage(set.ref)}
                      className="size-14 object-contain"
                      fallback={<Icon d={icons.box} className="size-7 text-muted" />}
                    />
                  </span>
                  <span className="w-16 shrink-0 font-mono text-sm text-muted">{set.ref ?? "–"}</span>
                  <span className="min-w-0 flex-1 font-bold leading-tight text-ink">{t(`setNames.${set.id}`)}</span>
                  <span className="hidden shrink-0 text-sm text-muted sm:block">
                    {t("common.pieces", { count: set.pieceCount })}
                  </span>
                  <span className="w-10 shrink-0 text-right font-mono font-extrabold text-ink">×{sets[set.id]}</span>
                </ProductLink>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  };

  const pieceSection = (category: PieceCategory) => {
    const items = ownedPieces.filter((p) => p.category === category && matches(t(`pieceNames.${p.id}`), p.ref));
    if (items.length === 0) return null;
    return (
      <section key={category} className="space-y-3">
        <h3 className="flex items-baseline gap-3 text-xl font-extrabold text-ink">
          {t(`categories.${category}`)}
          <span className="font-mono text-base text-muted">{qty(items)}</span>
        </h3>
        {view === "grid" ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {items.map((piece) => (
              <li key={piece.id}>
                <ProductLink productRef={piece.ref} className={`${card} flex h-full flex-col gap-2 p-3`}>
                  <span className="wood-floor rounded-xl p-2">
                    <PieceThumb id={piece.id} className="h-16 w-full" />
                  </span>
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-bold leading-tight">{t(`pieceNames.${piece.id}`)}</span>
                    <span className="font-mono text-xl font-extrabold text-ink">×{inventory[piece.id]}</span>
                  </span>
                </ProductLink>
              </li>
            ))}
          </ul>
        ) : (
          <ul className={`${card} divide-y divide-border overflow-hidden`}>
            {items.map((piece) => (
              <li key={piece.id}>
                <ProductLink productRef={piece.ref} className="flex items-center gap-3 p-2 pr-4">
                  <span className="wood-floor flex size-14 shrink-0 items-center rounded-lg p-1">
                    <PieceThumb id={piece.id} className="w-full" />
                  </span>
                  <span className="w-16 shrink-0 font-mono text-sm text-muted">{piece.ref ?? "–"}</span>
                  <span className="min-w-0 flex-1 font-bold leading-tight text-ink">{t(`pieceNames.${piece.id}`)}</span>
                  {piece.lengthMm > 0 && (
                    <span className="hidden shrink-0 text-sm text-muted sm:block">
                      {t("pieces.length", { length: Math.round(piece.lengthMm) })}
                    </span>
                  )}
                  <span className="w-10 shrink-0 text-right font-mono font-extrabold text-ink">
                    ×{inventory[piece.id]}
                  </span>
                </ProductLink>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  };

  const pieceSections = ORDER.map(pieceSection).filter(Boolean);

  return (
    <div className="space-y-10">
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

      {/* Filtres et affichage */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block min-w-0 flex-1 basis-64">
          <span className="sr-only">{t("collection.search")}</span>
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
            <Icon d={icons.search} className="size-5" />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("collection.search")}
            className="min-h-12 w-full rounded-full border-2 border-border bg-surface pl-12 pr-4 outline-none focus:border-accent"
          />
        </label>
        <div role="group" aria-label={t("collection.view")} className="inline-flex rounded-full bg-soft p-1">
          {(["grid", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className="min-h-10 rounded-full px-4 text-sm font-bold text-muted aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow"
            >
              {t(`collection.views.${v}`)}
            </button>
          ))}
        </div>
      </div>
      <div role="group" aria-label={t("collection.filter")} className="-mt-6 flex flex-wrap gap-1">
        {(["all", ...GROUPS] as const).map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={group === g}
            onClick={() => setGroup(g)}
            className="min-h-11 rounded-full border border-border px-4 text-sm font-bold text-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-background"
          >
            {g === "all" ? t("box.kinds.all") : t(`collection.groups.${g}`)}
            {g !== "all" && ready && <span className="ml-1 opacity-60">{count(g)}</span>}
          </button>
        ))}
      </div>

      {(["sets", "extensions", "buildings", "trains"] as const)
        .filter((g) => group === "all" || group === g)
        .map(productSection)}

      {(group === "all" || group === "pieces") && pieceSections.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-2xl font-extrabold text-ink">{t("collection.groups.pieces")}</h2>
          {pieceSections}
        </section>
      )}

      <p className="text-xs text-muted">{t("collection.officialHint")}</p>

      <Link href="/circuits" className={`${buttonPrimary} text-lg`}>
        {t("collection.create")}
        <Icon d={icons.right} className="size-5" />
      </Link>
    </div>
  );
}
