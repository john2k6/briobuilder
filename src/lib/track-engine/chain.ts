import { attach, getPiece, transform } from "./geometry";
import type { Catalog, Placement } from "./types";

export interface ChainStep {
  pieceTypeId: string;
  flipped?: boolean;
  /** Connecteur de la pièce qui se raccorde à la précédente (0 par défaut). */
  inConnector?: number;
  /** Connecteur libre de la pièce par lequel on continue (1 par défaut). */
  outConnector?: number;
}

/**
 * Pose des pièces bout à bout, en partant de l'origine.
 * Pratique pour décrire un circuit modèle et pour les tests.
 */
export function chain(steps: ChainStep[], catalog: Catalog): Placement[] {
  const placements: Placement[] = [];
  let previous: Placement | null = null;
  let previousOut = 1;

  steps.forEach((step, i) => {
    const piece = getPiece(catalog, step.pieceTypeId);
    const id = `p${i + 1}`;
    let placement: Placement;
    if (!previous) {
      placement = { id, pieceTypeId: piece.id, x: 0, y: 0, rotation: 0, flipped: step.flipped ?? false };
    } else {
      const target = transform(previous, getPiece(catalog, previous.pieceTypeId))[previousOut];
      placement = attach(piece, step.inConnector ?? 0, target, { id, flipped: step.flipped });
    }
    placements.push(placement);
    previous = placement;
    previousOut = step.outConnector ?? 1;
  });
  return placements;
}
