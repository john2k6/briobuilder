import { matchInventory, totalPieces } from "./inventory";
import type { Inventory, Placement } from "./types";

export interface RankingWeights {
  /** Part de la caisse utilisée : on préfère les grands circuits qui exploitent la caisse. */
  usage: number;
  /** Circuit adapté à l'âge de l'enfant. */
  age: number;
  /** Bonus si l'enfant ne l'a jamais construit. */
  neverBuilt: number;
  /** Thème proche de ses favoris. */
  theme: number;
  /** Nouveauté dans la bibliothèque. */
  novelty: number;
}

export const DEFAULT_WEIGHTS: RankingWeights = { usage: 3, age: 2, neverBuilt: 1.5, theme: 1, novelty: 0.5 };

export interface RankContext {
  inventory: Inventory;
  /** Âge minimal correspondant à la tranche d'âge de l'enfant actif. */
  childAge?: number;
  builtIds?: Set<string>;
  favoriteThemes?: Set<string>;
  /** Circuits ajoutés depuis moins de 30 jours. */
  newIds?: Set<string>;
}

/** Score de pertinence d'un circuit (plus haut = mieux). */
export function relevance(
  layout: { id: string; placements: Placement[]; ageMin: number; theme: string },
  ctx: RankContext,
  w: RankingWeights = DEFAULT_WEIGHTS,
): number {
  const total = totalPieces(ctx.inventory);
  const usage = total > 0 ? Math.min(1, layout.placements.length / total) : 0;
  const age = ctx.childAge === undefined ? 0 : layout.ageMin <= ctx.childAge ? 1 : -1;
  return (
    w.usage * usage +
    w.age * age +
    w.neverBuilt * (ctx.builtIds?.has(layout.id) ? 0 : 1) +
    w.theme * (ctx.favoriteThemes?.has(layout.theme) ? 1 : 0) +
    w.novelty * (ctx.newIds?.has(layout.id) ? 1 : 0)
  );
}

export interface PurchaseSuggestion {
  pieceTypeId: string;
  quantity: number;
  /** Circuits débloqués par cet achat. */
  unlocks: string[];
}

/**
 * « Quelle pièce acheter ? » : pour chaque type de pièce, combien de nouveaux circuits
 * deviennent réalisables si l'on en ajoute 1 à `maxQuantity`. Classé par circuits débloqués, puis par quantité.
 */
export function suggestPurchases<L extends { id: string; placements: Placement[] }>(
  inventory: Inventory,
  layouts: L[],
  pieceTypeIds: string[],
  maxQuantity = 3,
): PurchaseSuggestion[] {
  const before = new Set(matchInventory(inventory, layouts, 0).buildable.map((m) => m.layout.id));
  const suggestions: PurchaseSuggestion[] = [];
  for (const id of pieceTypeIds) {
    for (let q = 1; q <= maxQuantity; q++) {
      const after = matchInventory({ ...inventory, [id]: (inventory[id] ?? 0) + q }, layouts, 0).buildable;
      const unlocks = after.map((m) => m.layout.id).filter((l) => !before.has(l));
      if (unlocks.length > 0) {
        suggestions.push({ pieceTypeId: id, quantity: q, unlocks });
        break;
      }
    }
  }
  return suggestions.sort((a, b) => b.unlocks.length - a.unlocks.length || a.quantity - b.quantity);
}
