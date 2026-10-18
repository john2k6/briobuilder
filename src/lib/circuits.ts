import { catalog } from "./catalog";
import {
  analyzeJoints,
  decodeLayout,
  fullBillOfMaterials,
  generateLayouts,
  sizeOf,
  type GeneratedLayout,
  type GeneratorOptions,
  type Inventory,
} from "./track-engine";

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
    if (report.closed) {
      const tokens = code.split(":")[1].split("~")[0];
      const pieces = decoded.placements.length;
      const features = {
        bridge: tokens.includes("U"),
        switches: /[WwYy]/.test(tokens),
        crossing: tokens.includes("X"),
      };
      const special = Number(features.bridge) + Number(features.switches) + Number(features.crossing);
      circuit = {
        ...decoded,
        bom: fullBillOfMaterials(decoded.placements, catalog),
        gap: Math.round(report.maxGap * 10) / 10,
        pieces,
        size: sizeOf(pieces),
        features,
        difficulty: Math.min(3, 1 + (pieces > 16 ? 1 : 0) + (special > 0 ? 1 : 0)) as 1 | 2 | 3,
        minutes: Math.round(pieces * 0.6 + special * 3 + 2),
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
