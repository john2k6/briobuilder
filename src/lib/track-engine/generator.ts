import { analyzeJoints } from "./connect";
import { chain, type ChainStep } from "./chain";
import { fullBillOfMaterials } from "./inventory";
import { overlaps } from "./overlaps";
import type { Catalog, Inventory, Placement } from "./types";

/*
 * Générateur de circuits (EF-26) : des gabarits paramétrés (rond, ovale, rectangle, colline, huit…)
 * dont les lignes droites sont remplies avec les pièces disponibles, toutes boîtes mélangées.
 * Chaque proposition est ensuite vérifiée par le moteur : fermeture (jeu des rails compris) et chevauchements.
 *
 * Un circuit s'écrit sous forme de code compact, réutilisable dans une adresse :
 *   famille:jetons~accessoires   ex. « oval:CCCCLSCCCCMM~T5.G11 »
 */

// ---------------------------------------------------------------------------------------------
// Jetons

/** Une lettre par pièce. Minuscule = petite courbe ; r/R = courbe retournée (vers la droite). */
export const TOKENS: Record<string, ChainStep> = {
  C: { pieceTypeId: "curve-large" },
  R: { pieceTypeId: "curve-large", flipped: true },
  c: { pieceTypeId: "curve-small" },
  r: { pieceTypeId: "curve-small", flipped: true },
  L: { pieceTypeId: "straight-long" },
  M: { pieceTypeId: "straight-medium" },
  S: { pieceTypeId: "straight-short" },
  m: { pieceTypeId: "straight-mini" },
  K: { pieceTypeId: "level-crossing" },
  B: { pieceTypeId: "suspension-bridge" },
  X: { pieceTypeId: "crossing" },
  U: { pieceTypeId: "ramp" },
  // Rail montant posé dans la descente : on entre par le haut (connecteur 1) et on ressort en bas.
  V: { pieceTypeId: "ramp-reverse", inConnector: 1, outConnector: 0 },
  // Aiguillage qui sépare les voies ; w : branche déviée à droite.
  W: { pieceTypeId: "switch" },
  w: { pieceTypeId: "switch", flipped: true },
  // Aiguillage qui réunit les voies : posé à l'envers (entrée par la sortie droite).
  Y: { pieceTypeId: "switch-reverse", inConnector: 1, outConnector: 0 },
  y: { pieceTypeId: "switch-reverse", flipped: true, inConnector: 1, outConnector: 0 },
  Z: { pieceTypeId: "buffer-stop" },
};

export const ACCESSORY_CODES = { T: "tunnel", G: "station", I: "signal", Q: "crane", A: "tree" } as const;
export type AccessoryKind = (typeof ACCESSORY_CODES)[keyof typeof ACCESSORY_CODES];

export interface AccessoryPlacement {
  kind: AccessoryKind;
  /** Pièce à côté de laquelle (ou sur laquelle, pour un tunnel) se trouve l'accessoire. */
  placementId: string;
}

export type Family =
  | "circle"
  | "oval"
  | "rectangle"
  | "hill"
  | "eight-crossing"
  | "eight-bridge"
  | "siding"
  | "passing-loop";

export const FAMILIES: Family[] = [
  "circle",
  "oval",
  "rectangle",
  "hill",
  "eight-crossing",
  "eight-bridge",
  "siding",
  "passing-loop",
];

/** Transforme une suite de jetons en étapes de pose. « @3.2 » : repartir du connecteur 2 de la 3e pièce. */
export function tokensToSteps(tokens: string): ChainStep[] {
  const steps: ChainStep[] = [];
  let from: ChainStep["from"];
  for (const [, jumpPiece, jumpConnector, code] of tokens.matchAll(/@(\d+)\.(\d+)|(\S)/g)) {
    if (jumpPiece) {
      from = { index: Number(jumpPiece) - 1, connector: Number(jumpConnector) };
      continue;
    }
    const step = TOKENS[code];
    if (!step) throw new Error(`Jeton inconnu : ${code}`);
    steps.push(from ? { ...step, from } : step);
    from = undefined;
  }
  return steps;
}

export interface DecodedLayout {
  code: string;
  family: Family;
  placements: Placement[];
  accessories: AccessoryPlacement[];
}

/** Lit un code de circuit. Lève une erreur si le code est invalide. */
export function decodeLayout(code: string, catalog: Catalog): DecodedLayout {
  const match = /^([a-z-]+):([^~]+)(?:~(.*))?$/.exec(code);
  if (!match || !FAMILIES.includes(match[1] as Family)) throw new Error(`Code de circuit invalide : ${code}`);
  const placements = chain(tokensToSteps(match[2]), catalog);
  const accessories: AccessoryPlacement[] = (match[3] ?? "")
    .split(".")
    .filter(Boolean)
    .map((a) => {
      const kind = ACCESSORY_CODES[a[0] as keyof typeof ACCESSORY_CODES];
      const placement = placements[Number(a.slice(1)) - 1];
      if (!kind || !placement) throw new Error(`Accessoire invalide : ${a}`);
      return { kind, placementId: placement.id };
    });
  return { code, family: match[1] as Family, placements, accessories };
}

// ---------------------------------------------------------------------------------------------
// Lignes droites : composer une longueur avec les pièces disponibles

const GROUND_STRAIGHTS = [
  { token: "K", id: "level-crossing", length: 144 },
  { token: "L", id: "straight-long", length: 216 },
  { token: "M", id: "straight-medium", length: 144 },
  { token: "S", id: "straight-short", length: 108 },
  { token: "m", id: "straight-mini", length: 54 },
];
const ELEVATED_STRAIGHTS = [
  { token: "B", id: "suspension-bridge", length: 216 },
  ...GROUND_STRAIGHTS.filter((s) => s.token !== "K"),
];

/** Longueurs possibles d'une ligne droite (mm), jusqu'à 1 512 mm. */
export const RUN_LENGTHS: number[] = (() => {
  const reachable = new Set([0]);
  for (let total = 0; total <= 1512; total += 18) {
    if ([54, 108, 144, 216].some((l) => reachable.has(total - l))) reachable.add(total);
  }
  return [...reachable].sort((a, b) => a - b);
})();

/**
 * Compose une ligne droite de longueur exacte. Utilise d'abord les pièces disponibles (`pool`, modifié),
 * puis, si `allowMissing` > 0, des pièces manquantes (comptées dans `missing`).
 */
function composeRun(
  length: number,
  elevated: boolean,
  pool: Inventory,
  missing: Inventory,
  allowMissing: number,
): string | null {
  const types = elevated ? ELEVATED_STRAIGHTS : GROUND_STRAIGHTS;
  const solve = (rest: number, start: number, budget: number): string[] | null => {
    if (rest === 0) return [];
    for (let i = start; i < types.length; i++) {
      const t = types[i];
      if (t.length > rest) continue;
      const owned = (pool[t.id] ?? 0) > 0;
      // Les pièces spéciales (passage à niveau, pont) ne sont jamais « manquantes » : seulement si on les a.
      if (!owned && (budget === 0 || t.token === "K" || t.token === "B")) continue;
      if (owned) pool[t.id]--;
      else missing[t.id] = (missing[t.id] ?? 0) + 1;
      const restSolution = solve(rest - t.length, i, owned ? budget : budget - 1);
      if (restSolution) return [t.token, ...restSolution];
      if (owned) pool[t.id]++;
      else if (--missing[t.id] === 0) delete missing[t.id];
    }
    return null;
  };
  const used = solve(length, 0, allowMissing - countOf(missing));
  return used ? used.join("") : null;
}

const countOf = (inv: Inventory) => Object.values(inv).reduce((s, q) => s + q, 0);

// ---------------------------------------------------------------------------------------------
// Gabarits

type Elem =
  | string
  | { run: number; elevated?: boolean }
  | { tag: string; token: string }
  | { jump: string; connector: number };

interface Template {
  family: Family;
  elems: Elem[];
  /** Vérifier les chevauchements (inutile pour les formes simples, toujours sans croisement). */
  checkOverlaps: boolean;
}

/** Pièces fixes d'un gabarit (hors lignes droites), pour écarter vite les gabarits impossibles. */
function fixedNeeds(elems: Elem[]): Inventory {
  const needs: Inventory = {};
  for (const e of elems) {
    const letters = typeof e === "string" ? e : "token" in e ? e.token : "";
    for (const letter of letters) {
      const id = TOKENS[letter].pieceTypeId;
      needs[id] = (needs[id] ?? 0) + 1;
    }
  }
  return needs;
}

const RADIUS = { C: 202, c: 110 } as const;

/** Longueur de ligne droite réalisable la plus proche. */
function nearestRun(length: number): number {
  return RUN_LENGTHS.reduce((best, l) => (Math.abs(l - length) < Math.abs(best - length) ? l : best), 0);
}

function* templates(maxRun: number): Generator<Template> {
  const runs = RUN_LENGTHS.filter((l) => l <= maxRun);
  const positive = runs.filter((l) => l > 0);
  const upTo = (max: number) => runs.filter((l) => l <= max);

  for (const k of ["C", "c"] as const) {
    const R = RADIUS[k];
    const r = k === "C" ? "R" : "r";
    const k2 = k + k;
    const k4 = k2 + k2;

    yield { family: "circle", elems: [k.repeat(8)], checkOverlaps: false };
    for (const a of positive) {
      yield { family: "oval", elems: [k4, { run: a }, k4, { run: a }], checkOverlaps: false };
      // Rectangles : pas de 36 mm pour limiter le nombre d'essais.
      if (a % 36 !== 0) continue;
      for (const b of positive.filter((l) => l <= a && l % 36 === 0 && 2 * (a + l) <= 2 * maxRun)) {
        yield {
          family: "rectangle",
          elems: [k2, { run: a }, k2, { run: b }, k2, { run: a }, k2, { run: b }],
          checkOverlaps: false,
        };
      }
    }
    // Colline : un côté de l'ovale monte sur un pont puis redescend.
    for (const a1 of upTo(324)) {
      for (const e of positive.filter((l) => l <= 648)) {
        const side = 2 * a1 + 432 + e;
        if (side > maxRun + 432) continue;
        yield {
          family: "hill",
          elems: [k4, { run: a1 }, "U", { run: e, elevated: true }, "V", { run: a1 }, k4, { run: side }],
          checkOverlaps: false,
        };
      }
    }
    // Voie de garage : un aiguillage sur un côté, une voie parallèle à l'extérieur qui finit sur un butoir.
    for (const a1 of upTo(432)) {
      for (const s of positive.filter((l) => l <= 432)) {
        yield {
          family: "siding",
          elems: [
            k4,
            { tag: "sw", token: "w" },
            { run: a1 },
            k4,
            { run: a1 + 144 },
            { jump: "sw", connector: 2 },
            "C",
            { run: s },
            "Z",
          ],
          checkOverlaps: true,
        };
      }
    }
    // Voie d'évitement : deux aiguillages et une voie parallèle à l'extérieur.
    for (const t of upTo(432)) {
      for (const merge of ["Y", "y"]) {
        yield {
          family: "passing-loop",
          elems: [
            k4,
            { tag: "sw", token: "w" },
            { run: t + 288 },
            merge,
            k4,
            { run: t + 576 },
            { jump: "sw", connector: 2 },
            "C",
            { run: t },
            "C",
          ],
          checkOverlaps: true,
        };
      }
    }
    // Huit avec croisement : deux boucles de 270°, éventuellement allongées par des lignes droites (u).
    for (const u of upTo(324)) {
      const p = nearestRun(u + R - 108);
      const loop = (c: string) => [c + c, { run: u }, c + c, { run: u }, c + c];
      yield {
        family: "eight-crossing",
        elems: [
          { tag: "x", token: "X" },
          { run: p },
          ...loop(r),
          { run: p },
          { jump: "x", connector: 3 },
          { run: p },
          ...loop(k),
          { run: p },
        ],
        checkOverlaps: true,
      };
    }
    // Huit avec pont : la voie verticale monte, passe au-dessus de l'autre, puis redescend.
    for (const u of upTo(432)) {
      const h = nearestRun(R + u);
      const loop = (c: string) => [c + c, { run: u }, c + c, { run: u }, c + c];
      for (const b of upTo(216)) {
        const e = nearestRun(2 * R + 2 * u - 2 * b - 432);
        if (e <= 0) continue;
        yield {
          family: "eight-bridge",
          elems: [
            { run: h },
            ...loop(r),
            { run: b },
            "U",
            { run: e, elevated: true },
            "V",
            { run: b },
            ...loop(k),
            { run: h },
          ],
          checkOverlaps: true,
        };
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Génération

export type Size = "small" | "medium" | "large";

export interface GeneratorOptions {
  /** Tailles acceptées (toutes si vide). */
  sizes?: Size[];
  /** Exiger un pont, un aiguillage, un croisement. */
  require?: { bridge?: boolean; switches?: boolean; crossing?: boolean };
  /** Familles acceptées (toutes si vide). */
  families?: Family[];
  /** Placer tunnels, gares, signaux… disponibles. */
  decorate?: boolean;
  /** Nombre maximal de pièces manquantes pour un circuit « presque réalisable ». */
  maxMissing?: number;
  /** Nombre maximal de propositions par catégorie. */
  limit?: number;
}

export interface GeneratedLayout extends DecodedLayout {
  bom: Inventory;
  missing: Inventory;
  missingCount: number;
  /** Écart absorbé par le jeu des raccords à la fermeture (mm). */
  gap: number;
  pieces: number;
  size: Size;
  features: { bridge: boolean; switches: boolean; crossing: boolean };
  difficulty: 1 | 2 | 3;
  minutes: number;
  score: number;
}

export function sizeOf(pieces: number): Size {
  return pieces <= 12 ? "small" : pieces <= 20 ? "medium" : "large";
}

const TRACK_ACCESSORIES = new Set(["support", "tunnel", "station", "signal", "crane", "tree"]);

function expand(elems: Elem[], pool: Inventory, missing: Inventory, allowMissing: number): string | null {
  let out = "";
  let count = 0;
  const tags: Record<string, number> = {};
  for (const e of elems) {
    if (typeof e === "string") {
      out += e;
      count += e.length;
    } else if ("run" in e) {
      const run = composeRun(e.run, e.elevated ?? false, pool, missing, allowMissing);
      if (run === null) return null;
      out += run;
      count += run.length;
    } else if ("tag" in e) {
      tags[e.tag] = count + 1;
      out += e.token;
      count += 1;
    } else {
      out += `@${tags[e.jump]}.${e.connector}`;
    }
  }
  return out;
}

/** Place les accessoires disponibles le long des lignes droites au sol. */
function decorate(placements: Placement[], available: Inventory): { codes: string[]; list: AccessoryPlacement[] } {
  const ground = placements
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !p.level && ["straight-long", "straight-medium", "straight-short"].includes(p.pieceTypeId));
  const curves = placements.map((p, i) => ({ p, i })).filter(({ p }) => p.pieceTypeId.startsWith("curve"));
  const used = new Set<number>();
  const codes: string[] = [];
  const list: AccessoryPlacement[] = [];
  const put = (letter: keyof typeof ACCESSORY_CODES, candidates: { p: Placement; i: number }[], qty: number) => {
    for (let n = 0; n < qty; n++) {
      const spot = candidates.find(({ i }) => !used.has(i));
      if (!spot) return;
      used.add(spot.i);
      codes.push(`${letter}${spot.i + 1}`);
      list.push({ kind: ACCESSORY_CODES[letter], placementId: spot.p.id });
    }
  };
  const longFirst = [...ground].sort(
    (a, b) => (b.p.pieceTypeId === "straight-long" ? 1 : 0) - (a.p.pieceTypeId === "straight-long" ? 1 : 0),
  );
  put("T", longFirst, Math.min(available.tunnel ?? 0, 1));
  put("G", [...ground].reverse(), Math.min(available.station ?? 0, 2));
  put("Q", ground, Math.min(available.crane ?? 0, 1));
  put("I", ground, Math.min(available.signal ?? 0, 1));
  put(
    "A",
    curves.filter((_, n) => n % 3 === 1),
    Math.min(available.tree ?? 0, 3),
  );
  return { codes, list };
}

/**
 * Propose des circuits réalisables (et presque réalisables) avec l'inventaire, toutes boîtes mélangées.
 * Les propositions sont triées par pertinence, en variant les familles.
 */
export function generateLayouts(
  inventory: Inventory,
  catalog: Catalog,
  options: GeneratorOptions = {},
): { buildable: GeneratedLayout[]; almost: GeneratedLayout[]; total: { buildable: number; almost: number } } {
  const maxMissing = options.maxMissing ?? 3;
  const limit = options.limit ?? 12;
  const straightLength =
    GROUND_STRAIGHTS.reduce((s, t) => s + t.length * (inventory[t.id] ?? 0), 0) +
    216 * (inventory["suspension-bridge"] ?? 0);
  const maxRun = Math.min(1512, straightLength / 2 + 216 * maxMissing);
  const totalOwned = Object.entries(inventory)
    .filter(([id]) => !TRACK_ACCESSORIES.has(id))
    .reduce((s, [, q]) => s + q, 0);

  const seen = new Set<string>();
  const results: GeneratedLayout[] = [];

  for (const template of templates(maxRun)) {
    if (options.families?.length && !options.families.includes(template.family)) continue;
    // Pièces fixes : on écarte d'emblée ce qui manque trop.
    const fixedMissing = Object.entries(fixedNeeds(template.elems)).reduce(
      (s, [id, q]) => s + Math.max(0, q - (inventory[id] ?? 0)),
      0,
    );
    if (fixedMissing > maxMissing) continue;

    const pool = { ...inventory };
    const missing: Inventory = {};
    const tokens = expand(template.elems, pool, missing, maxMissing);
    if (tokens === null) continue;
    const code = `${template.family}:${tokens}`;
    if (seen.has(code)) continue;
    seen.add(code);

    let placements: Placement[];
    try {
      placements = chain(tokensToSteps(tokens), catalog);
    } catch {
      continue;
    }
    const report = analyzeJoints(placements, catalog);
    if (!report.closed) continue;
    if (template.checkOverlaps && overlaps(placements, catalog).length > 0) continue;

    const bom = fullBillOfMaterials(placements, catalog);
    const lacking: Inventory = {};
    for (const [id, need] of Object.entries(bom)) {
      const lack = need - (inventory[id] ?? 0);
      if (lack > 0) lacking[id] = lack;
    }
    const missingCount = countOf(lacking);
    if (missingCount > maxMissing) continue;

    const pieces = placements.length;
    const size = sizeOf(pieces);
    if (options.sizes?.length && !options.sizes.includes(size)) continue;
    const features = {
      bridge: tokens.includes("U"),
      switches: /[WwYy]/.test(tokens),
      crossing: tokens.includes("X"),
    };
    const req = options.require ?? {};
    if (
      (req.bridge && !features.bridge) ||
      (req.switches && !features.switches) ||
      (req.crossing && !features.crossing)
    ) {
      continue;
    }

    let accessories: AccessoryPlacement[] = [];
    let fullCode = code;
    if (options.decorate) {
      const deco = decorate(placements, inventory);
      accessories = deco.list;
      if (deco.codes.length) fullCode = `${code}~${deco.codes.join(".")}`;
    }

    const special = Number(features.bridge) + Number(features.switches) + Number(features.crossing);
    const difficulty = Math.min(3, 1 + (pieces > 16 ? 1 : 0) + (special > 0 ? 1 : 0)) as 1 | 2 | 3;
    const usage = totalOwned > 0 ? Math.min(1, (pieces - missingCount) / totalOwned) : 0;
    results.push({
      code: fullCode,
      family: template.family,
      placements,
      accessories,
      bom,
      missing: lacking,
      missingCount,
      gap: Math.round(report.maxGap * 10) / 10,
      pieces,
      size,
      features,
      difficulty,
      minutes: Math.round(pieces * 0.6 + special * 3 + 2),
      score: usage * 3 + special * 0.8 + (report.maxGap < 1 ? 0.3 : 0) - missingCount * 0.5,
    });
  }

  const pick = (list: GeneratedLayout[]) => {
    // Variété : au plus 4 circuits par famille, de tailles différentes ; on alterne les familles.
    const byFamily = new Map<Family, GeneratedLayout[]>();
    for (const r of [...list].sort((a, b) => b.score - a.score)) {
      const group = byFamily.get(r.family) ?? [];
      const similar = group.some((g) => Math.abs(g.pieces - r.pieces) < 2);
      if (!similar && group.length < 4) group.push(r);
      byFamily.set(r.family, group);
    }
    const out: GeneratedLayout[] = [];
    const queues = [...byFamily.values()].filter((q) => q.length).sort((a, b) => b[0].score - a[0].score);
    while (out.length < limit && queues.some((q) => q.length)) {
      for (const q of queues) {
        const next = q.shift();
        if (next && out.length < limit) out.push(next);
      }
    }
    return out;
  };
  const buildable = results.filter((r) => r.missingCount === 0);
  return {
    total: { buildable: buildable.length, almost: results.length - buildable.length },
    buildable: pick(buildable),
    almost: pick(results.filter((r) => r.missingCount > 0)).sort((a, b) => a.missingCount - b.missingCount),
  };
}
