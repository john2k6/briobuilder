import {
  getPiece,
  transform,
  transformTracks,
  type Catalog,
  type Placement,
  type TrackPoint,
} from "@/lib/track-engine";
import { Train } from "./Train";

const MARGIN = 30;
/** Distance des deux rainures à l'axe de la voie (mm). */
const GROOVE_OFFSET = 9;

export type StepState = "done" | "current" | "todo";

/** Décale une ligne de `d` mm vers sa gauche : sert à dessiner les deux rainures du rail. */
function offsetLine(points: [number, number][], d: number): [number, number][] {
  return points.map(([x, y], i) => {
    const [ax, ay] = points[Math.max(0, i - 1)];
    const [bx, by] = points[Math.min(points.length - 1, i + 1)];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    return [x - ((by - ay) / len) * d, y + ((bx - ax) / len) * d];
  });
}

/** Plan vu de dessus : chaque pièce est dessinée d'après son tracé, placée selon x, y, rotation. */
export function TrackPlan({
  placements,
  catalog,
  title,
  className,
  frame,
  steps,
  train,
  showConnectors = true,
}: {
  placements: Placement[];
  catalog: Catalog;
  title: string;
  className?: string;
  /** Cadre fixe en mm : dessine plusieurs plans à la même échelle. */
  frame?: { width: number; height: number };
  /** Mode pas à pas : état de chaque pièce. */
  steps?: Record<string, StepState>;
  /** Fait rouler un train sur un circuit fermé posé avec chain(). */
  train?: boolean;
  showConnectors?: boolean;
}) {
  const pieces = placements.map((p) => {
    const piece = getPiece(catalog, p.pieceTypeId);
    return { id: p.id, tracks: transformTracks(p, piece), connectors: transform(p, piece) };
  });
  const all = pieces.flatMap((p) => p.tracks.flat());
  let minX = Math.min(...all.map((pt) => pt[0])) - MARGIN;
  let maxX = Math.max(...all.map((pt) => pt[0])) + MARGIN;
  let minY = Math.min(...all.map((pt) => pt[1])) - MARGIN;
  let maxY = Math.max(...all.map((pt) => pt[1])) + MARGIN;
  if (frame) {
    const padX = Math.max(0, frame.width - (maxX - minX)) / 2;
    const padY = Math.max(0, frame.height - (maxY - minY)) / 2;
    minX -= padX;
    maxX += padX;
    minY -= padY;
    maxY += padY;
  }
  // SVG a l'axe y vers le bas : on retourne le plan pour garder y vers le haut.
  const toSvg = (pts: [number, number][]) => pts.map(([x, y]) => [x - minX, maxY - y] as [number, number]);
  const toPoints = (pts: [number, number][]) =>
    toSvg(pts)
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");
  const flat = (track: TrackPoint[]) => track.map(([x, y]) => [x, y] as [number, number]);

  // Parcours du train : la première voie de chaque pièce, dans l'ordre de pose.
  const trainPath = train
    ? "M" +
      toSvg(pieces.flatMap((p) => flat(p.tracks[0])))
        .map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`)
        .join(" L") +
      " Z"
    : null;

  return (
    <svg viewBox={`0 0 ${maxX - minX} ${maxY - minY}`} role="img" aria-label={title} className={className}>
      <title>{title}</title>
      {/* Mode pas à pas : la pièce à poser est dessinée en dernier, par-dessus les autres. */}
      {[...pieces]
        .sort((a, b) => Number(steps?.[a.id] === "current") - Number(steps?.[b.id] === "current"))
        .map((p) => {
          const state = steps?.[p.id];
          const todo = state === "todo";
          const current = state === "current";
          return (
            <g key={p.id} fill="none" strokeLinejoin="round" opacity={todo ? 0.28 : 1}>
              {current &&
                p.tracks.map((track, i) => (
                  <polyline
                    key={`h${i}`}
                    points={toPoints(flat(track))}
                    stroke="var(--accent)"
                    strokeWidth={60}
                    opacity={0.3}
                    className="motion-safe:animate-pulse"
                  />
                ))}
              {p.tracks.map((track, i) => {
                const line = flat(track);
                return (
                  <g key={i}>
                    <polyline
                      points={toPoints(line)}
                      stroke={current ? "var(--accent)" : "var(--wood-dark)"}
                      strokeWidth={40}
                    />
                    <polyline
                      points={toPoints(line)}
                      stroke={current ? "var(--highlight)" : "var(--wood)"}
                      strokeWidth={todo ? 36 : 35}
                    />
                    {[GROOVE_OFFSET, -GROOVE_OFFSET].map((d) => (
                      <polyline
                        key={d}
                        points={toPoints(offsetLine(line, d))}
                        stroke="var(--wood-dark)"
                        strokeWidth={3.5}
                      />
                    ))}
                  </g>
                );
              })}
            </g>
          );
        })}
      {showConnectors &&
        pieces.flatMap((p) =>
          p.connectors.map((c) => (
            <circle
              key={`${p.id}-c${c.index}`}
              cx={c.x - minX}
              cy={maxY - c.y}
              r={c.gender === "male" ? 5 : 7}
              fill={c.gender === "male" ? "var(--wood-dark)" : "var(--surface)"}
              stroke="var(--wood-dark)"
              strokeWidth={2}
            />
          )),
        )}
      {trainPath && <Train path={trainPath} />}
    </svg>
  );
}
