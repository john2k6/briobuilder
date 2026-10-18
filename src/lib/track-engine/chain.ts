import { attach, getPiece, transform } from "./geometry";
import type { Catalog, Placement } from "./types";

export interface ChainStep {
  pieceTypeId: string;
  flipped?: boolean;
  /** Connecteur de la pièce qui se raccorde à la précédente (0 par défaut). */
  inConnector?: number;
  /** Connecteur libre de la pièce par lequel on continue (1 par défaut). */
  outConnector?: number;
  /** Repart d'une pièce déjà posée (indice dans la liste) plutôt que de la précédente : boucles en 8, aiguillages. */
  from?: { index: number; connector: number };
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
    const source = step.from ? placements[step.from.index] : previous;
    if (step.from && !source) throw new Error(`Pièce de départ absente : ${step.from.index}`);
    if (!source) {
      placement = { id, pieceTypeId: piece.id, x: 0, y: 0, rotation: 0, flipped: step.flipped ?? false };
    } else {
      const out = step.from ? step.from.connector : previousOut;
      const target = transform(source, getPiece(catalog, source.pieceTypeId))[out];
      placement = attach(piece, step.inConnector ?? 0, target, { id, flipped: step.flipped });
    }
    placements.push(placement);
    previous = placement;
    previousOut = step.outConnector ?? 1;
  });
  return placements;
}
