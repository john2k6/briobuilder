import { getPiece, transform, transformTracks } from "./geometry";
import type { Catalog, Placement, TrackPoint } from "./types";

/** Largeur d'un rail (mm). Deux voies plus proches que ça se touchent. */
export const TRACK_WIDTH = 40;
/** Autour d'un raccord, deux pièces se touchent forcément : on ignore cette zone. */
const JOINT_MARGIN = 25;
const SAMPLE_STEP = 5;

function sample(track: TrackPoint[]): TrackPoint[] {
  const out: TrackPoint[] = [];
  for (let i = 0; i < track.length - 1; i++) {
    const [x1, y1, l1] = track[i];
    const [x2, y2, l2] = track[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / SAMPLE_STEP));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, t < 0.5 ? l1 : l2]);
    }
  }
  out.push(track[track.length - 1]);
  return out;
}

/**
 * Liste les paires de pièces qui se chevauchent au même niveau.
 * Les ponts sont permis : une voie surélevée peut passer au-dessus d'une autre.
 */
export function overlaps(placements: Placement[], catalog: Catalog): [string, string][] {
  const items = placements.map((p) => {
    const piece = getPiece(catalog, p.pieceTypeId);
    const points = transformTracks(p, piece).flatMap(sample);
    const xs = points.map((q) => q[0]);
    const ys = points.map((q) => q[1]);
    return {
      id: p.id,
      points,
      connectors: transform(p, piece),
      box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    };
  });
  const nearJoint = (pt: TrackPoint, ends: { x: number; y: number }[]) =>
    ends.some((c) => Math.hypot(c.x - pt[0], c.y - pt[1]) < JOINT_MARGIN);

  const result: [string, string][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      // Boîtes englobantes éloignées : pas de contact possible.
      if (
        a.points.length === 0 ||
        b.points.length === 0 ||
        a.box[0] > b.box[2] + TRACK_WIDTH ||
        b.box[0] > a.box[2] + TRACK_WIDTH ||
        a.box[1] > b.box[3] + TRACK_WIDTH ||
        b.box[1] > a.box[3] + TRACK_WIDTH
      ) {
        continue;
      }
      const ends = [...a.connectors, ...b.connectors];
      const hit = a.points.some(
        (pa) =>
          !nearJoint(pa, ends) &&
          b.points.some(
            (pb) => pa[2] === pb[2] && Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) < TRACK_WIDTH && !nearJoint(pb, ends),
          ),
      );
      if (hit) result.push([a.id, b.id]);
    }
  }
  return result;
}
