import { getPiece, transform, transformTracks, type Catalog, type Placement } from "@/lib/track-engine";

const MARGIN = 30;

/** Plan vu de dessus : chaque pièce est dessinée d'après son tracé, placée selon x, y, rotation. */
export function TrackPlan({
  placements,
  catalog,
  title,
  className,
  frame,
}: {
  placements: Placement[];
  catalog: Catalog;
  title: string;
  className?: string;
  /** Cadre fixe en mm : dessine plusieurs plans à la même échelle. */
  frame?: { width: number; height: number };
}) {
  const pieces = placements.map((p) => {
    const piece = getPiece(catalog, p.pieceTypeId);
    return { id: p.id, tracks: transformTracks(p, piece), connectors: transform(p, piece) };
  });
  const xs = pieces.flatMap((p) => p.tracks.flat().map((pt) => pt[0]));
  const ys = pieces.flatMap((p) => p.tracks.flat().map((pt) => pt[1]));
  let minX = Math.min(...xs) - MARGIN;
  let maxX = Math.max(...xs) + MARGIN;
  let minY = Math.min(...ys) - MARGIN;
  let maxY = Math.max(...ys) + MARGIN;
  if (frame) {
    const padX = Math.max(0, frame.width - (maxX - minX)) / 2;
    const padY = Math.max(0, frame.height - (maxY - minY)) / 2;
    minX -= padX;
    maxX += padX;
    minY -= padY;
    maxY += padY;
  }
  // SVG a l'axe y vers le bas : on retourne le plan pour garder y vers le haut.
  const toPoints = (track: [number, number, number][]) =>
    track.map(([x, y]) => `${(x - minX).toFixed(1)},${(maxY - y).toFixed(1)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${maxX - minX} ${maxY - minY}`}
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>
      {pieces.map((p) =>
        p.tracks.map((track, i) => (
          <g key={`${p.id}-${i}`} fill="none">
            <polyline points={toPoints(track)} stroke="var(--wood-dark)" strokeWidth={40} />
            <polyline points={toPoints(track)} stroke="var(--wood)" strokeWidth={34} />
            <polyline points={toPoints(track)} stroke="var(--wood-dark)" strokeWidth={2} strokeDasharray="10 8" />
          </g>
        )),
      )}
      {pieces.flatMap((p) =>
        p.connectors.map((c) => (
          <circle
            key={`${p.id}-c${c.index}`}
            cx={c.x - minX}
            cy={maxY - c.y}
            r={c.gender === "male" ? 5 : 7}
            fill={c.gender === "male" ? "var(--wood-dark)" : "var(--background)"}
            stroke="var(--wood-dark)"
            strokeWidth={2}
          />
        )),
      )}
    </svg>
  );
}
