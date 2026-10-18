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
      // Gare de voyageurs classique : toit rouge à deux pans, fenêtres, porte et lanterne.
      return (
        <g>
          <rect x={-62} y={-10} width={124} height={42} rx={4} fill="#fff4dc" stroke="var(--ink)" strokeWidth={4} />
          <path
            d="M-70 -8 L-50 -34 H50 L70 -8 Z"
            fill="var(--accent)"
            stroke="#9c0012"
            strokeWidth={4}
            strokeLinejoin="round"
          />
          <path d="M-50 -34 L-40 -8 M-16 -34 L-12 -8 M16 -34 L12 -8 M50 -34 L40 -8" stroke="#9c0012" strokeWidth={3} />
          <rect x={-48} y={0} width={18} height={14} fill="#9fd3ff" stroke="var(--ink)" strokeWidth={2} />
          <rect x={30} y={0} width={18} height={14} fill="#9fd3ff" stroke="var(--ink)" strokeWidth={2} />
          <path d="M-12 32 V8 A12 12 0 0 1 12 8 V32 Z" fill="var(--wood-dark)" />
          <circle cx={0} cy={-20} r={8} fill="var(--surface)" stroke="var(--ink)" strokeWidth={3} />
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
    case "turntable":
      return (
        <g>
          <circle r={70} fill="var(--wood)" stroke="var(--wood-dark)" strokeWidth={4} />
          <rect x={-70} y={-12} width={140} height={24} rx={4} fill="var(--wood-dark)" />
          <circle r={10} fill="var(--ink)" />
        </g>
      );
    case "cargo-station":
      return (
        <g>
          <rect
            x={-64}
            y={-30}
            width={128}
            height={60}
            rx={6}
            fill="var(--wood)"
            stroke="var(--wood-dark)"
            strokeWidth={4}
          />
          <path d="M-64 -10 H64 M-64 10 H64" stroke="var(--wood-dark)" strokeWidth={3} />
          <rect x={-50} y={-24} width={22} height={22} fill="#e0a020" stroke="var(--wood-dark)" strokeWidth={3} />
          <rect x={26} y={2} width={22} height={22} fill="#e0a020" stroke="var(--wood-dark)" strokeWidth={3} />
        </g>
      );
    case "fire-station":
      return (
        <g>
          <rect x={-60} y={-32} width={120} height={64} rx={6} fill="var(--accent)" />
          <rect x={-48} y={-4} width={40} height={36} rx={3} fill="var(--surface)" />
          <rect x={8} y={-4} width={40} height={36} rx={3} fill="var(--surface)" />
          <path d="M-48 8 H-8 M-48 20 H-8 M8 8 H48 M8 20 H48" stroke="var(--accent)" strokeWidth={3} />
          <circle cx={0} cy={-18} r={8} fill="#ffd23f" />
        </g>
      );
    case "police-station":
      return (
        <g>
          <rect x={-60} y={-30} width={120} height={60} rx={6} fill="var(--ink)" />
          <rect x={-60} y={-30} width={120} height={14} rx={6} fill="#2f7fc1" />
          <rect x={-12} y={4} width={24} height={26} fill="var(--surface)" />
          <circle cx={-34} cy={8} r={7} fill="#2f7fc1" />
          <circle cx={34} cy={8} r={7} fill="var(--accent)" />
        </g>
      );
    case "farm":
      return (
        <g>
          <rect x={-56} y={-34} width={112} height={68} rx={4} fill="#b4322a" />
          <path d="M-56 0 H56" stroke="#7d1f19" strokeWidth={5} />
          <rect x={-18} y={6} width={36} height={28} fill="var(--surface)" />
          <path d="M-18 6 L18 34 M18 6 L-18 34" stroke="#b4322a" strokeWidth={4} />
        </g>
      );
    case "roundhouse":
      return (
        <g>
          <path d="M-70 30 A70 70 0 0 1 70 30 Z" fill="#5e6873" />
          <path d="M-40 30 L-56 -6 M0 30 L0 -36 M40 30 L56 -6" stroke="var(--wood)" strokeWidth={6} />
          <rect x={-70} y={24} width={140} height={10} rx={3} fill="var(--ink)" />
        </g>
      );
    case "garage":
      return (
        <g>
          <rect x={-56} y={-30} width={112} height={60} rx={8} fill="#8b96a3" />
          <path d="M-36 30 V-4 A36 36 0 0 1 36 -4 V30 Z" fill="var(--ink)" />
        </g>
      );
    case "signal-box":
      return (
        <g>
          <rect x={-34} y={-34} width={68} height={68} rx={8} fill="var(--green)" />
          <rect x={-22} y={-22} width={44} height={22} rx={3} fill="#cfe8ff" />
          <rect x={-8} y={8} width={16} height={26} fill="var(--green-dark)" />
        </g>
      );
    case "traffic-light":
      return (
        <g>
          <rect x={-13} y={-36} width={26} height={72} rx={9} fill="var(--ink)" />
          <circle cx={0} cy={-21} r={7} fill="var(--accent)" />
          <circle cx={0} cy={0} r={7} fill="#ffd23f" />
          <circle cx={0} cy={21} r={7} fill="var(--green)" />
        </g>
      );
    case "station-platform":
      // Quai couvert : un long quai gris, un auvent rayé et deux bancs.
      return (
        <g>
          <rect x={-78} y={-24} width={156} height={48} rx={4} fill="#b8c0c8" stroke="#5e6873" strokeWidth={4} />
          <rect x={-70} y={-24} width={140} height={24} fill="var(--surface)" />
          {[-70, -42, -14, 14, 42].map((x) => (
            <rect key={x} x={x} y={-24} width={14} height={24} fill="var(--accent)" />
          ))}
          <rect x={-56} y={8} width={30} height={8} rx={2} fill="var(--wood-dark)" />
          <rect x={26} y={8} width={30} height={8} rx={2} fill="var(--wood-dark)" />
        </g>
      );
    case "station-central":
      // Gare centrale : grand bâtiment crème, deux ailes bleues et une tour à horloge.
      return (
        <g>
          <rect x={-80} y={-26} width={160} height={58} rx={4} fill="#f3e3c3" stroke="#a9783f" strokeWidth={4} />
          <rect x={-80} y={-26} width={44} height={58} rx={4} fill="#2f5fa7" />
          <rect x={36} y={-26} width={44} height={58} rx={4} fill="#2f5fa7" />
          <rect x={-24} y={-46} width={48} height={60} rx={4} fill="#f3e3c3" stroke="#a9783f" strokeWidth={4} />
          <circle cx={0} cy={-22} r={15} fill="var(--surface)" stroke="var(--ink)" strokeWidth={4} />
          <path d="M0 -22 V-32 M0 -22 H8" stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" />
          <path d="M-14 32 V14 A14 14 0 0 1 14 14 V32 Z" fill="var(--ink)" />
        </g>
      );
    case "station-metro":
      // Station de métro : escalier qui descend et grand panneau « M ».
      return (
        <g>
          <rect x={-64} y={-30} width={128} height={60} rx={8} fill="#1b2a4a" />
          {[-14, -2, 10, 22].map((y) => (
            <rect key={y} x={-48} y={y} width={56} height={7} rx={2} fill="#8b96a3" />
          ))}
          <circle cx={36} cy={-6} r={20} fill="#ffd23f" />
          <path d="M24 6 V-16 L36 -2 L48 -16 V6" stroke="#1b2a4a" strokeWidth={6} fill="none" strokeLinejoin="round" />
        </g>
      );
    case "station-space":
      // Base spatiale : dôme vitré, fusée sur son pas de tir.
      return (
        <g>
          <rect x={-74} y={-30} width={148} height={60} rx={30} fill="#d9dee6" stroke="#5e6873" strokeWidth={4} />
          <circle cx={-30} cy={0} r={24} fill="#9fd3ff" stroke="#2f7fc1" strokeWidth={4} />
          <path d="M-42 -6 A14 14 0 0 1 -24 -18" stroke="var(--surface)" strokeWidth={4} fill="none" />
          <path
            d="M28 -28 Q44 -10 44 16 H12 Q12 -10 28 -28 Z"
            fill="var(--surface)"
            stroke="var(--ink)"
            strokeWidth={3}
          />
          <circle cx={28} cy={-2} r={6} fill="#2f7fc1" />
          <path d="M18 16 L28 32 L38 16 Z" fill="#ff8a1f" />
        </g>
      );
    case "station-castle":
      // Château : remparts crénelés et deux tours rondes à toit pointu.
      return (
        <g>
          <path
            d="M-56 -20 h12 v-8 h12 v8 h12 v-8 h12 v8 h12 v-8 h12 v8 h12 v-8 h12 v8 h12 V30 H-56 Z"
            fill="#e9b7d4"
            stroke="#8e3f72"
            strokeWidth={4}
            strokeLinejoin="round"
          />
          {[-60, 60].map((x) => (
            <g key={x}>
              <circle cx={x} cy={4} r={20} fill="#e9b7d4" stroke="#8e3f72" strokeWidth={4} />
              <path d={`M${x - 16} 0 L${x} -34 L${x + 16} 0 Z`} fill="#8e5bc9" />
            </g>
          ))}
          <path d="M-14 30 V12 A14 14 0 0 1 14 12 V30 Z" fill="#8e3f72" />
          <path d="M0 -28 V-48 L14 -42 L0 -36" fill="#ffd23f" stroke="#8e3f72" strokeWidth={2} />
        </g>
      );
    case "station-winter":
      // Gare enneigée : chalet en bois, toit blanc de neige, sapin.
      return (
        <g>
          <rect x={-60} y={-14} width={92} height={44} rx={3} fill="#a9783f" stroke="#6f4a22" strokeWidth={4} />
          <path
            d="M-70 -12 L-14 -40 L42 -12 Z"
            fill="var(--surface)"
            stroke="#b9c7d6"
            strokeWidth={4}
            strokeLinejoin="round"
          />
          <rect x={-26} y={4} width={22} height={26} fill="#6f4a22" />
          <rect x={6} y={2} width={16} height={14} fill="#ffd23f" />
          <path d="M62 -34 L82 6 H42 Z M62 -14 L86 30 H38 Z" fill="var(--green-dark)" />
          <path d="M62 -34 L70 -18 H54 Z" fill="var(--surface)" />
        </g>
      );
    case "station-modern":
      // Gare moderne : grande verrière turquoise et panneaux solaires.
      return (
        <g>
          <rect x={-72} y={-28} width={144} height={56} rx={28} fill="#5ec6c0" stroke="#1f7f7a" strokeWidth={4} />
          {[-40, -14, 12, 38].map((x) => (
            <path key={x} d={`M${x} -28 Q${x + 8} 0 ${x} 28`} stroke="#d8f5f3" strokeWidth={4} fill="none" />
          ))}
          <rect x={-58} y={-18} width={24} height={14} fill="#1b2a4a" />
          <rect x={34} y={4} width={24} height={14} fill="#1b2a4a" />
        </g>
      );
    case "tunnel-mountain":
      // Montagne rocheuse au sommet enneigé.
      return (
        <g>
          <path
            d="M-80 40 L-40 -20 L-16 4 L12 -48 L80 40 Z"
            fill="#8b96a3"
            stroke="#5e6873"
            strokeWidth={5}
            strokeLinejoin="round"
          />
          <path d="M12 -48 L26 -24 L14 -18 L4 -28 L-2 -30 Z" fill="var(--surface)" />
          <path d="M-40 -20 L-32 -8 L-44 -6 Z" fill="var(--surface)" />
        </g>
      );
    case "tunnel-volcano":
      // Volcan des dinosaures : cône brun et lave orange.
      return (
        <g>
          <path
            d="M-80 40 L-26 -34 H26 L80 40 Z"
            fill="#7a4a2a"
            stroke="#4a2c18"
            strokeWidth={5}
            strokeLinejoin="round"
          />
          <ellipse cx={0} cy={-34} rx={26} ry={9} fill="#ff5a1f" />
          <path
            d="M-8 -30 Q-14 -6 -26 4 M10 -30 Q16 -8 30 6"
            stroke="#ff8a1f"
            strokeWidth={7}
            fill="none"
            strokeLinecap="round"
          />
          <circle cx={-6} cy={-50} r={7} fill="#c9ced6" />
          <circle cx={8} cy={-60} r={9} fill="#c9ced6" />
        </g>
      );
    case "tunnel-action":
      // Tunnel d'action (Smart Tech) : arche violette et éclair jaune.
      return (
        <g>
          <rect x={-72} y={-40} width={144} height={80} rx={18} fill="#6b3fb3" stroke="#3e2270" strokeWidth={5} />
          <path
            d="M8 -30 L-14 4 H2 L-8 30 L18 -6 H2 Z"
            fill="#ffd23f"
            stroke="#3e2270"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <circle cx={-46} cy={-18} r={7} fill="#5ec6c0" />
          <circle cx={46} cy={18} r={7} fill="var(--accent)" />
        </g>
      );
    case "tunnel-metro":
      // Tunnel phosphorescent : bleu nuit constellé de points lumineux.
      return (
        <g>
          <rect x={-72} y={-38} width={144} height={76} rx={12} fill="#16213d" stroke="#5ec6c0" strokeWidth={5} />
          {[
            [-48, -18],
            [-20, 14],
            [10, -22],
            [40, 8],
            [-40, 20],
            [26, 24],
            [52, -20],
          ].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r={4} fill="#b9ff8a" />
          ))}
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
  // Les tunnels (de toutes sortes) se posent sur la voie, les autres décors à côté.
  const tunnels = accessories.filter((a) => a.kind.startsWith("tunnel"));
  const besides = accessories.filter((a) => !a.kind.startsWith("tunnel"));

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
        {p.type.id === "lift" &&
          (() => {
            const { at, angle } = middle(flat(p.tracks[0]));
            const [sx, sy] = toSvg([at])[0];
            return (
              <g transform={`translate(${sx} ${sy}) rotate(${-angle})`}>
                <rect x={-64} y={-44} width={128} height={88} rx={8} fill="var(--ink)" opacity={0.85} />
                <rect x={-50} y={-30} width={100} height={60} rx={4} fill="none" stroke="#e0a020" strokeWidth={5} />
                <path d="M0 -22 L14 -6 H5 V20 H-5 V-6 H-14 Z" fill="#e0a020" />
              </g>
            );
          })()}
        {p.type.id === "level-crossing" &&
          (() => {
            const { at, angle } = middle(flat(p.tracks[0]));
            const [sx, sy] = toSvg([at])[0];
            // Barrières rouges et blanches de chaque côté de la voie.
            return (
              <g transform={`translate(${sx} ${sy}) rotate(${-angle + 90})`}>
                {[-1, 1].map((side) => (
                  <g key={side}>
                    <rect x={side * 36 - 5} y={-60} width={10} height={10} fill="var(--ink)" />
                    <path d={`M${side * 36} -55 V-10`} stroke="var(--accent)" strokeWidth={6} strokeDasharray="8 6" />
                  </g>
                ))}
              </g>
            );
          })()}
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
            <AccessoryShape kind={a.kind} />
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
