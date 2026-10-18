import {
  getPiece,
  transform,
  transformTracks,
  type AccessoryKind,
  type AccessoryPlacement,
  type Catalog,
  type Placement,
  type TrackPoint,
} from "@/lib/track-engine";
import { Train } from "./Train";

const MARGIN = 40;
/** Distance des deux rainures à l'axe de la voie (mm). */
const GROOVE_OFFSET = 9;

export type StepState = "done" | "current" | "todo";
type Pt = [number, number];

/** Décale une ligne de `d` mm vers sa gauche : sert à dessiner les deux rainures du rail. */
function offsetLine(points: Pt[], d: number): Pt[] {
  return points.map(([x, y], i) => {
    const [ax, ay] = points[Math.max(0, i - 1)];
    const [bx, by] = points[Math.min(points.length - 1, i + 1)];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    return [x - ((by - ay) / len) * d, y + ((bx - ax) / len) * d];
  });
}

/** Point milieu d'une voie et sa direction (degrés, repère du plan). */
function middle(track: Pt[]): { at: Pt; angle: number } {
  const i = Math.floor((track.length - 1) / 2);
  const a = track[i];
  const b = track[Math.min(track.length - 1, i + 1)];
  const at: Pt = track.length % 2 === 0 ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : track[Math.floor(track.length / 2)];
  const p = track[0];
  const q = track[track.length - 1];
  return { at, angle: (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI };
}

/** Dessin original des décors (vue de dessus), centré sur 0,0, en mm. */
export function AccessoryShape({ kind }: { kind: AccessoryKind }) {
  switch (kind) {
    case "tunnel":
      return (
        <g>
          <rect x={-70} y={-42} width={140} height={84} rx={30} fill="var(--green)" />
          <rect
            x={-70}
            y={-42}
            width={140}
            height={84}
            rx={30}
            fill="none"
            stroke="var(--green-dark)"
            strokeWidth={5}
          />
          <path
            d="M-52 -26 Q-30 -36 -8 -26 M10 22 Q32 12 54 22"
            stroke="var(--green-dark)"
            strokeWidth={5}
            fill="none"
          />
        </g>
      );
    case "station":
      return (
        <g>
          <rect
            x={-60}
            y={-28}
            width={120}
            height={56}
            rx={6}
            fill="var(--surface)"
            stroke="var(--ink)"
            strokeWidth={4}
          />
          <rect x={-60} y={-28} width={120} height={18} rx={6} fill="var(--accent)" />
          <rect x={-14} y={2} width={28} height={26} fill="var(--ink)" />
        </g>
      );
    case "signal":
      return (
        <g>
          <rect x={-10} y={-22} width={20} height={44} rx={8} fill="var(--ink)" />
          <circle cx={0} cy={-9} r={6} fill="var(--accent)" />
          <circle cx={0} cy={9} r={6} fill="var(--green)" />
        </g>
      );
    case "crane":
      return (
        <g>
          <rect x={-22} y={-22} width={44} height={44} rx={6} fill="var(--ink)" />
          <path d="M0 0 L70 -30" stroke="var(--wood-dark)" strokeWidth={10} strokeLinecap="round" />
          <circle cx={70} cy={-30} r={8} fill="var(--accent)" />
        </g>
      );
    case "tree":
      return (
        <g>
          <circle r={26} fill="var(--green)" />
          <circle r={26} fill="none" stroke="var(--green-dark)" strokeWidth={4} />
          <circle cx={-6} cy={-6} r={9} fill="var(--green-dark)" opacity={0.5} />
        </g>
      );
  }
}

/** Plan vu de dessus : chaque pièce est dessinée d'après son tracé, placée selon x, y, rotation et niveau. */
export function TrackPlan({
  placements,
  catalog,
  title,
  className,
  frame,
  steps,
  train,
  showConnectors = true,
  accessories = [],
}: {
  placements: Placement[];
  catalog: Catalog;
  title: string;
  className?: string;
  /** Cadre fixe en mm : dessine plusieurs plans à la même échelle. */
  frame?: { width: number; height: number };
  /** Mode pas à pas : état de chaque pièce. */
  steps?: Record<string, StepState>;
  /** Fait rouler un train sur la boucle principale. */
  train?: boolean;
  showConnectors?: boolean;
  accessories?: AccessoryPlacement[];
}) {
  const pieces = placements.map((p) => {
    const piece = getPiece(catalog, p.pieceTypeId);
    return {
      id: p.id,
      type: piece,
      level: p.level ?? 0,
      tracks: transformTracks(p, piece),
      connectors: transform(p, piece),
    };
  });
  const all = pieces.flatMap((p) => p.tracks.flat());
  if (all.length === 0) {
    return <svg viewBox="0 0 10 10" role="img" aria-label={title} className={className} />;
  }
  let minX = Math.min(...all.map((pt) => pt[0])) - MARGIN;
  let maxX = Math.max(...all.map((pt) => pt[0])) + MARGIN;
  let minY = Math.min(...all.map((pt) => pt[1])) - MARGIN;
  let maxY = Math.max(...all.map((pt) => pt[1])) + MARGIN;
  if (accessories.length) {
    minX -= 90;
    maxX += 90;
    minY -= 90;
    maxY += 90;
  }
  if (frame) {
    const padX = Math.max(0, frame.width - (maxX - minX)) / 2;
    const padY = Math.max(0, frame.height - (maxY - minY)) / 2;
    minX -= padX;
    maxX += padX;
    minY -= padY;
    maxY += padY;
  }
  // SVG a l'axe y vers le bas : on retourne le plan pour garder y vers le haut.
  const toSvg = (pts: Pt[]) => pts.map(([x, y]) => [x - minX, maxY - y] as Pt);
  const toPoints = (pts: Pt[]) =>
    toSvg(pts)
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");
  const flat = (track: TrackPoint[]) => track.map(([x, y]) => [x, y] as Pt);

  // Parcours du train : la voie principale de chaque pièce, bout à bout, jusqu'à la première discontinuité
  // (on traverse un croisement, mais on ne saute pas vers une voie de garage).
  let trainPath: string | null = null;
  if (train) {
    const path: Pt[] = [];
    for (const p of pieces) {
      if (!p.tracks.length) continue;
      let line = flat(p.tracks[0]);
      const end = path[path.length - 1];
      if (end) {
        const dStart = Math.hypot(line[0][0] - end[0], line[0][1] - end[1]);
        const dEnd = Math.hypot(line[line.length - 1][0] - end[0], line[line.length - 1][1] - end[1]);
        if (dEnd < dStart) line = [...line].reverse();
        if (Math.min(dStart, dEnd) > 230) break;
      }
      path.push(...line);
    }
    trainPath =
      "M" +
      toSvg(path)
        .map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`)
        .join(" L") +
      " Z";
  }

  // Piliers : sous chaque raccord en hauteur.
  const supports: Pt[] = [];
  for (const p of pieces) {
    for (const c of p.connectors) {
      if (c.level >= 1 && !supports.some(([x, y]) => Math.hypot(x - c.x, y - c.y) < 10)) supports.push([c.x, c.y]);
    }
  }

  const centroid: Pt = [all.reduce((s, q) => s + q[0], 0) / all.length, all.reduce((s, q) => s + q[1], 0) / all.length];
  const byId = new Map(pieces.map((p) => [p.id, p]));

  const ordered = [...pieces].sort(
    (a, b) =>
      a.level - b.level ||
      Math.max(...a.tracks.flat().map((q) => q[2]), 0) - Math.max(...b.tracks.flat().map((q) => q[2]), 0) ||
      Number(steps?.[a.id] === "current") - Number(steps?.[b.id] === "current"),
  );
  const tunnels = accessories.filter((a) => a.kind === "tunnel");
  const besides = accessories.filter((a) => a.kind !== "tunnel");

  const drawPiece = (p: (typeof pieces)[number]) => {
    const state = steps?.[p.id];
    const todo = state === "todo";
    const current = state === "current";
    const elevated = p.level > 0 || p.tracks.some((t) => t.some((q) => q[2] > 0));
    return (
      <g key={p.id} fill="none" strokeLinejoin="round" opacity={todo ? 0.28 : 1}>
        {elevated &&
          p.tracks.map((track, i) => (
            <polyline
              key={`s${i}`}
              points={toPoints(flat(track).map(([x, y]) => [x + 9, y - 12] as Pt))}
              stroke="var(--ink)"
              strokeWidth={42}
              opacity={0.2}
            />
          ))}
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
        {p.type.id === "level-crossing" &&
          (() => {
            const { at, angle } = middle(flat(p.tracks[0]));
            const [sx, sy] = toSvg([at])[0];
            return (
              <g transform={`translate(${sx} ${sy}) rotate(${-angle + 90})`}>
                <rect x={-80} y={-34} width={160} height={68} fill="var(--muted)" />
                <path d="M-70 0 H70" stroke="#fff" strokeWidth={5} strokeDasharray="16 12" />
              </g>
            );
          })()}
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
                <polyline key={d} points={toPoints(offsetLine(line, d))} stroke="var(--wood-dark)" strokeWidth={3.5} />
              ))}
            </g>
          );
        })}
        {p.type.category === "ramp" &&
          (() => {
            const line = flat(p.tracks[0]);
            const [a, b] = [line[0], line[line.length - 1]];
            // Flèches dans le sens de la montée (du niveau bas vers le niveau haut).
            const upward = p.tracks[0][0][2] <= p.tracks[0][p.tracks[0].length - 1][2];
            const angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI + (upward ? 0 : 180);
            return [0.3, 0.5, 0.7].map((f) => {
              const [sx, sy] = toSvg([[a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]])[0];
              return (
                <path
                  key={f}
                  d="M-8 -11 L6 0 L-8 11"
                  stroke="var(--ink)"
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  transform={`translate(${sx} ${sy}) rotate(${-angle})`}
                />
              );
            });
          })()}
        {p.type.category === "buffer" &&
          (() => {
            const line = flat(p.tracks[0]);
            const end = line[line.length - 1];
            const angle = (Math.atan2(end[1] - line[0][1], end[0] - line[0][0]) * 180) / Math.PI;
            const [sx, sy] = toSvg([end])[0];
            return (
              <rect
                x={-9}
                y={-26}
                width={18}
                height={52}
                rx={4}
                fill="var(--accent)"
                transform={`translate(${sx} ${sy}) rotate(${-angle})`}
              />
            );
          })()}
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${maxX - minX} ${maxY - minY}`} role="img" aria-label={title} className={className}>
      <title>{title}</title>
      {ordered.filter((p) => p.level === 0 && !p.tracks.some((t) => t.some((q) => q[2] > 0))).map(drawPiece)}
      {supports.map(([x, y], i) => (
        <g key={`sup${i}`} transform={`translate(${x - minX} ${maxY - y})`}>
          <rect x={-30} y={-30} width={60} height={60} rx={10} fill="var(--ink)" />
          <rect x={-18} y={-18} width={36} height={36} rx={6} fill="none" stroke="var(--wood)" strokeWidth={4} />
        </g>
      ))}
      {ordered.filter((p) => p.level > 0 || p.tracks.some((t) => t.some((q) => q[2] > 0))).map(drawPiece)}
      {tunnels.map((a) => {
        const p = byId.get(a.placementId);
        if (!p?.tracks.length) return null;
        const { at, angle } = middle(flat(p.tracks[0]));
        const [sx, sy] = toSvg([at])[0];
        return (
          <g
            key={`acc-${a.kind}-${a.placementId}`}
            transform={`translate(${sx} ${sy}) rotate(${-angle})`}
            opacity={0.92}
          >
            <AccessoryShape kind="tunnel" />
          </g>
        );
      })}
      {besides.map((a) => {
        const p = byId.get(a.placementId);
        if (!p?.tracks.length) return null;
        const { at, angle } = middle(flat(p.tracks[0]));
        const dx = at[0] - centroid[0];
        const dy = at[1] - centroid[1];
        const len = Math.hypot(dx, dy) || 1;
        const [sx, sy] = toSvg([[at[0] + (dx / len) * 80, at[1] + (dy / len) * 80]])[0];
        return (
          <g key={`acc-${a.kind}-${a.placementId}`} transform={`translate(${sx} ${sy}) rotate(${-angle})`}>
            <AccessoryShape kind={a.kind} />
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
