import { useLocale, useTranslations } from "next-intl";
import { circuitFromCode } from "@/lib/circuits";
import { officialImage, officialPage } from "@/lib/official";
import { catalog } from "@/lib/catalog";
import type { TrackSet } from "@/lib/track-engine";
import { OfficialImage } from "./OfficialImage";
import { PieceThumb } from "./PieceThumb";
import { TrackPlan } from "./TrackPlan";

/** Couleur de l'illustration selon l'univers du coffret. */
export const THEME_COLORS: Record<string, string> = {
  travel: "var(--green)",
  fire: "var(--accent)",
  city: "var(--ink)",
  cargo: "#e0a020",
  classic: "var(--green)",
  track: "var(--wood-dark)",
  animals: "#6a9a2a",
  smart: "#1f6fb8",
  dino: "#6a9a2a",
  space: "#1b2a4a",
};

/**
 * Image d'un coffret : l'image officielle
 * (avec crédit et lien), sinon une illustration originale : le plus beau circuit réalisable avec ce seul coffret.
 */
export function SetArt({ set, previewCode }: { set: TrackSet; previewCode?: string | null }) {
  return (
    <OfficialImage
      src={officialImage(set.ref)}
      className="aspect-[4/3] w-full bg-white object-contain p-2"
      fallback={<SetDrawing set={set} previewCode={previewCode} />}
    />
  );
}

/** Crédit et lien vers la page officielle du produit (hors mode enfant, EF-51). */
export function OfficialLink({ productRef }: { productRef: string | null }) {
  const t = useTranslations("official");
  const locale = useLocale();
  const href = officialPage(productRef, locale);
  if (!href) return null;
  return (
    <p className="text-xs text-muted">
      {officialImage(productRef) && <span className="block">{t("credit")}</span>}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="font-bold text-ink underline underline-offset-2"
      >
        {t("page")}
      </a>
    </p>
  );
}

function SetDrawing({ set, previewCode }: { set: TrackSet; previewCode?: string | null }) {
  const preview = previewCode ? circuitFromCode(previewCode) : null;
  return (
    <div className="wood-floor relative aspect-[4/3] w-full" aria-hidden="true">
      <span
        className="absolute inset-x-0 top-0 h-2"
        style={{ background: THEME_COLORS[set.theme] ?? "var(--accent)" }}
      />
      {preview ? (
        <TrackPlan
          placements={preview.placements}
          catalog={catalog}
          title=""
          accessories={preview.accessories}
          showConnectors={false}
          className="h-full w-full p-3"
        />
      ) : (
        <div className="grid h-full grid-cols-3 place-items-center gap-1 p-4">
          {set.contents.slice(0, 6).map((c) => (
            <PieceThumb key={c.pieceTypeId} id={c.pieceTypeId} className="w-full" />
          ))}
        </div>
      )}
    </div>
  );
}
