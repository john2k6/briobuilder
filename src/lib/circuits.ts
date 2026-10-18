import { catalog } from "./catalog";
import {
  analyzeJoints,
  decodeLayout,
  difficultyOf,
  featuresOf,
  fullBillOfMaterials,
  isComplete,
  minutesOf,
  generateLayouts,
  sizeOf,
  type GeneratedLayout,
  type GeneratorOptions,
  type Inventory,
} from "./track-engine";

/** Ajoute à la nomenclature les gares, tunnels et décors posés le long du circuit. */
function withAccessories(bom: Inventory, accessories: { kind: string }[]): Inventory {
  const out = { ...bom };
  for (const a of accessories) out[a.kind] = (out[a.kind] ?? 0) + 1;
  return out;
}

/** Adresse de la fiche (ou du mode pas à pas) d'un circuit : le circuit voyage dans l'adresse. */
export const circuitHref = (code: string, build = false) => ({
  pathname: build ? "/circuit/build" : "/circuit",
  query: { c: code },
});

/** Circuit prêt à afficher : décodé depuis son code, avec sa nomenclature et ses caractéristiques. */
export type Circuit = Omit<GeneratedLayout, "missing" | "missingCount" | "score">;

const cache = new Map<string, Circuit | null>();

/** Lit un code de circuit (adresse, favori, historique). Renvoie null si le code est invalide ou si le circuit ne ferme pas. */
export function circuitFromCode(code: string): Circuit | null {
  if (cache.has(code)) return cache.get(code)!;
  let circuit: Circuit | null = null;
  try {
    const decoded = decodeLayout(code, catalog);
    const report = analyzeJoints(decoded.placements, catalog);
    const tokens = code.split(":")[1].split("~")[0];
    if (isComplete(report, tokens)) {
      const pieces = decoded.placements.length;
      const features = featuresOf(tokens);
      circuit = {
        ...decoded,
        bom: withAccessories(fullBillOfMaterials(decoded.placements, catalog), decoded.accessories),
        gap: Math.round(report.maxGap * 10) / 10,
        pieces,
        size: sizeOf(pieces),
        features,
        difficulty: difficultyOf(pieces, features),
        minutes: minutesOf(pieces, features),
      };
    }
  } catch {
    circuit = null;
  }
  cache.set(code, circuit);
  return circuit;
}

/** Pièces manquantes pour construire un circuit avec l'inventaire. */
export function missingFor(circuit: Circuit, inventory: Inventory): Inventory {
  const missing: Inventory = {};
  for (const [id, need] of Object.entries(circuit.bom)) {
    const lack = need - (inventory[id] ?? 0);
    if (lack > 0) missing[id] = lack;
  }
  return missing;
}

export function generate(inventory: Inventory, options: GeneratorOptions) {
  return generateLayouts(inventory, catalog, options);
}
