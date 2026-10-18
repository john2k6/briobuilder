import { analyzeJoints, type ClosureReport } from "./connect";
import { chain, type ChainStep } from "./chain";
import { getPiece, transform, transformTracks } from "./geometry";
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
  // Aiguillage en Y : une entrée, une branche à gauche (connecteur 1) et une à droite (connecteur 2).
  J: { pieceTypeId: "switch-t" },
  // Petit aiguillage (sortie droite courte, branche en petite courbe) ; n : branche à droite.
  N: { pieceTypeId: "switch-small" },
  n: { pieceTypeId: "switch-small", flipped: true },
  H: { pieceTypeId: "lifting-bridge" },
  // Courbes montantes en plastique (demi-tour) : E monte en tournant à gauche, e à droite ;
  // F redescend en tournant à gauche, f à droite (pièce inverse posée à l'envers).
  E: { pieceTypeId: "curve-ascending" },
  e: { pieceTypeId: "curve-ascending", flipped: true },
  F: { pieceTypeId: "curve-ascending-reverse", flipped: true, inConnector: 1, outConnector: 0 },
  f: { pieceTypeId: "curve-ascending-reverse", inConnector: 1, outConnector: 0 },
  // Ascenseur de l'entrepôt : le train monte d'un niveau.
  G: { pieceTypeId: "lift" },
};

/** « | » marque une voie sans issue laissée ouverte (pas de butoir disponible) : ce n'est pas une pièce. */
export const OPEN_END = "|";

export const ACCESSORY_CODES = {
  T: "tunnel",
  G: "station",
  I: "signal",
  Q: "crane",
  A: "tree",
  O: "turntable",
  L: "traffic-light",
  H: "cargo-station",
  F: "fire-station",
  P: "police-station",
  E: "farm",
  D: "roundhouse",
  R: "garage",
  B: "signal-box",
} as const;
type AccessoryLetter = keyof typeof ACCESSORY_CODES;
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
  | "passing-loop"
  | "l-shape"
  | "u-shape"
  | "bean"
  | "triangle"
  | "house"
  | "octagon"
  | "terminus"
  | "fork"
  | "yard"
  | "line"
  | "network"
  | "spiral"
  | "lift"
  | "theta"
  | "serpent"
  | "wander"
  | "mega";

export const FAMILIES: Family[] = [
  "circle",
  "oval",
  "rectangle",
  "hill",
  "eight-crossing",
  "eight-bridge",
  "siding",
  "passing-loop",
  "l-shape",
  "u-shape",
  "bean",
  "triangle",
  "house",
  "octagon",
  "terminus",
  "fork",
  "yard",
  "line",
  "network",
  "spiral",
  "lift",
  "theta",
  "serpent",
  "wander",
  "mega",
];

/** Anciennes familles (rond, ovale, rectangle) : encore lisibles dans les codes, plus jamais proposées. */
export const LEGACY_FAMILIES: Family[] = ["circle", "oval", "rectangle"];
/** Familles que le générateur propose. */
export const PROPOSED_FAMILIES = FAMILIES.filter((f) => !LEGACY_FAMILIES.includes(f));

/** Transforme une suite de jetons en étapes de pose. « @3.2 » : repartir du connecteur 2 de la 3e pièce. */
export function tokensToSteps(tokens: string): ChainStep[] {
  const steps: ChainStep[] = [];
  let from: ChainStep["from"];
  for (const [, jumpPiece, jumpConnector, code] of tokens.matchAll(/@(\d+)\.(\d+)|(\S)/g)) {
    if (code === OPEN_END) continue;
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

/** Nombre de voies sans issue laissées ouvertes dans un circuit. */
export const openEndCount = (tokens: string) => tokens.split(OPEN_END).length - 1;

/** Un circuit est complet si tous ses raccords sont bons et que seules ses voies sans issue restent ouvertes. */
export function isComplete(report: ClosureReport, tokens: string): boolean {
  return (
    report.joints.length > 0 && report.errors.length === 0 && report.openConnectors.length === openEndCount(tokens)
  );
}

export interface CircuitFeatures {
  bridge: boolean;
  switches: boolean;
  crossing: boolean;
}

export function featuresOf(tokens: string): CircuitFeatures {
  return { bridge: /[UEeG]/.test(tokens), switches: /[WwYyJNn]/.test(tokens), crossing: tokens.includes("X") };
}

export function difficultyOf(pieces: number, features: CircuitFeatures): 1 | 2 | 3 {
  const special = Number(features.bridge) + Number(features.switches) + Number(features.crossing);
  return Math.min(3, 1 + (pieces > 16 ? 1 : 0) + (special > 0 ? 1 : 0)) as 1 | 2 | 3;
}

export function minutesOf(pieces: number, features: CircuitFeatures): number {
  const special = Number(features.bridge) + Number(features.switches) + Number(features.crossing);
  return Math.round(pieces * 0.6 + special * 3 + 2);
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
  { token: "H", id: "lifting-bridge", length: 216 },
  ...GROUND_STRAIGHTS.filter((s) => s.token !== "K"),
];

/** Longueur maximale d'une ligne droite (mm) : de quoi aligner une vingtaine de grands rails. */
export const MAX_RUN = 4320;

/** Longueurs possibles d'une ligne droite (mm). */
export const RUN_LENGTHS: number[] = (() => {
  const reachable = new Set([0]);
  for (let total = 0; total <= MAX_RUN; total += 18) {
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
      if (!owned && (budget === 0 || "KBH".includes(t.token))) continue;
      if (owned) pool[t.id]--;
      else missing[t.id] = (missing[t.id] ?? 0) + 1;
      const restSolution = solve(rest - t.length, i, owned ? budget : budget - 1);
      if (restSolution) return [t.token, ...restSolution];
      if (owned) pool[t.id]++;
      else if (--missing[t.id] === 0) delete missing[t.id];
    }
    return null;
  };
  // D'abord avec ses propres pièces uniquement ; des pièces manquantes seulement si c'est impossible.
  const used = solve(length, 0, 0) ?? solve(length, 0, allowMissing - countOf(missing));
  return used ? used.join("") : null;
}

const countOf = (inv: Inventory) => Object.values(inv).reduce((s, q) => s + q, 0);

// ---------------------------------------------------------------------------------------------
// Gabarits

type Elem =
  | string
  | { run: number; elevated?: boolean }
  | { tag: string; token: string }
  | { jump: string; connector: number }
  /** Voie sans issue : un butoir si on en a, sinon la voie reste ouverte. */
  | { end: true };

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
      if (!TOKENS[letter]) continue;
      const id = TOKENS[letter].pieceTypeId;
      needs[id] = (needs[id] ?? 0) + 1;
    }
  }
  return needs;
}

const RADIUS = { C: 212, c: 110 } as const;

/** Longueur de ligne droite réalisable la plus proche. */
function nearestRun(length: number): number {
  return RUN_LENGTHS.reduce((best, l) => (Math.abs(l - length) < Math.abs(best - length) ? l : best), 0);
}

// Formes libres : une suite de virages (lettres de courbes) séparés par des lignes droites.
// Deux lignes droites (« x » et « y ») sont calculées pour que la forme se referme.

const CURVE_TURN: Record<string, { radius: number; turn: 1 | -1 }> = {
  C: { radius: 212, turn: 1 },
  R: { radius: 212, turn: -1 },
  c: { radius: 110, turn: 1 },
  r: { radius: 110, turn: -1 },
};
const deg = (d: number) => (d * Math.PI) / 180;

/** Déplacement (mm) et nouveau cap après une suite de courbes de 45°. */
function turnMove(curves: string, heading: number): { dx: number; dy: number; heading: number } {
  let dx = 0;
  let dy = 0;
  let h = heading;
  for (const letter of curves) {
    const { radius, turn } = CURVE_TURN[letter];
    // Centre du virage à gauche (turn 1) ou à droite (turn -1) de la voie.
    const cx = -turn * radius * Math.sin(deg(h));
    const cy = turn * radius * Math.cos(deg(h));
    const next = h + 45 * turn;
    dx += cx + turn * radius * Math.sin(deg(next));
    dy += cy - turn * radius * Math.cos(deg(next));
    h = next;
  }
  return { dx, dy, heading: h };
}

/**
 * Construit une forme fermée : `runs[i]` est la ligne droite avant le virage `turns[i]`.
 * Une valeur nommée vient de `values` ; « x » et « y » sont calculées. Renvoie null si la forme ne ferme pas
 * avec des longueurs de rails réalisables.
 */
function shape(turns: string[], runs: (string | number)[], values: Record<string, number>): Elem[] | null {
  let px = 0;
  let py = 0;
  let heading = 0;
  const dir: Record<string, [number, number]> = {};
  for (let i = 0; i < turns.length; i++) {
    const run = runs[i];
    const ux = Math.cos(deg(heading));
    const uy = Math.sin(deg(heading));
    if (run === "x" || run === "y") dir[run] = [ux, uy];
    else {
      const length = typeof run === "number" ? run : values[run];
      px += ux * length;
      py += uy * length;
    }
    const move = turnMove(turns[i], heading);
    px += move.dx;
    py += move.dy;
    heading = move.heading;
  }
  if (Math.round(heading) % 360 !== 0 || !dir.x || !dir.y) return null;
  const [ax, ay] = dir.x;
  const [bx, by] = dir.y;
  const det = ax * by - ay * bx;
  if (Math.abs(det) < 1e-6) return null;
  const solved = { x: (-px * by + py * bx) / det, y: (ax * -py + ay * px) / det };
  const lengths: Record<string, number> = { ...values };
  for (const key of ["x", "y"] as const) {
    const run = nearestRun(solved[key]);
    if (solved[key] < -3 || Math.abs(run - solved[key]) > 24) return null;
    lengths[key] = run;
  }
  return turns.flatMap((turn, i) => {
    const run = runs[i];
    const length = typeof run === "number" ? run : lengths[run];
    return length > 0 ? [{ run: length }, turn] : [turn];
  });
}

/** Toutes les combinaisons de valeurs des paramètres. */
function* combos(params: Record<string, number[]>): Generator<Record<string, number>> {
  const keys = Object.keys(params);
  const walk = function* (i: number, acc: Record<string, number>): Generator<Record<string, number>> {
    if (i === keys.length) {
      yield { ...acc };
      return;
    }
    for (const v of params[keys[i]]) yield* walk(i + 1, { ...acc, [keys[i]]: v });
  };
  yield* walk(0, {});
}

const maxRunOf = (elems: Elem[]) =>
  elems.reduce((m, e) => (typeof e === "object" && "run" in e ? Math.max(m, e.run) : m), 0);

/** Longueur d'aiguillage (partie droite) selon le jeton. */
const SWITCH_LENGTH: Record<string, number> = { w: 144, W: 144, n: 108, N: 108, Y: 144, y: 144 };

/**
 * Ajoute un embranchement sur la ligne droite `runIndex` d'une boucle : l'aiguillage est posé après `before` mm,
 * puis la branche (`branch`) part de sa sortie déviée.
 */
function withBranch(
  loop: Elem[],
  runIndex: number,
  before: number,
  sw: string,
  branch: Elem[],
  tag = "br",
): Elem[] | null {
  const run = loop[runIndex];
  if (typeof run !== "object" || !("run" in run)) return null;
  const after = run.run - before - SWITCH_LENGTH[sw];
  if (after < 0 || !RUN_LENGTHS.includes(after)) return null;
  return [
    ...loop.slice(0, runIndex),
    { run: before },
    { tag, token: sw },
    { run: after },
    ...loop.slice(runIndex + 1),
    { jump: tag, connector: 2 },
    ...branch,
  ];
}

const END: Elem = { end: true };

function* templates(maxRun: number): Generator<Template> {
  // Du plus grand au plus petit : les grands circuits, qui utilisent le plus de pièces, passent en premier.
  const runs = RUN_LENGTHS.filter((l) => l <= maxRun).reverse();
  const upTo = (max: number) => runs.filter((l) => l <= max);

  // Huit avec croisement : deux boucles de 270° autour du croisement, de tailles et de courbes différentes.
  // Boucle : ligne p, virage, ligne u, virage, ligne w, virage, ligne q ; w et q se déduisent de p et u.
  const loop270 = (curve: "C" | "c" | "R" | "r", p: number, u: number): Elem[] | null => {
    const radius = curve === "C" || curve === "R" ? RADIUS.C : RADIUS.c;
    const w = p + 108 - radius;
    const q = u + radius - 108;
    const [w2, q2] = [nearestRun(w), nearestRun(q)];
    if (w < -3 || Math.abs(w2 - w) > 16 || Math.abs(q2 - q) > 16) return null;
    const c2 = curve + curve;
    return [{ run: p }, c2, { run: u }, c2, { run: w2 }, c2, { run: q2 }];
  };
  // Pour chaque type de courbe, quelques boucles réalisables (du plus grand au plus petit).
  const loopsFor = (curve: "C" | "c" | "R" | "r") => {
    const sizes = RUN_LENGTHS.filter((l) => l <= Math.min(1296, maxRun)).reverse();
    const found: Elem[][] = [];
    for (const p of sizes) {
      for (const u of sizes) {
        const loop = loop270(curve, p, u);
        if (loop) found.push(loop);
      }
    }
    // Une dizaine de boucles réparties du plus grand au plus petit.
    const step = Math.max(1, Math.floor(found.length / 10));
    return found.filter((_, i) => i % step === 0 || i === found.length - 1);
  };
  for (const [first, second] of [
    ["R", "C"],
    ["r", "c"],
    ["R", "c"],
    ["r", "C"],
  ] as const) {
    for (const a of loopsFor(first)) {
      for (const b of loopsFor(second)) {
        yield {
          family: "eight-crossing",
          elems: [{ tag: "x", token: "X" }, ...a, { jump: "x", connector: 3 }, ...b],
          checkOverlaps: true,
        };
      }
    }
  }

  for (const k of ["C", "c"] as const) {
    const R = RADIUS[k];
    const r = k === "C" ? "R" : "r";
    const k2 = k + k;
    const k4 = k2 + k2;

    // Plus de simples ronds, ovales ni rectangles (demandé par Jonathan le 18 octobre 2026) :
    // ces familles restent lisibles dans les anciens codes, mais le générateur ne les propose plus.
    // Colline, voie de garage, voie d'évitement, terminus, fourche et gare de triage sont posés sur les
    // formes libres (voir `derived`), plus sur un ovale.
    // Huit avec pont : la voie verticale monte, passe au-dessus de l'autre, puis redescend.
    // Les longueurs exactes tombent rarement juste : on essaie les plus proches (le jeu des rails fait le reste).
    const near = (target: number) =>
      RUN_LENGTHS.filter((l) => l >= 0 && Math.abs(l - target) <= 30 && l <= maxRun).slice(0, 3);
    for (const u of upTo(1080).filter((l) => l % 108 === 0)) {
      const loop = (c: string) => [c + c, { run: u }, c + c, { run: u }, c + c];
      for (const h of near(R + u)) {
        for (const b of upTo(216)) {
          for (const e of near(2 * R + 2 * u - 2 * b - 432)) {
            yield {
              family: "eight-bridge",
              elems: [
                { run: h },
                ...loop(r),
                { run: b },
                "U",
                ...(e > 0 ? [{ run: e, elevated: true }] : []),
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

    // Le serpent : les côtés ondulent (virage à gauche, deux à droite, un à gauche), autant de fois
    // que les courbes le permettent. Chaque ondulation garde la voie dans l'axe : la boucle se referme.
    const bump = k + r + r + k;
    for (const n of [1, 2, 3, 4, 5, 6, 8, 10, 12]) {
      for (const a of [0, 108, 216]) {
        const side = (count: number): Elem[] => [
          { run: a },
          ...Array.from({ length: count }, (): Elem[] => [bump, { run: a }]).flat(),
        ];
        yield { family: "serpent", elems: [k4, ...side(n), k4, ...side(n)], checkOverlaps: true };
        for (const b of [0, 216]) {
          yield {
            family: "serpent",
            elems: [k2, ...side(n), k2, { run: b }, k2, ...side(n), k2, { run: b }],
            checkOverlaps: true,
          };
          yield {
            family: "serpent",
            elems: [k2, ...side(n), k2, ...side(Math.ceil(n / 2)), k2, ...side(n), k2, ...side(Math.ceil(n / 2))],
            checkOverlaps: true,
          };
        }
      }
    }

    // Formes libres : L, U, haricot, triangle, maison, octogone.
    const K2 = r + r;
    const shapes: { family: Family; turns: string[]; runs: (string | number)[]; params: Record<string, number[]> }[] = [
      {
        family: "l-shape",
        turns: [k2, k2, K2, k2, k2, k2],
        runs: ["x", "a", "b", "c", "d", "y"],
        params: { a: [108, 216, 324, 648], b: [108, 216, 324, 648], c: [108, 216, 432], d: [108, 216, 324, 648] },
      },
      {
        family: "u-shape",
        turns: [k2, k2, k2, K2, K2, k2, k2, k2],
        runs: ["x", "a", "b", "c", "d", "c", "b", "y"],
        params: { a: [216, 324, 432, 864], b: [0, 108, 216, 432], c: [108, 216, 432], d: [108, 216, 324, 648] },
      },
      {
        family: "bean",
        turns: [k, r, r, k, k2, k2, k2, k2],
        runs: ["a", "d", "b", "d", "a", "h", "x", "y"],
        params: { a: [108, 216, 648], d: [0, 108], b: [0, 108, 216, 648], h: [108, 216, 324, 864] },
      },
      {
        family: "triangle",
        turns: [k2, k + k2, k + k2],
        runs: ["a", "x", "y"],
        params: { a: [216, 324, 432, 648, 1080, 1512] },
      },
      {
        family: "house",
        turns: [k2, k, k2, k, k2],
        runs: ["a", "h", "x", "y", "h"],
        params: { a: [108, 216, 324, 432, 864], h: [108, 216, 324, 648] },
      },
      {
        family: "octagon",
        turns: Array(8).fill(k),
        runs: ["s", "s", "s", "s", "s", "s", "x", "y"],
        params: { s: [54, 108, 144, 216, 432, 648] },
      },
    ];
    for (const { family, turns, runs: shapeRuns, params } of shapes) {
      for (const values of combos(params)) {
        const elems = shape(turns, shapeRuns, values);
        if (elems && maxRunOf(elems) <= maxRun) yield { family, elems, checkOverlaps: true };
      }
    }

    // Ligne d'une gare à l'autre : pas de boucle, deux voies sans issue, avec 1 à 3 virages
    // (coude, S, U, zigzag…) choisis parmi les courbes disponibles.
    const bends = [k, r, k2, K2, k + k + k, k4];
    const lineRuns = [1296, 864, 432, 216].filter((l) => l <= maxRun);
    for (const b1 of bends) {
      for (const b2 of ["", ...bends]) {
        for (const b3 of b2 ? ["", ...bends] : [""]) {
          for (const a of lineRuns) {
            for (const m of [216]) {
              const turns = [b1, b2, b3].filter(Boolean);
              const elems: Elem[] = [OPEN_END, { run: a }];
              for (const turn of turns) elems.push(turn, { run: m });
              elems.push(END);
              yield { family: "line", elems, checkOverlaps: true };
            }
          }
        }
      }
    }

    // Deux niveaux avec les courbes montantes en plastique (demi-tour de rayon E) et l'ascenseur.
    if (k === "C") {
      const high = (run: number): Elem => ({ run, elevated: true });
      for (const a of upTo(648)) {
        // Spirale : on monte dans un virage, on roule en hauteur, on redescend dans l'autre virage.
        if (a > 0) yield { family: "spiral", elems: ["E", high(a), "F", { run: a }], checkOverlaps: true };
        for (const b of upTo(216)) {
          // On monte dans le virage et on redescend par un rail montant (ou l'inverse).
          yield {
            family: "spiral",
            elems: ["E", high(a), "V", { run: b }, k4, { run: a + 216 + b }],
            checkOverlaps: true,
          };
          yield {
            family: "spiral",
            elems: [{ run: b }, "U", high(a), "F", { run: a + 216 + b }, k4],
            checkOverlaps: true,
          };
          // Ascenseur : on monte avec l'ascenseur, on redescend dans le virage ou par un rail montant.
          yield {
            family: "lift",
            elems: [k4, { run: b }, "G", high(a), "F", { run: a + 144 + b }],
            checkOverlaps: true,
          };
          for (const c of [0, 108, 216]) {
            yield {
              family: "lift",
              elems: [k4, { run: b }, "G", high(a), "V", { run: c }, k4, { run: a + 144 + b + 216 + c }],
              checkOverlaps: true,
            };
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Balades : des boucles de forme libre, tirées au hasard, qui tournent à gauche et à droite

/** Générateur de nombres pseudo-aléatoires : toujours la même suite pour une même graine (codes stables). */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Vrai si la boucle n'est qu'un rond, un ovale ou un rectangle : que des virages à gauche,
 * tous de la même taille une fois les virages collés (sans ligne droite entre eux) réunis.
 */
function plainLoop(elems: Elem[]): boolean {
  const turns: string[] = [""];
  for (const e of elems) {
    if (typeof e === "string") turns[turns.length - 1] += e;
    else if ("run" in e && e.run > 0) turns.push("");
  }
  // La boucle est fermée : le dernier virage continue le premier.
  if (turns.length > 1) turns[0] = turns.pop()! + turns[0];
  const groups = turns.filter(Boolean);
  return !groups.some((t) => /[Rr]/.test(t)) && groups.every((t) => t.length === groups[0].length);
}

/**
 * Boucles libres : 8 virages à gauche de plus que de virages à droite (la voie fait un tour complet),
 * mélangés au hasard, avec des lignes droites de longueurs variées. Deux lignes droites sont calculées
 * pour refermer la forme ; le moteur écarte ensuite celles qui se croisent.
 */
function* wanders(
  inventory: Inventory,
  maxMissing: number,
  maxRun: number,
  straightLength: number,
  count: number,
): Generator<Template> {
  const big = inventory["curve-large"] ?? 0;
  const small = inventory["curve-small"] ?? 0;
  const budget = big + small + maxMissing;
  if (budget < 8) return;
  const rand = seeded(20261018);
  const pickOne = <T>(list: T[]) => list[Math.floor(rand() * list.length)];
  const shuffle = <T>(list: T[]) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };
  const lengths = [0, 0, 0, 108, 216, 216, 324, 432, 432, 648, 864, 1296, 1728, 2160].filter((l) => l <= maxRun);
  // Plus on a de courbes, plus la forme peut serpenter : jusqu'à 40 courbes et plus de 100 pièces.
  const maxRights = Math.min(20, Math.max(1, Math.floor((big + small - 8) / 2)));
  for (let n = 0; n < count; n++) {
    // Une fois sur trois, la plus grande forme possible ; parfois aucun virage à droite (forme biscornue).
    const rights =
      budget < 10 || rand() < 0.1
        ? 0
        : rand() < 0.35
          ? Math.max(1, maxRights - Math.floor(rand() * 3))
          : 1 + Math.floor(rand() * maxRights);
    const huge = rights >= maxRights - 2 && maxRights >= 6;
    const total = 8 + 2 * rights;
    // Grandes courbes d'abord (celles qu'on possède), puis les petites.
    if (total > budget) continue;
    const largeCount = Math.min(total, Math.max(big, total - small));
    const kinds = shuffle(Array.from({ length: total }, (_, i) => i < largeCount));
    const dirs = shuffle(Array.from({ length: total }, (_, i) => i < rights));
    const letters = kinds.map((large, i) => (large ? (dirs[i] ? "R" : "C") : dirs[i] ? "r" : "c"));
    // On regroupe les courbes en virages, séparés par des lignes droites.
    const turns: string[] = [];
    for (const letter of letters) {
      if (turns.length && rand() < 0.45) turns[turns.length - 1] += letter;
      else turns.push(letter);
    }
    if (turns.length < 3) continue;
    // Sans virage à droite, des virages tous pareils donneraient un rond, un ovale ou un rectangle : on les écarte.
    if (rights === 0 && turns.every((t) => t.length === turns[0].length)) continue;
    // Lignes droites à la mesure des rails qu'on possède (les plus longues pour les grandes formes).
    const share = (straightLength * (huge ? 1 : 0.8)) / turns.length;
    const fitting = lengths.filter((l) => l <= Math.max(108, share * 1.5));
    const base = turns.map(() => pickOne(huge ? fitting.slice(Math.floor(fitting.length / 2)) : fitting));
    // Souvent une ligne droite assez longue pour y poser une colline (deux rails montants) ou une voie d'évitement.
    // (648 mm = deux rails montants et un pont de 216 mm entre les deux.)
    if (rand() < 0.6) {
      base[Math.floor(rand() * base.length)] = pickOne([504, 576, 648, 648, 756, 864].filter((l) => l <= maxRun));
    }
    const pairs = shuffle(turns.flatMap((_, i) => turns.map((__, j) => [i, j]).filter(([a, b]) => b > a)));
    for (const [i, j] of pairs) {
      const runs: (string | number)[] = base.map((l, k) => (k === i ? "x" : k === j ? "y" : l));
      const elems = shape(turns, runs, {});
      if (elems && maxRunOf(elems) <= maxRun && !plainLoop(elems)) {
        yield { family: "wander", elems, checkOverlaps: true };
        break;
      }
    }
  }
}

/**
 * Formes biscornues à 8 courbes (un seul tour, sans virage à droite) : toutes les façons de grouper
 * les courbes en 3 à 5 virages, avec une longue ligne droite (pour une colline ou une voie d'évitement).
 * Utile aux petites collections, qui n'ont pas assez de courbes pour serpenter.
 */
function* crooked(inventory: Inventory, maxRun: number): Generator<Template> {
  const k = (inventory["curve-large"] ?? 0) >= (inventory["curve-small"] ?? 0) ? "C" : "c";
  for (let mask = 0; mask < 128; mask++) {
    // Chaque bit dit si la courbe suivante commence un nouveau virage.
    const turns = [k];
    for (let bit = 0; bit < 7; bit++) {
      if (mask & (1 << bit)) turns.push(k);
      else turns[turns.length - 1] += k;
    }
    if (turns.length < 3 || turns.length > 5) continue;
    for (const long of [648, 864, 432].filter((l) => l <= maxRun)) {
      for (const fill of [0, 216]) {
        for (let i = 1; i < turns.length; i++) {
          for (let j = i + 1; j < turns.length; j++) {
            const runs = turns.map((_, n) => (n === 0 ? long : n === i ? "x" : n === j ? "y" : fill));
            const elems = shape(turns, runs, {});
            if (!elems || maxRunOf(elems) > maxRun || plainLoop(elems)) continue;
            yield { family: "wander", elems, checkOverlaps: true };
            // La même forme avec une colline sur la longue ligne droite (rails montants et pont).
            if (long >= 648 && (inventory.ramp ?? 0) > 0) {
              const at = elems.findIndex((e) => typeof e === "object" && "run" in e && e.run === long);
              yield {
                family: "hill",
                elems: [...elems.slice(0, at), "U", { run: long - 432, elevated: true }, "V", ...elems.slice(at + 1)],
                checkOverlaps: true,
              };
            }
          }
        }
      }
    }
  }
}

/**
 * Grands réseaux : une boucle à pont, à croisement ou à voie d'évitement, plus un embranchement
 * qui part d'une ligne droite au sol vers un terminus (ou une fourche).
 */
function* networks(base: Template): Generator<Template> {
  const runs = base.elems.flatMap((e, i) =>
    typeof e === "object" && "run" in e && !e.elevated && e.run >= 252 ? [i] : [],
  );
  for (const runIndex of runs.slice(0, 2)) {
    for (const sw of ["w", "n", "Y"]) {
      for (const branch of [
        ["R", { run: 216 }, END],
        [{ run: 324 }, END],
        [{ run: 108 }, { tag: "y", token: "J" }, { run: 216 }, END, { jump: "y", connector: 2 }, { run: 216 }, END],
      ] as Elem[][]) {
        const elems = withBranch(base.elems, runIndex, 0, sw, branch);
        if (elems) yield { family: "network", elems, checkOverlaps: true };
      }
    }
  }
}

/** Voies qui partent d'un aiguillage : droite, en biais, en retour, ou fourche avec un aiguillage en Y. */
const spurs = (n: number): Elem[][] => [
  ["R", END],
  ["RC", END],
  [{ run: 108 }, END],
  ["R", { run: 108 }, END],
  ["C", { run: 108 }, END],
  [{ run: 216 }, END],
  [{ run: 432 }, END],
  ["R", { run: 216 }, END],
  ["C", { run: 324 }, END],
  [{ run: 108 }, "RR", { run: 216 }, END],
  [{ run: 108 }, "CC", { run: 108 }, END],
  ["R", { run: 108 }, "C", { run: 216 }, END],
  [{ run: 108 }, { tag: `j${n}`, token: "J" }, { run: 216 }, END, { jump: `j${n}`, connector: 2 }, { run: 216 }, END],
];

/**
 * Villes des trains : sur un circuit déjà vérifié, on ajoute 2 à 4 embranchements, à l'intérieur
 * comme à l'extérieur, qui partent dans tous les sens vers des gares. Tirés au hasard (toujours les mêmes).
 */
function* megas(base: Template, free: Inventory, rand: () => number, count: number): Generator<Template> {
  const runs = base.elems.flatMap((e, i) =>
    typeof e === "object" && "run" in e && !e.elevated && e.run >= 252 ? [i] : [],
  );
  // Aiguillages encore libres (un de plus peut manquer) : chacun ouvre un embranchement.
  // L'aiguillage retourné ne sert pas ici : sa branche finit par un trou, il faudrait un adaptateur.
  const switchIds = ["switch", "switch-small"];
  const switchCount = switchIds.reduce((s, id) => s + Math.max(0, free[id] ?? 0), 1);
  const most = Math.min(4, runs.length, switchCount);
  if (most < 2) return;
  for (let n = 0; n < count; n++) {
    const wanted = 2 + Math.floor(rand() * (most - 1));
    const chosen = [...runs]
      .sort(() => rand() - 0.5)
      .slice(0, wanted)
      .sort((a, b) => b - a);
    const left = { ...free };
    let elems: Elem[] | null = base.elems;
    chosen.forEach((runIndex, k) => {
      if (!elems) return;
      // De préférence un aiguillage qu'on possède encore.
      const all = ["w", "W", "n", "N"];
      const owned = all.filter((t) => (left[TOKENS[t].pieceTypeId] ?? 0) > 0);
      const choices = owned.length ? owned : ["w", "W"];
      const sw = choices[Math.floor(rand() * choices.length)];
      left[TOKENS[sw].pieceTypeId] = (left[TOKENS[sw].pieceTypeId] ?? 0) - 1;
      const run = (elems[runIndex] as { run: number }).run;
      const before = [0, nearestRun((run - SWITCH_LENGTH[sw]) / 2)][Math.floor(rand() * 2)];
      const options = spurs(k);
      elems = withBranch(elems, runIndex, before, sw, options[Math.floor(rand() * options.length)], `m${k}`);
    });
    if (elems) yield { family: "mega", elems, checkOverlaps: true };
  }
}

/** Formes sur lesquelles on pose collines, voies de garage, terminus, fourches et gares de triage. */
const SHAPED = new Set<Family>(["wander", "l-shape", "u-shape", "bean", "triangle", "house", "octagon", "serpent"]);

/** Indices des plus longues lignes droites au sol d'un gabarit (au moins `min` mm). */
function longestRuns(elems: Elem[], min: number, count: number): number[] {
  return elems
    .flatMap((e, i) => (typeof e === "object" && "run" in e && !e.elevated && e.run >= min ? [i] : []))
    .sort((a, b) => (elems[b] as { run: number }).run - (elems[a] as { run: number }).run)
    .slice(0, count);
}

/**
 * Sur une forme libre déjà vérifiée : une colline (un côté monte sur un pont), une voie de garage,
 * un terminus, une fourche ou une gare de triage. Les branches partent vers l'extérieur (w) ou l'intérieur (W).
 */
function* derived(base: Template): Generator<Template> {
  const replace = (i: number, by: Elem[]) => [...base.elems.slice(0, i), ...by, ...base.elems.slice(i + 1)];
  for (const i of longestRuns(base.elems, 252, 3)) {
    const run = (base.elems[i] as { run: number }).run;
    // Colline : rail montant, voie en hauteur, rail descendant.
    for (const side of [0, 108]) {
      const top = run - 432 - 2 * side;
      if (top < 108 || !RUN_LENGTHS.includes(top)) continue;
      const high: Elem[] = [{ run: top, elevated: true }];
      yield {
        family: "hill",
        elems: replace(i, [{ run: side }, "U", ...high, "V", { run: side }]),
        checkOverlaps: true,
      };
    }
    for (const sw of ["w", "W", "n"]) {
      // La branche tourne du côté de l'aiguillage ; « back » la remet parallèle à la voie.
      const away = sw === "W" ? "C" : "R";
      const back = sw === "W" ? "R" : "C";
      const before = nearestRun((run - SWITCH_LENGTH[sw]) / 2);
      const branch = (family: Family, spur: Elem[]) => {
        const elems = withBranch(base.elems, i, before, sw, spur);
        return elems ? [{ family, elems, checkOverlaps: true }] : [];
      };
      yield* branch("siding", [back, { run: 216 }, END]);
      yield* branch("siding", [back, { run: 432 }, END]);
      yield* branch("terminus", [{ run: 324 }, END]);
      yield* branch("terminus", [away, { run: 216 }, END]);
      yield* branch("fork", [
        { run: 108 },
        { tag: "y", token: "J" },
        { run: 216 },
        END,
        { jump: "y", connector: 2 },
        { run: 216 },
        END,
      ]);
      // Gare de triage : deux aiguillages à la suite sur la même ligne droite, deux voies sans issue.
      const rest = run - 2 * SWITCH_LENGTH[sw] - 108;
      if (rest >= 0 && RUN_LENGTHS.includes(rest)) {
        yield {
          family: "yard",
          elems: replace(i, [{ tag: "a", token: sw }, { run: 108 }, { tag: "b", token: sw }, { run: rest }]).concat([
            // La première voie s'écarte, la seconde file parallèle vers l'avant : elles ne se croisent pas.
            { jump: "a", connector: 2 },
            away,
            { run: 216 },
            END,
            { jump: "b", connector: 2 },
            back,
            { run: 324 },
            END,
          ]),
          checkOverlaps: true,
        };
      }
    }
  }
}

/** Circuits auxquels on ajoute un embranchement pour en faire un grand réseau. */
const NETWORK_BASES = new Set<Family>([
  "hill",
  "eight-bridge",
  "eight-crossing",
  "passing-loop",
  "serpent",
  "theta",
  "spiral",
  "lift",
]);

// ---------------------------------------------------------------------------------------------
// Raccourcis : relier deux points d'une boucle par une nouvelle voie

/** Boucles sur lesquelles on cherche des raccourcis. */
const LINKABLE = new Set<Family>(["wander", "l-shape", "u-shape", "bean", "house", "octagon", "triangle"]);

/** Suites de virages essayées pour la nouvelle voie (k : courbe à gauche, K : à droite). */
const LINK_TURNS = (k: string, K: string): string[][] => [
  [],
  [k + k],
  [K + K],
  [k],
  [K],
  [k, K],
  [K, k],
  [k + k, K + K],
  [K + K, k + k],
  [k, k],
  [K, K],
  [k + k, k + k],
  [K + K, K + K],
];

/**
 * Trouve les longueurs des lignes droites d'une voie qui part de `from` (position, cap) et arrive
 * en `to` avec le cap `toHeading`, en passant par les virages donnés. Deux lignes droites sont calculées,
 * les autres valent `fill`. Renvoie les éléments du gabarit, ou null si impossible.
 */
function solveLink(
  from: { x: number; y: number; heading: number },
  to: { x: number; y: number; heading: number },
  turns: string[],
  fill: number,
): Elem[] | null {
  const n = turns.length + 1;
  // Directions de chaque ligne droite et position d'arrivée avec toutes les lignes à `fill`.
  const dirs: [number, number][] = [];
  let { x, y, heading } = from;
  for (let i = 0; i < n; i++) {
    dirs.push([Math.cos(deg(heading)), Math.sin(deg(heading))]);
    x += dirs[i][0] * fill;
    y += dirs[i][1] * fill;
    if (i < turns.length) {
      const move = turnMove(turns[i], heading);
      x += move.dx;
      y += move.dy;
      heading = move.heading;
    }
  }
  if (Math.round(((heading - to.heading) % 360) + 360) % 360 !== 0) return null;
  const gx = to.x - x;
  const gy = to.y - y;
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      const [ax, ay] = dirs[a];
      const [bx, by] = dirs[b];
      const det = ax * by - ay * bx;
      if (Math.abs(det) < 1e-6) continue;
      const ua = (gx * by - gy * bx) / det + fill;
      const ub = (ax * gy - ay * gx) / det + fill;
      const ra = nearestRun(ua);
      const rb = nearestRun(ub);
      if (ua < -3 || ub < -3 || Math.abs(ra - ua) > 16 || Math.abs(rb - ub) > 16) continue;
      const runs = Array.from({ length: n }, (_, i) => (i === a ? ra : i === b ? rb : fill));
      return turns.flatMap((turn, i): Elem[] => [{ run: runs[i] }, turn]).concat([{ run: runs[n - 1] }]);
    }
  }
  return null;
}

/** Stock illimité de rails droits : sert seulement à calculer la géométrie d'un gabarit. */
const ENDLESS: Inventory = Object.fromEntries(ELEVATED_STRAIGHTS.map((t) => [t.id, 99]));

/**
 * Raccourcis d'une boucle : on coupe deux lignes droites pour y mettre un aiguillage (qui sépare les voies)
 * et un aiguillage retourné (qui les réunit), puis une nouvelle voie relie l'un à l'autre,
 * à l'intérieur ou à l'extérieur de la boucle.
 */
function* linkTemplates(base: Template, catalog: Catalog, maxRun: number): Generator<Template> {
  // Les cinq plus longues lignes droites au sol (une forme libre en a beaucoup : on reste rapide).
  const runIndexes = base.elems
    .flatMap((e, i) => (typeof e === "object" && "run" in e && !e.elevated && e.run >= 144 ? [i] : []))
    .sort((a, b) => (base.elems[b] as { run: number }).run - (base.elems[a] as { run: number }).run)
    .slice(0, 5)
    .sort((a, b) => a - b);
  // Voie d'évitement : on se sépare au début d'une ligne droite et on se rejoint à la fin.
  for (const i of runIndexes) {
    const run = (base.elems[i] as { run: number }).run;
    // Plusieurs écartements entre les deux aiguillages : la nouvelle voie trouve ses rails plus facilement.
    for (const rest of [0, 108, 216]) {
      const mid = run - 288 - rest;
      if (mid < 216 || !RUN_LENGTHS.includes(mid)) continue;
      for (const [diverge, merge] of [
        ["W", "y"],
        ["w", "Y"],
      ]) {
        const elems: Elem[] = base.elems.flatMap((e, n): Elem[] =>
          n === i ? [{ tag: "a", token: diverge }, { run: mid }, { tag: "b", token: merge }, { run: rest }] : [e],
        );
        yield* links(elems, "passing-loop", catalog, maxRun);
      }
    }
  }
  const splits = (run: number) =>
    [0, nearestRun((run - 144) / 2), run - 144].filter(
      (p, n, all) => all.indexOf(p) === n && RUN_LENGTHS.includes(run - 144 - p),
    );
  for (const i of runIndexes) {
    for (const j of runIndexes) {
      if (j <= i) continue;
      const ri = (base.elems[i] as { run: number }).run;
      const rj = (base.elems[j] as { run: number }).run;
      for (const [diverge, merge] of [
        ["W", "y"],
        ["w", "Y"],
      ]) {
        for (const pi of splits(ri)) {
          for (const pj of splits(rj)) {
            const elems: Elem[] = base.elems.flatMap((e, n): Elem[] =>
              n === i
                ? [{ run: pi }, { tag: "a", token: diverge }, { run: ri - 144 - pi }]
                : n === j
                  ? [{ run: pj }, { tag: "b", token: merge }, { run: rj - 144 - pj }]
                  : [e],
            );
            yield* links(elems, "theta", catalog, maxRun);
          }
        }
      }
    }
  }
}

/** Pose la boucle (avec un stock illimité de rails droits), puis cherche les voies qui relient l'aiguillage « a » à « b ». */
function* links(elems: Elem[], family: Family, catalog: Catalog, maxRun: number): Generator<Template> {
  const tags: Record<string, number> = {};
  const tokens = expandWithTags(elems, tags);
  if (tokens === null) return;
  let placements: Placement[];
  try {
    placements = chain(tokensToSteps(tokens), catalog);
  } catch {
    return;
  }
  const pa = placements[tags.a - 1];
  const pb = placements[tags.b - 1];
  const a = transform(pa, getPiece(catalog, pa.pieceTypeId))[2];
  const b = transform(pb, getPiece(catalog, pb.pieceTypeId))[2];
  const from = { x: a.x, y: a.y, heading: a.angle };
  const to = { x: b.x, y: b.y, heading: b.angle + 180 };
  for (const k of ["C", "c"]) {
    const K = k === "C" ? "R" : "r";
    for (const turns of LINK_TURNS(k, K)) {
      for (const fill of [0, 108]) {
        const path = solveLink(from, to, turns, fill);
        if (!path || maxRunOf(path) > maxRun) continue;
        yield { family, elems: [...elems, { jump: "a", connector: 2 }, ...path], checkOverlaps: true };
      }
    }
  }
}

/** Développe un gabarit avec un stock illimité (géométrie seulement) et note la position des repères. */
function expandWithTags(elems: Elem[], tags: Record<string, number>): string | null {
  const pool = { ...ENDLESS };
  const out = expand(elems, pool, {}, 0);
  if (out === null) return null;
  let count = 0;
  for (const e of elems) {
    if (typeof e === "string") count += e.replace(OPEN_END, "").length;
    else if ("run" in e) count += composeRun(e.run, e.elevated ?? false, { ...ENDLESS }, {}, 0)?.length ?? 0;
    else if ("tag" in e) tags[e.tag] = ++count;
    else if ("end" in e) count += 1;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Génération

export type Size = "small" | "medium" | "large" | "huge";

export interface GeneratorOptions {
  /** Tailles acceptées (toutes si vide). */
  sizes?: Size[];
  /** Exiger un pont, un aiguillage, un croisement. */
  require?: { bridge?: boolean; switches?: boolean; crossing?: boolean; stations?: boolean };
  /** Familles acceptées (toutes si vide). */
  families?: Family[];
  /** Placer tunnels, gares, signaux… disponibles. */
  decorate?: boolean;
  /** Nombre maximal de pièces manquantes pour un circuit « presque réalisable ». */
  maxMissing?: number;
  /** Nombre maximal de propositions par catégorie. */
  limit?: number;
  /** Profondeur de recherche (1 par défaut) : chaque niveau en plus cherche et montre deux fois plus de circuits. */
  depth?: number;
  /** « max » : d'abord les circuits qui utilisent le plus de pièces possédées ; « simple » : les plus faciles. */
  sort?: "max" | "simple" | "pieces";
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
  return pieces <= 12 ? "small" : pieces <= 20 ? "medium" : pieces <= 40 ? "large" : "huge";
}

const FAMILY_CAP = 60;
/** Familles tirées au hasard : beaucoup plus de circuits différents. */
const ABUNDANT = new Set<Family>(["wander", "mega"]);
/** Simples boucles : proposées après les formes qui partent dans tous les sens. */
const PLAIN = new Set<Family>(["circle", "oval", "rectangle"]);

/** Pièces qui ne sont pas des rails : décors, bâtiments, trains. */
const NOT_TRACK = new Set(["accessory", "building", "vehicle"]);

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
    } else if ("end" in e) {
      if ((pool["buffer-stop"] ?? 0) > 0) {
        pool["buffer-stop"]--;
        out += "Z";
        count += 1;
      } else out += OPEN_END;
    } else {
      out += `@${tags[e.jump]}.${e.connector}`;
    }
  }
  return out;
}

/** Bouts des voies sans issue (butoirs et extrémités ouvertes), pour y placer les gares. */
export function deadEnds(placements: Placement[], report: ClosureReport, catalog: Catalog): [number, number][] {
  const ends: [number, number][] = report.openConnectors.map((c) => [c.x, c.y]);
  for (const p of placements) {
    if (catalog[p.pieceTypeId]?.category === "buffer") ends.push([p.x, p.y]);
  }
  return ends;
}

/** Place les accessoires disponibles le long des lignes droites au sol ; gares et plaque tournante au bout des voies. */
function decorate(
  placements: Placement[],
  available: Inventory,
  ends: [number, number][] = [],
  catalog?: Catalog,
): { codes: string[]; list: AccessoryPlacement[] } {
  const ground = placements
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !p.level && ["straight-long", "straight-medium", "straight-short"].includes(p.pieceTypeId));
  const curves = placements.map((p, i) => ({ p, i })).filter(({ p }) => p.pieceTypeId.startsWith("curve"));
  const used = new Set<number>();
  const codes: string[] = [];
  const list: AccessoryPlacement[] = [];
  const put = (letter: AccessoryLetter, candidates: { p: Placement; i: number }[], qty: number) => {
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
  const distance = ({ p }: { p: Placement }) => Math.min(...ends.map(([x, y]) => Math.hypot(p.x - x, p.y - y)));
  const nearEnds = ends.length ? [...ground].sort((a, b) => distance(a) - distance(b)) : [...ground].reverse();
  // Gares et bâtiments d'abord, au bout des voies sans issue (sinon le long de la ligne), chacun différent.
  // Le plus possible de ce qu'on possède : chaque gare et bâtiment différent, puis les autres décors.
  let buildings = 0;
  const maxBuildings = Math.min(6, Math.max(3, ends.length + 2));
  for (const letter of ["G", "H", "F", "P", "E", "R", "D"] as AccessoryLetter[]) {
    const qty = Math.min(available[ACCESSORY_CODES[letter]] ?? 0, letter === "G" ? 3 : 1, maxBuildings - buildings);
    put(letter, nearEnds, qty);
    buildings += qty;
  }
  if (ends.length) put("O", nearEnds, Math.min(available.turntable ?? 0, 1));
  // Le tunnel va de préférence sous le pont : la voie du bas passe dessous.
  const middle = (p: Placement) => {
    const track = catalog ? transformTracks(p, getPiece(catalog, p.pieceTypeId))[0] : undefined;
    return track ? track[Math.floor(track.length / 2)] : [p.x, p.y];
  };
  const high = placements.filter((p) => (p.level ?? 0) > 0).map(middle);
  const underBridge = ground.filter(({ p }) => {
    const [x, y] = middle(p);
    return high.some(([hx, hy]) => Math.hypot(hx - x, hy - y) < 120);
  });
  put("T", [...underBridge, ...longFirst], Math.min(available.tunnel ?? 0, 2));
  put("Q", ground, Math.min(available.crane ?? 0, 2));
  put("B", ground, Math.min(available["signal-box"] ?? 0, 1));
  put("I", ground, Math.min(available.signal ?? 0, 2));
  put("L", ground, Math.min(available["traffic-light"] ?? 0, 2));
  put(
    "A",
    curves.filter((_, n) => n % 2 === 1),
    Math.min(available.tree ?? 0, 6),
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
  const depth = Math.max(1, options.depth ?? 1);
  const familyCap = FAMILY_CAP * 2 ** (depth - 1);
  const perFamilyShown = 12 * 2 ** (depth - 1);
  const straightLength =
    GROUND_STRAIGHTS.reduce((s, t) => s + t.length * (inventory[t.id] ?? 0), 0) +
    216 * (inventory["suspension-bridge"] ?? 0);
  const maxRun = Math.min(MAX_RUN, straightLength / 2 + 216 * maxMissing);
  const totalOwned = Object.entries(inventory)
    .filter(([id]) => !NOT_TRACK.has(catalog[id]?.category ?? "accessory"))
    .reduce((s, [, q]) => s + q, 0);

  const seen = new Set<string>();
  const results: GeneratedLayout[] = [];

  // Au-delà de quelques dizaines de circuits par famille, on n'en montrerait pas plus : on s'arrête là.
  const perFamily = new Map<string, number>();
  const full = (family: Family, kind: string) =>
    (perFamily.get(`${family}:${kind}`) ?? 0) >= familyCap * (ABUNDANT.has(family) && kind === "buildable" ? 4 : 1);
  const all = function* () {
    yield* templates(maxRun);
    yield* crooked(inventory, maxRun);
    yield* wanders(inventory, maxMissing, maxRun, straightLength, 400 * depth);
  };
  const templateOf = new Map<GeneratedLayout, Template>();
  const hiddenSet = new Set<GeneratedLayout>();
  // Raccourcis, grands réseaux et villes des trains partent d'autres circuits : on les cherche aussi, sans les montrer.
  const wanted = (family: Family) => !options.families?.length || options.families.includes(family);
  const process = (template: Template): GeneratedLayout | null => {
    if (full(template.family, "buildable") && full(template.family, "almost")) return null;
    // Plus de lignes droites que de rails disponibles : inutile d'essayer.
    const runTotal = template.elems.reduce((sum, e) => sum + (typeof e === "object" && "run" in e ? e.run : 0), 0);
    if (runTotal > straightLength + 216 * maxMissing) return null;
    // Pièces fixes : on écarte d'emblée ce qui manque trop.
    const fixedMissing = Object.entries(fixedNeeds(template.elems)).reduce(
      (s, [id, q]) => s + Math.max(0, q - (inventory[id] ?? 0)),
      0,
    );
    if (fixedMissing > maxMissing) return null;

    const pool = { ...inventory };
    const missing: Inventory = {};
    const tokens = expand(template.elems, pool, missing, maxMissing);
    if (tokens === null) return null;
    const code = `${template.family}:${tokens}`;
    if (seen.has(code)) return null;
    seen.add(code);

    let placements: Placement[];
    try {
      placements = chain(tokensToSteps(tokens), catalog);
    } catch {
      return null;
    }
    const report = analyzeJoints(placements, catalog);
    if (!isComplete(report, tokens)) return null;

    const bom = fullBillOfMaterials(placements, catalog);
    // Les ponts empilables portent la voie comme des piliers : on les utilise d'abord.
    const stacked = Math.min(inventory["stacking-bridge"] ?? 0, bom.support ?? 0);
    if (stacked > 0) {
      bom["stacking-bridge"] = stacked;
      bom.support -= stacked;
      if (bom.support === 0) delete bom.support;
    }
    const lacking: Inventory = {};
    for (const [id, need] of Object.entries(bom)) {
      const lack = need - (inventory[id] ?? 0);
      if (lack > 0) lacking[id] = lack;
    }
    const missingCount = countOf(lacking);
    if (missingCount > maxMissing) return null;

    const pieces = placements.length;
    const size = sizeOf(pieces);
    const features = featuresOf(tokens);
    const req = options.require ?? {};
    // Un circuit qui ne correspond pas aux réglages n'est pas montré, mais sert de base aux autres
    // (une colline se pose sur une forme libre, même si on ne veut voir que des ponts).
    const hidden =
      !wanted(template.family) ||
      (options.sizes?.length && !options.sizes.includes(size)) ||
      (req.bridge && !features.bridge) ||
      (req.switches && !features.switches) ||
      (req.crossing && !features.crossing) ||
      (req.stations && !/[|Z]/.test(tokens));
    const kind = missingCount === 0 ? "buildable" : "almost";
    if (full(template.family, kind)) return null;
    // Le test de chevauchement est le plus coûteux : on le fait en dernier.
    if (template.checkOverlaps && overlaps(placements, catalog, true).length > 0) return null;

    let accessories: AccessoryPlacement[] = [];
    let fullCode = code;
    if (options.decorate) {
      const deco = decorate(placements, inventory, deadEnds(placements, report, catalog), catalog);
      accessories = deco.list;
      if (deco.codes.length) fullCode = `${code}~${deco.codes.join(".")}`;
    }
    // Les gares, tunnels et décors posés font partie des pièces à sortir de la caisse.
    for (const a of accessories) bom[a.kind] = (bom[a.kind] ?? 0) + 1;

    const special = Number(features.bridge) + Number(features.switches) + Number(features.crossing);
    const deadEndCount = openEndCount(tokens) + (bom["buffer-stop"] ?? 0);
    // Pièces spéciales utilisées (aiguillages, rampes, ponts, ascenseur…) : plus il y en a, mieux c'est.
    const specials = Object.keys(bom).filter(
      (id) => !["straight", "curve"].includes(catalog[id]?.category ?? "straight"),
    ).length;
    const usage = totalOwned > 0 ? Math.min(1, (pieces - missingCount) / totalOwned) : 0;
    perFamily.set(`${template.family}:${kind}`, (perFamily.get(`${template.family}:${kind}`) ?? 0) + 1);
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
      difficulty: difficultyOf(pieces, features),
      minutes: minutesOf(pieces, features),
      score:
        (options.sort === "simple"
          ? -pieces * 0.15
          : options.sort === "pieces"
            ? pieces * 0.2
            : usage * 6 + accessories.length * 0.15 + specials * 0.7) +
        special * 0.8 +
        Math.min(deadEndCount, 4) * 0.3 +
        (PLAIN.has(template.family) ? -1.5 : ABUNDANT.has(template.family) ? 0.5 : 0) +
        (report.maxGap < 1 ? 0.3 : 0) -
        missingCount * 0.5,
    });
    templateOf.set(results[results.length - 1], template);
    if (hidden) hiddenSet.add(results[results.length - 1]);
    return results[results.length - 1];
  };

  for (const template of all()) process(template);

  // Collines, voies de garage, terminus, fourches et gares de triage : posés sur les plus belles formes libres,
  // quelques-unes de chaque famille de forme.
  const shapedBases = (count: number) => {
    const taken = new Map<Family, number>();
    return results
      .filter((r) => SHAPED.has(r.family))
      .sort((a, b) => a.missingCount - b.missingCount || b.score - a.score)
      .filter((r) => {
        taken.set(r.family, (taken.get(r.family) ?? 0) + 1);
        return taken.get(r.family)! <= count * (r.family === "wander" ? 3 : 1);
      });
  };
  // Plus quelques formes « presque réalisables » avec une longue ligne droite : les rails montants et le pont
  // y remplacent les rails droits qui manquaient.
  const longRun = (r: GeneratedLayout) => maxRunOf(templateOf.get(r)!.elems) >= 540;
  const withLongRun = results
    .filter((r) => SHAPED.has(r.family) && r.missingCount > 0 && longRun(r))
    .sort((a, b) => a.missingCount - b.missingCount || b.score - a.score)
    .slice(0, 12 * depth);
  for (const base of new Set([...shapedBases(3 * depth), ...withLongRun])) {
    for (const template of derived(templateOf.get(base)!)) process(template);
  }

  // Raccourcis : on relie deux points des plus belles boucles par une nouvelle voie (aiguillages).
  if (!options.families?.length || options.families.includes("theta") || options.families.includes("passing-loop")) {
    const linkable = results.filter((r) => LINKABLE.has(r.family)).sort((a, b) => b.score - a.score);
    // Les plus belles, et celles qui ont une longue ligne droite (voie d'évitement).
    const bases = new Set([
      ...linkable.slice(0, 8 * depth),
      // (les plus petites d'abord : il reste des rails pour la nouvelle voie)
      ...linkable
        .filter((r) => maxRunOf(templateOf.get(r)!.elems) >= 504)
        .sort((a, b) => a.missingCount - b.missingCount || a.pieces - b.pieces)
        .slice(0, 6 * depth),
    ]);
    for (const base of bases) {
      for (const template of linkTemplates(templateOf.get(base)!, catalog, maxRun)) process(template);
    }
  }

  // Grands réseaux : aux plus beaux circuits (pont, huit, raccourci…), on ajoute un embranchement vers une gare.
  if (!options.families?.length || options.families.includes("network")) {
    const bases = results
      .filter((r) => NETWORK_BASES.has(r.family))
      .sort((a, b) => b.score - a.score)
      .slice(0, 16 * depth);
    for (const base of bases) for (const template of networks(templateOf.get(base)!)) process(template);
  }

  // Villes des trains : plusieurs embranchements sur les plus beaux circuits, toutes formes confondues.
  if (!options.families?.length || options.families.includes("mega")) {
    const rand = seeded(1018);
    // Les deux plus beaux circuits de chaque famille, en commençant par ceux qui ont le moins d'aiguillages.
    const switchesIn = (r: GeneratedLayout) =>
      (r.bom.switch ?? 0) + (r.bom["switch-small"] ?? 0) + (r.bom["switch-reverse"] ?? 0);
    const taken = new Map<Family, number>();
    // Il faut aussi des rails libres pour les embranchements.
    const freeTrack = (r: GeneratedLayout) =>
      GROUND_STRAIGHTS.reduce((s, t) => s + t.length * Math.max(0, (inventory[t.id] ?? 0) - (r.bom[t.id] ?? 0)), 0);
    const bases = results
      .filter((r) => r.missingCount === 0 && r.family !== "mega" && r.family !== "line" && freeTrack(r) >= 648)
      .sort((a, b) => switchesIn(a) - switchesIn(b) || b.score - a.score)
      .filter((r) => {
        taken.set(r.family, (taken.get(r.family) ?? 0) + 1);
        return taken.get(r.family)! <= depth;
      });
    // Et les plus grands circuits : avec des embranchements, ils dépassent la centaine de pièces.
    const largest = results
      .filter((r) => r.missingCount === 0 && r.family !== "mega" && r.family !== "line" && !bases.includes(r))
      .sort((a, b) => b.pieces - a.pieces)
      .slice(0, 4 * depth);
    for (const base of [...bases, ...largest]) {
      const free: Inventory = { ...inventory };
      for (const [id, q] of Object.entries(base.bom)) free[id] = (free[id] ?? 0) - q;
      for (const template of megas(templateOf.get(base)!, free, rand, 16)) process(template);
    }
  }

  const pick = (list: GeneratedLayout[]) => {
    // Variété : au plus 12 circuits par famille, tous différents ; on alterne les familles.
    const byFamily = new Map<Family, GeneratedLayout[]>();
    for (const r of [...list].sort((a, b) => b.score - a.score)) {
      const group = byFamily.get(r.family) ?? [];
      // Deux circuits sont « pareils » s'ils ont le même nombre de pièces et la même suite de virages.
      const turns = (c: GeneratedLayout) => c.code.split("~")[0].replace(/[^CRcr@]/g, "");
      const similar = group.some((g) => g.pieces === r.pieces && turns(g) === turns(r));
      if (!similar && group.length < perFamilyShown * (ABUNDANT.has(r.family) ? 3 : 1)) group.push(r);
      byFamily.set(r.family, group);
    }
    const out: GeneratedLayout[] = [];
    const queues = [...byFamily.values()].filter((q) => q.length).sort((a, b) => b[0].score - a[0].score);
    while (out.length < limit && queues.some((q) => q.length)) {
      for (const q of queues) {
        // Les formes libres et les villes des trains passent deux fois par tour.
        for (let turn = 0; turn < (q[0] && ABUNDANT.has(q[0].family) ? 2 : 1); turn++) {
          const next = q.shift();
          if (next && out.length < limit) out.push(next);
        }
      }
    }
    return out;
  };
  const shown = results.filter((r) => !hiddenSet.has(r));
  const buildable = shown.filter((r) => r.missingCount === 0);
  // Tri par nombre de pièces : la sélection reste variée, puis on range du plus grand au plus petit.
  const order = (list: GeneratedLayout[]) =>
    options.sort === "pieces" ? [...list].sort((a, b) => b.pieces - a.pieces) : list;
  return {
    total: { buildable: buildable.length, almost: shown.length - buildable.length },
    buildable: order(pick(buildable)),
    almost: order(pick(shown.filter((r) => r.missingCount > 0)).sort((a, b) => a.missingCount - b.missingCount)),
  };
}
