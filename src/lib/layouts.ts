import rawLayouts from "../../data/layouts/layouts.json";
import { catalog } from "./catalog";
import { billOfMaterials, chain, type ChainStep, type Inventory, type Placement } from "./track-engine";

/**
 * Notation compacte des circuits modèles : une lettre par pièce, posées bout à bout.
 * Majuscule/minuscule = grande/petite courbe ; R/r = courbe retournée (tourne à droite).
 * X = croisement (on continue tout droit) ; « @2.3 » = la pièce suivante part du connecteur 3 de la 2e pièce.
 */
export const SEQUENCE_CODES: Record<string, ChainStep> = {
  C: { pieceTypeId: "curve-large" },
  R: { pieceTypeId: "curve-large", flipped: true },
  c: { pieceTypeId: "curve-small" },
  r: { pieceTypeId: "curve-small", flipped: true },
  L: { pieceTypeId: "straight-long" },
  M: { pieceTypeId: "straight-medium" },
  S: { pieceTypeId: "straight-short" },
  X: { pieceTypeId: "crossing" },
};

export type Theme = "classic" | "city" | "countryside";

export interface Layout {
  id: string;
  theme: Theme;
  ageMin: number;
  difficulty: 1 | 2 | 3;
  minutes: number;
  addedAt: string;
  placements: Placement[];
  /** Nomenclature, toujours déduite des placements. */
  bom: Inventory;
}

export function sequenceToPlacements(sequence: string): Placement[] {
  const steps: ChainStep[] = [];
  let from: ChainStep["from"];
  for (const [, jumpPiece, jumpConnector, code] of sequence.matchAll(/@(\d+)\.(\d+)|(\S)/g)) {
    if (jumpPiece) {
      from = { index: Number(jumpPiece) - 1, connector: Number(jumpConnector) };
      continue;
    }
    const step = SEQUENCE_CODES[code];
    if (!step) throw new Error(`Code de pièce inconnu : ${code}`);
    steps.push(from ? { ...step, from } : step);
    from = undefined;
  }
  return chain(steps, catalog);
}

export const layouts: Layout[] = rawLayouts.map(({ sequence, ...rest }) => {
  const placements = sequenceToPlacements(sequence);
  return {
    ...rest,
    difficulty: rest.difficulty as Layout["difficulty"],
    theme: rest.theme as Theme,
    placements,
    bom: billOfMaterials(placements),
  };
});

export const layoutById: Record<string, Layout> = Object.fromEntries(layouts.map((l) => [l.id, l]));
