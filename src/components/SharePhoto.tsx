"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { buttonPrimary, card, Icon, icons } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { communityEnabled, deletePhoto, myPhotos, sharePhoto, type CommunityPhoto } from "@/lib/community";

/**
 * Côté parent : publier la photo du circuit construit. Elle n'apparaît dans « Circuits des internautes »
 * qu'après validation, et seulement si le parent confirme qu'on ne voit ni visage, ni prénom, ni adresse.
 */
export function SharePhoto({ code }: { code: string }) {
  const t = useTranslations("community");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [safe, setSafe] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [mine, setMine] = useState<CommunityPhoto[]>([]);

  useEffect(() => {
    if (!communityEnabled) return;
    myPhotos(code)
      .then(setMine)
      .catch(() => setMine([]));
  }, [code, state]);

  const choose = (next: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : null);
    setState("idle");
  };

  if (!communityEnabled) {
    return (
      <section className={`${card} space-y-2 p-5 print:hidden`}>
        <h2 className="text-xl font-extrabold text-ink">{t("shareTitle")}</h2>
        <p className="text-muted">{t("soon")}</p>
      </section>
    );
  }

  const send = async () => {
    if (!file || !safe) return;
    setState("sending");
    try {
      await sharePhoto(code, file);
      choose(null);
      setSafe(false);
      setState("sent");
    } catch {
      setState("error");
    }
  };

  return (
    <section className={`${card} space-y-4 p-5 print:hidden`}>
      <div className="space-y-1">
        <h2 className="text-xl font-extrabold text-ink">{t("shareTitle")}</h2>
        <p className="text-muted">{t("shareIntro")}</p>
      </div>
      <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-dashed border-border px-4 font-bold text-ink hover:border-accent">
        <Icon d={icons.camera} className="size-5" />
        {file ? t("change") : t("choose")}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => choose(e.target.files?.[0] ?? null)}
        />
      </label>
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt={t("previewAlt")} className="max-h-72 w-full rounded-xl object-contain" />
      )}
      {file && (
        <>
          <label className="flex items-start gap-3 font-semibold text-ink">
            <input
              type="checkbox"
              checked={safe}
              onChange={(e) => setSafe(e.target.checked)}
              className="mt-1 size-5 accent-[var(--accent)]"
            />
            {t("safe")}
          </label>
          <button
            type="button"
            className={`${buttonPrimary} w-full`}
            disabled={!safe || state === "sending"}
            onClick={send}
          >
            {state === "sending" ? t("sending") : t("publish")}
          </button>
        </>
      )}
      {state === "sent" && (
        <p className="rounded-xl bg-green/10 p-3 font-bold text-green" role="status">
          {t("sent")}
        </p>
      )}
      {state === "error" && (
        <p className="rounded-xl bg-accent/10 p-3 font-bold text-accent" role="alert">
          {t("error")}
        </p>
      )}
      {mine.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-extrabold text-ink">{t("mine")}</h3>
          <ul className="grid grid-cols-3 gap-2">
            {mine.map((p) => (
              <li key={p.id} className="space-y-1 text-center text-xs">
                {p.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                )}
                <span className="block font-bold text-muted">{t(`status.${p.status}`)}</span>
                <button
                  type="button"
                  className="font-bold text-accent underline"
                  onClick={() => deletePhoto(p).then(() => setMine((list) => list.filter((x) => x.id !== p.id)))}
                >
                  {t("remove")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Link href="/community" className="inline-block font-bold text-accent underline">
        {t("seeAll")}
      </Link>
    </section>
  );
}
