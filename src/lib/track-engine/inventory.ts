import { getPiece, transform } from "./geometry";
import type { Catalog, Inventory, Placement, TrackSet } from "./types";

/** Nomenclature d'un circuit, toujours déduite des placements (jamais saisie). */
export function billOfMaterials(placements: Placement[]): Inventory {
  const bom: Inventory = {};
  for (const p of placements) bom[p.pieceTypeId] = (bom[p.pieceTypeId] ?? 0) + 1;
  return bom;
}

/** Piliers nécessaires : un sous chaque raccord en hauteur (niveau ≥ 1). */
export function supportsNeeded(placements: Placement[], catalog: Catalog): number {
  const points: { x: number; y: number }[] = [];
  for (const p of placements) {
    for (const c of transform(p, getPiece(catalog, p.pieceTypeId))) {
      if (c.level < 1 || points.some((q) => Math.hypot(q.x - c.x, q.y - c.y) < 10)) continue;
      points.push({ x: c.x, y: c.y });
    }
  }
  return points.length;
}

/** Nomenclature complète : pièces posées + piliers pour les parties en hauteur. */
export function fullBillOfMaterials(placements: Placement[], catalog: Catalog): Inventory {
  const bom = billOfMaterials(placements);
  const supports = supportsNeeded(placements, catalog);
  if (supports > 0) bom.support = supports;
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
export function matchInventory<L extends { placements: Placement[]; bom?: Inventory }>(
  inventory: Inventory,
  layouts: L[],
  maxMissing = 3,
): { buildable: MatchResult<L>[]; almost: MatchResult<L>[] } {
  const buildable: MatchResult<L>[] = [];
  const almost: MatchResult<L>[] = [];
  for (const layout of layouts) {
    const missing: Inventory = {};
    let missingCount = 0;
    for (const [id, needed] of Object.entries(layout.bom ?? billOfMaterials(layout.placements))) {
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
