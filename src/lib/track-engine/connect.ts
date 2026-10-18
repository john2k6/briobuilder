import { ANGLE_TOLERANCE, POSITION_TOLERANCE, angleDiff, getPiece, transform } from "./geometry";
import type { Catalog, Connector, Placement, WorldConnector } from "./types";

export type ConnectResult =
  | { ok: true }
  | { ok: false; reason: "too-far" | "misaligned" | "level" | "same-gender" };

/** Vérifie si deux connecteurs placés peuvent être raccordés. */
export function connect(a: Connector, b: Connector): ConnectResult {
  if (Math.hypot(a.x - b.x, a.y - b.y) > POSITION_TOLERANCE) return { ok: false, reason: "too-far" };
  if (Math.abs(angleDiff(a.angle, b.angle) - 180) > ANGLE_TOLERANCE) {
    return { ok: false, reason: "misaligned" };
  }
  if (a.level !== b.level) return { ok: false, reason: "level" };
  if (a.gender === b.gender) return { ok: false, reason: "same-gender" };
  return { ok: true };
}

export interface JointError {
  a: WorldConnector;
  b: WorldConnector;
  reason: "misaligned" | "level" | "same-gender";
}

export interface ClosureReport {
  /** Vrai si chaque extrémité est raccordée correctement et qu'il n'y a aucune erreur. */
  closed: boolean;
  joints: [WorldConnector, WorldConnector][];
  openConnectors: WorldConnector[];
  errors: JointError[];
}

/** Analyse les raccords d'un circuit : extrémités libres et raccords interdits. */
export function analyzeJoints(placements: Placement[], catalog: Catalog): ClosureReport {
  const all = placements.flatMap((p) => transform(p, getPiece(catalog, p.pieceTypeId)));
  const used = new Set<WorldConnector>();
  const joints: [WorldConnector, WorldConnector][] = [];
  const errors: JointError[] = [];

  for (let i = 0; i < all.length; i++) {
    const a = all[i];
    if (used.has(a)) continue;
    for (let j = i + 1; j < all.length; j++) {
      const b = all[j];
      if (used.has(b) || a.placementId === b.placementId) continue;
      const result = connect(a, b);
      if (result.ok) {
        joints.push([a, b]);
        used.add(a).add(b);
        break;
      }
      if (result.reason !== "too-far") {
        errors.push({ a, b, reason: result.reason });
        used.add(a).add(b);
        break;
      }
    }
  }

  const openConnectors = all.filter((c) => !used.has(c));
  return {
    closed: placements.length > 0 && openConnectors.length === 0 && errors.length === 0,
    joints,
    openConnectors,
    errors,
  };
}

/** Un circuit est fermé quand il n'a aucune extrémité libre et aucun raccord interdit. */
export function isClosed(placements: Placement[], catalog: Catalog): boolean {
  return analyzeJoints(placements, catalog).closed;
}
