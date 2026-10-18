import type { Inventory, Placement, TrackSet } from "./types";

/** Nomenclature d'un circuit, toujours déduite des placements (jamais saisie). */
export function billOfMaterials(placements: Placement[]): Inventory {
  const bom: Inventory = {};
  for (const p of placements) bom[p.pieceTypeId] = (bom[p.pieceTypeId] ?? 0) + 1;
  return bom;
}

/** Ajoute toutes les pièces d'un coffret à l'inventaire. */
export function addSet(inventory: Inventory, set: TrackSet, count = 1): Inventory {
  const next = { ...inventory };
  for (const { pieceTypeId, quantity } of set.contents) {
    next[pieceTypeId] = (next[pieceTypeId] ?? 0) + quantity * count;
  }
  return next;
}

export function totalPieces(inventory: Inventory): number {
  return Object.values(inventory).reduce((sum, q) => sum + q, 0);
}

export interface MatchResult<L> {
  layout: L;
  /** Pièces manquantes : identifiant → quantité. */
  missing: Inventory;
  missingCount: number;
}

/**
 * Compare l'inventaire aux circuits modèles.
 * `buildable` : rien ne manque ; `almost` : il manque de 1 à `maxMissing` pièces.
 */
export function matchInventory<L extends { placements: Placement[] }>(
  inventory: Inventory,
  layouts: L[],
  maxMissing = 3,
): { buildable: MatchResult<L>[]; almost: MatchResult<L>[] } {
  const buildable: MatchResult<L>[] = [];
  const almost: MatchResult<L>[] = [];
  for (const layout of layouts) {
    const missing: Inventory = {};
    let missingCount = 0;
    for (const [id, needed] of Object.entries(billOfMaterials(layout.placements))) {
      const lack = Math.max(0, needed - (inventory[id] ?? 0));
      if (lack > 0) {
        missing[id] = lack;
        missingCount += lack;
      }
    }
    const result = { layout, missing, missingCount };
    if (missingCount === 0) buildable.push(result);
    else if (missingCount <= maxMissing) almost.push(result);
  }
  return { buildable, almost };
}
