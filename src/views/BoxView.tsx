"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { TrackPlan } from "@/components/TrackPlan";
import { buttonPrimary, buttonSecondary, card, Icon, icons, PageHeader } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { catalog, pieceList, setList } from "@/lib/catalog";
import { layouts } from "@/lib/layouts";
import { actions, useAppState } from "@/lib/store";
import { addSet, matchInventory, totalPieces, type PieceCategory } from "@/lib/track-engine";

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function BoxView() {
  const t = useTranslations();
  const { inventory, history, ready } = useAppState();
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const total = totalPieces(inventory);
  const buildable = useMemo(() => matchInventory(inventory, layouts).buildable.length, [inventory]);
  const categories = [...new Set(pieceList.map((p) => p.category))] as PieceCategory[];
  const q = normalize(query.trim());
  const visible = pieceList.filter(
    (p) => !q || normalize(t(`pieceNames.${p.id}`)).includes(q) || (p.ref ?? "").includes(q),
  );

  const onAddSet = (id: string) => {
    actions.addSet(id);
    setToast(t("box.added", { name: t(`setNames.${id}`) }));
    window.setTimeout(() => setToast(null), 2500);
  };

  return (
    <div className="space-y-10 pb-28">
      <PageHeader title={t("box.title")} intro={t("box.intro")}>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonSecondary}
            onClick={actions.undo}
            disabled={!ready || history.length === 0}
          >
            <Icon d={icons.undo} className="size-5" />
            <span className="sr-only sm:not-sr-only">{t("box.undo")}</span>
          </button>
          <button
            type="button"
            className={buttonSecondary}
            disabled={!ready || total === 0}
            onClick={() => window.confirm(t("box.clearConfirm")) && actions.clearInventory()}
          >
            <Icon d={icons.trash} className="size-5" />
            <span className="sr-only sm:not-sr-only">{t("box.clear")}</span>
          </button>
        </div>
      </PageHeader>

      {/* Ajout par coffret (EF-12) */}
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-bold">{t("box.addSet")}</h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {setList.map((set) => (
            <li key={set.id} className={`${card} flex flex-col gap-3 p-5`}>
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-wood text-header">
                  <Icon d={icons.box} />
                </span>
                <div>
                  <h3 className="font-semibold">{t(`setNames.${set.id}`)}</h3>
                  <p className="text-sm text-muted">{t("common.pieces", { count: totalPieces(addSet({}, set)) })}</p>
                </div>
              </div>
              <button
                type="button"
                className={`${buttonPrimary} mt-auto`}
                onClick={() => onAddSet(set.id)}
                disabled={!ready}
              >
                <Icon d={icons.plus} className="size-5" />
                {t("box.addSetButton")}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Inventaire pièce par pièce (EF-10, EF-11, EF-13) */}
      <section className="space-y-6">
        <label className="relative block max-w-xl">
          <span className="sr-only">{t("box.search")}</span>
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
            <Icon d={icons.search} className="size-5" />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("box.search")}
            className="min-h-12 w-full rounded-full border-2 border-border bg-surface pl-12 pr-4 outline-none focus:border-header"
          />
        </label>

        {visible.length === 0 && <p className="text-muted">{t("box.noResult")}</p>}

        {categories.map((category) => {
          const pieces = visible.filter((p) => p.category === category);
          if (pieces.length === 0) return null;
          return (
            <div key={category} className="space-y-3">
              <h2 className="font-display text-xl font-bold">{t(`categories.${category}`)}</h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {pieces.map((piece) => {
                  const name = t(`pieceNames.${piece.id}`);
                  const qty = inventory[piece.id] ?? 0;
                  return (
                    <li
                      key={piece.id}
                      className={`${card} flex items-center gap-3 p-3 ${qty > 0 ? "border-wood-dark" : ""}`}
                    >
                      <div className="wood-floor w-20 shrink-0 rounded-2xl p-1.5">
                        <TrackPlan
                          placements={[
                            { id: piece.id, pieceTypeId: piece.id, x: 0, y: 0, rotation: 0, flipped: false },
                          ]}
                          catalog={catalog}
                          title=""
                          frame={{ width: 280, height: 200 }}
                          showConnectors={false}
                          className="w-full"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-tight">{name}</p>
                        {piece.ref && <p className="font-mono text-xs text-muted">{piece.ref}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={t("box.less", { name })}
                          onClick={() => actions.setQuantity(piece.id, qty - 1)}
                          disabled={!ready || qty === 0}
                          className="flex size-11 items-center justify-center rounded-full bg-background text-foreground disabled:opacity-30"
                        >
                          <Icon d={icons.minus} className="size-5" />
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={999}
                          aria-label={t("box.quantity", { name })}
                          value={ready ? qty : 0}
                          onChange={(e) => actions.setQuantity(piece.id, Number(e.target.value))}
                          className="h-11 w-14 rounded-xl border-2 border-border bg-surface text-center font-mono text-lg font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          aria-label={t("box.more", { name })}
                          onClick={() => actions.setQuantity(piece.id, qty + 1)}
                          disabled={!ready}
                          className="flex size-11 items-center justify-center rounded-full bg-header text-header-ink"
                        >
                          <Icon d={icons.plus} className="size-5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      {/* Barre récapitulative */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div aria-live="polite">
            <p className="font-display text-lg font-bold">{t("box.total", { count: ready ? total : 0 })}</p>
            <p className="text-sm text-muted">{t("box.buildableCount", { count: ready ? buildable : 0 })}</p>
          </div>
          <Link href="/circuits" className={buttonPrimary}>
            {t("box.seeCircuits")}
            <Icon d={icons.right} className="size-5" />
          </Link>
        </div>
      </div>

      {toast && (
        <p
          role="status"
          className="fixed left-1/2 top-24 z-30 -translate-x-1/2 rounded-full bg-green px-5 py-3 font-semibold text-green-ink shadow-lg"
        >
          {toast}
        </p>
      )}
    </div>
  );
}
