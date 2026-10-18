"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { PieceThumb } from "@/components/PieceThumb";
import { OfficialLink, SetArt } from "@/components/SetArt";
import { blob, buttonPrimary, buttonSecondary, card, Icon, icons, PageHeader, SectionTitle } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { pieceList, setList } from "@/lib/catalog";
import { actions, useAppState } from "@/lib/store";
import { totalPieces, type PieceCategory, type TrackSet } from "@/lib/track-engine";

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Kind = "all" | TrackSet["kind"];

/** Réduit une photo à 480 px de large (JPEG) pour la garder sur l'appareil sans l'alourdir. */
async function shrinkPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 480 / img.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.75);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Stepper({
  value,
  onChange,
  label,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
  disabled?: boolean;
}) {
  const t = useTranslations("box");
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={t("less", { name: label })}
        onClick={() => onChange(value - 1)}
        disabled={disabled || value === 0}
        className="flex size-11 items-center justify-center rounded-full bg-soft text-ink disabled:opacity-30"
      >
        <Icon d={icons.minus} className="size-5" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={999}
        aria-label={t("quantity", { name: label })}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="h-11 w-14 rounded-xl border border-border bg-surface text-center font-mono text-lg font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        aria-label={t("more", { name: label })}
        onClick={() => onChange(value + 1)}
        disabled={disabled}
        className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-ink"
      >
        <Icon d={icons.plus} className="size-5" />
      </button>
    </div>
  );
}

function SetContents({ set }: { set: TrackSet }) {
  const t = useTranslations();
  return (
    <ul className="space-y-1 text-sm">
      {set.contents.map((c) => (
        <li key={c.pieceTypeId} className="flex items-center gap-2">
          <span className="w-10 shrink-0">
            <PieceThumb id={c.pieceTypeId} />
          </span>
          <span className="flex-1">{t(`pieceNames.${c.pieceTypeId}`)}</span>
          <span className="font-mono font-bold">× {c.quantity}</span>
        </li>
      ))}
    </ul>
  );
}

export function BoxView({ previews }: { previews: Record<string, string | null> }) {
  const t = useTranslations();
  const { inventory, sets, adjustments, photos, history, ready } = useAppState();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [photoFor, setPhotoFor] = useState<string | null>(null);

  const owned = setList.filter((s) => (sets[s.id] ?? 0) > 0);
  const q = normalize(query.trim());
  const catalogue = setList.filter(
    (s) =>
      (kind === "all" || s.kind === kind) &&
      (!q || normalize(t(`setNames.${s.id}`)).includes(q) || (s.ref ?? "").includes(q)),
  );
  const tracks = Object.entries(inventory)
    .filter(([id]) => pieceList.find((p) => p.id === id)?.category !== "accessory")
    .reduce((s, [, n]) => s + n, 0);

  const onAdd = (id: string) => {
    actions.addSet(id);
    setToast(t("box.added", { name: t(`setNames.${id}`) }));
    window.setTimeout(() => setToast(null), 2500);
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file || !photoFor) return;
    actions.setPhoto(photoFor, await shrinkPhoto(file));
    setPhotoFor(null);
  };

  const categories = [...new Set(pieceList.map((p) => p.category))] as PieceCategory[];

  return (
    <div className="space-y-14 pb-32">
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
            disabled={!ready || totalPieces(inventory) === 0}
            onClick={() => window.confirm(t("box.clearConfirm")) && actions.clearInventory()}
          >
            <Icon d={icons.trash} className="size-5" />
            <span className="sr-only sm:not-sr-only">{t("box.clear")}</span>
          </button>
        </div>
      </PageHeader>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void onPhoto(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {/* Mes coffrets */}
      {ready && owned.length > 0 && (
        <section className="space-y-5">
          <SectionTitle>{t("box.mine")}</SectionTitle>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {owned.map((set) => {
              const name = t(`setNames.${set.id}`);
              return (
                <li key={set.id} className={`${blob} flex flex-col border border-border bg-surface`}>
                  <SetArt set={set} previewCode={previews[set.id]} photo={photos[set.id]} />
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <div>
                      <h3 className="text-lg font-extrabold leading-tight text-ink">{name}</h3>
                      <p className="font-mono text-sm text-muted">
                        {set.ref ? t("box.ref", { ref: set.ref }) : t("box.noRef")}
                      </p>
                      {!photos[set.id] && <OfficialLink productRef={set.ref} />}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Stepper
                        value={sets[set.id] ?? 0}
                        onChange={(n) => actions.setSetCount(set.id, n)}
                        label={name}
                      />
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-bold text-ink hover:bg-soft"
                        onClick={() => {
                          if (photos[set.id]) actions.setPhoto(set.id, null);
                          else {
                            setPhotoFor(set.id);
                            fileInput.current?.click();
                          }
                        }}
                      >
                        <Icon d={icons.camera} className="size-5" />
                        {photos[set.id] ? t("box.removePhoto") : t("box.addPhoto")}
                      </button>
                    </div>
                    <button
                      type="button"
                      aria-expanded={open === set.id}
                      onClick={() => setOpen(open === set.id ? null : set.id)}
                      className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-bold text-accent"
                    >
                      {t("box.contents")}
                      <Icon d={open === set.id ? icons.up : icons.down} className="size-4" />
                    </button>
                    {open === set.id && (
                      <div className="space-y-2">
                        <SetContents set={set} />
                        {!set.verified && <p className="text-xs text-muted">{t("box.indicative")}</p>}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Catalogue des coffrets */}
      <section className="space-y-6">
        <div className="space-y-2">
          <SectionTitle>{t("box.addSet")}</SectionTitle>
          <p className="max-w-2xl text-muted">{t("box.addSetIntro")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative block min-w-0 flex-1 basis-72">
            <span className="sr-only">{t("box.search")}</span>
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
              <Icon d={icons.search} className="size-5" />
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("box.search")}
              className="min-h-12 w-full rounded-full border-2 border-accent bg-surface pl-12 pr-4 outline-none"
            />
          </label>
          <div role="group" aria-label={t("box.kind")} className="flex flex-wrap gap-1">
            {(["all", "set", "expansion", "pack"] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className="min-h-11 rounded-full border border-border px-4 text-sm font-bold text-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-background"
              >
                {t(`box.kinds.${k}`)}
              </button>
            ))}
          </div>
        </div>
        {catalogue.length === 0 && <p className="text-muted">{t("box.noResult")}</p>}
        <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {catalogue.map((set) => {
            const name = t(`setNames.${set.id}`);
            const count = sets[set.id] ?? 0;
            return (
              <li key={set.id} className={`${blob} flex flex-col border border-border bg-surface`}>
                <SetArt set={set} previewCode={previews[set.id]} />
                <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
                  <h3 className="font-extrabold leading-tight text-ink">{name}</h3>
                  <p className="text-sm text-muted">
                    {set.ref ? `${t("box.ref", { ref: set.ref })} · ` : ""}
                    {t("common.pieces", { count: set.pieceCount })}
                  </p>
                  <OfficialLink productRef={set.ref} />
                  <button
                    type="button"
                    className={`${buttonPrimary} mt-auto w-full px-3 text-sm sm:text-base`}
                    onClick={() => onAdd(set.id)}
                    disabled={!ready}
                  >
                    <Icon d={icons.plus} className="size-5" />
                    {ready && count > 0 ? t("box.addAnother", { count }) : t("box.addSetButton")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Détail et corrections pièce par pièce */}
      <details className={`${card} group p-5`}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3">
          <span>
            <span className="block text-xl font-extrabold text-ink">{t("box.detail")}</span>
            <span className="text-sm text-muted">{t("box.detailIntro")}</span>
          </span>
          <Icon d={icons.down} className="size-6 transition group-open:rotate-180" />
        </summary>
        <div className="mt-6 space-y-6">
          {categories.map((category) => (
            <div key={category} className="space-y-3">
              <h3 className="font-extrabold text-ink">{t(`categories.${category}`)}</h3>
              <ul className="grid gap-3 md:grid-cols-2">
                {pieceList
                  .filter((p) => p.category === category)
                  .map((piece) => {
                    const name = t(`pieceNames.${piece.id}`);
                    const qty = ready ? (inventory[piece.id] ?? 0) : 0;
                    const corrected = (adjustments[piece.id] ?? 0) !== 0;
                    return (
                      <li key={piece.id} className="flex items-center gap-3 rounded-xl border border-border p-2">
                        <span className="wood-floor w-16 shrink-0 rounded-lg p-1">
                          <PieceThumb id={piece.id} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-bold leading-tight">{name}</span>
                          {corrected && <span className="text-xs text-warn">{t("box.corrected")}</span>}
                        </span>
                        <Stepper
                          value={qty}
                          onChange={(n) => actions.setQuantity(piece.id, n)}
                          label={name}
                          disabled={!ready}
                        />
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>
      </details>

      {/* Barre récapitulative */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p aria-live="polite" className="font-extrabold text-ink">
            {t("box.summary", {
              sets: ready ? owned.reduce((s, x) => s + (sets[x.id] ?? 0), 0) : 0,
              tracks: ready ? tracks : 0,
            })}
          </p>
          <Link href="/circuits" className={buttonPrimary}>
            {t("box.seeCircuits")}
            <Icon d={icons.right} className="size-5" />
          </Link>
        </div>
      </div>

      {toast && (
        <p
          role="status"
          className="fixed left-1/2 top-24 z-40 -translate-x-1/2 rounded-full bg-green px-5 py-3 font-bold text-green-ink shadow-lg"
        >
          {toast}
        </p>
      )}
    </div>
  );
}
