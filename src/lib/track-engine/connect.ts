import { ANGLE_TOLERANCE, POSITION_TOLERANCE, angleDiff, flexTolerance, getPiece, transform } from "./geometry";
import type { Catalog, Connector, Placement, WorldConnector } from "./types";

export type ConnectResult = { ok: true } | { ok: false; reason: "too-far" | "misaligned" | "level" | "same-gender" };

/** Vérifie si deux connecteurs placés peuvent être raccordés. */
export function connect(
  a: Connector,
  b: Connector,
  tolerance = { position: POSITION_TOLERANCE, angle: ANGLE_TOLERANCE },
): ConnectResult {
  if (Math.hypot(a.x - b.x, a.y - b.y) > tolerance.position) return { ok: false, reason: "too-far" };
  if (Math.abs(angleDiff(a.angle, b.angle) - 180) > tolerance.angle) {
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
  /** Plus grand écart (mm) absorbé par le jeu des raccords pour fermer la boucle. */
  maxGap: number;
}

/**
 * Analyse les raccords d'un circuit : extrémités libres et raccords interdits.
 * 1er passage strict (±3 mm) ; 2e passage pour les extrémités restantes avec le jeu des rails (`flexTolerance`).
 */
export function analyzeJoints(placements: Placement[], catalog: Catalog): ClosureReport {
  const all = placements.flatMap((p) => transform(p, getPiece(catalog, p.pieceTypeId)));
  const used = new Set<WorldConnector>();
  const joints: [WorldConnector, WorldConnector][] = [];
  const errors: JointError[] = [];

  const pass = (tolerance: { position: number; angle: number }, strict: boolean) => {
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      if (used.has(a)) continue;
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j];
        if (used.has(b) || a.placementId === b.placementId) continue;
        const result = connect(a, b, tolerance);
        if (result.ok) {
          joints.push([a, b]);
          used.add(a).add(b);
          break;
        }
        if (strict && result.reason !== "too-far") {
          errors.push({ a, b, reason: result.reason });
          used.add(a).add(b);
          break;
        }
      }
    }
  };
  pass({ position: POSITION_TOLERANCE, angle: ANGLE_TOLERANCE }, true);
  pass(flexTolerance(placements.length), false);

  const openConnectors = all.filter((c) => !used.has(c));
  const maxGap = joints.reduce((m, [a, b]) => Math.max(m, Math.hypot(a.x - b.x, a.y - b.y)), 0);
  return {
    closed: placements.length > 0 && openConnectors.length === 0 && errors.length === 0,
    joints,
    openConnectors,
    errors,
    maxGap,
  };
}

/** Un circuit est fermé quand il n'a aucune extrémité libre et aucun raccord interdit. */
export function isClosed(placements: Placement[], catalog: Catalog): boolean {
  return analyzeJoints(placements, catalog).closed;
}
