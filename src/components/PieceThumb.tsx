import { catalog } from "@/lib/catalog";
import type { AccessoryKind } from "@/lib/track-engine";
import { AccessoryShape, TrackPlan } from "./TrackPlan";

const ACCESSORY_KINDS = new Set<string>(["tunnel", "station", "signal", "crane", "tree"]);

/** Vignette d'une pièce : son tracé (même échelle pour toutes) ou le dessin de l'accessoire. */
export function PieceThumb({ id, className = "w-full" }: { id: string; className?: string }) {
  const piece = catalog[id];
  if (piece?.category === "accessory") {
    return (
      <svg viewBox="-110 -80 220 160" className={className} aria-hidden="true">
        {ACCESSORY_KINDS.has(id) ? (
          <AccessoryShape kind={id as AccessoryKind} />
        ) : id === "turntable" ? (
          // Plaque tournante
          <g>
            <circle r={70} fill="var(--wood)" stroke="var(--wood-dark)" strokeWidth={4} />
            <rect x={-70} y={-12} width={140} height={24} rx={4} fill="var(--wood-dark)" />
            <circle r={10} fill="var(--ink)" />
          </g>
        ) : (
          // Pilier
          <g>
            <rect x={-30} y={-30} width={60} height={60} rx={10} fill="var(--ink)" />
            <rect x={-20} y={-20} width={40} height={40} rx={6} fill="none" stroke="var(--wood)" strokeWidth={4} />
          </g>
        )}
      </svg>
    );
  }
  return (
    <TrackPlan
      placements={[{ id, pieceTypeId: id, x: 0, y: 0, rotation: 0, flipped: false }]}
      catalog={catalog}
      title=""
      frame={{ width: 300, height: 220 }}
      showConnectors={false}
      className={className}
    />
  );
}
