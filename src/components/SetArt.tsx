import { circuitFromCode } from "@/lib/circuits";
import { catalog } from "@/lib/catalog";
import type { TrackSet } from "@/lib/track-engine";
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
};

/**
 * Illustration originale d'un coffret : le plus beau circuit réalisable avec ce seul coffret
 * (ou ses pièces, pour un sachet). Remplacée par la photo de la boîte si l'utilisateur en a pris une.
 */
export function SetArt({ set, previewCode, photo }: { set: TrackSet; previewCode?: string | null; photo?: string }) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" className="aspect-[4/3] w-full object-cover" />;
  }
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
