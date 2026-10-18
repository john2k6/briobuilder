import { analyzeJoints, type ClosureReport } from "./connect";
import { chain, type ChainStep } from "./chain";
import { getPiece, transformTracks } from "./geometry";
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
  | "lift";

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
];

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

const RADIUS = { C: 202, c: 110 } as const;

/** Longueur de ligne droite réalisable la plus proche. */
function nearestRun(length: number): number {
  return RUN_LENGTHS.reduce((best, l) => (Math.abs(l - length) < Math.abs(best - length) ? l : best), 0);
}

// Formes libres : une suite de virages (lettres de courbes) séparés par des lignes droites.
// Deux lignes droites (« x » et « y ») sont calculées pour que la forme se referme.

const CURVE_TURN: Record<string, { radius: number; turn: 1 | -1 }> = {
  C: { radius: 202, turn: 1 },
  R: { radius: 202, turn: -1 },
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
    if (solved[key] < -3 || Math.abs(run - solved[key]) > 6) return null;
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
function withBranch(loop: Elem[], runIndex: number, before: number, sw: string, branch: Elem[]): Elem[] | null {
  const run = loop[runIndex];
  if (typeof run !== "object" || !("run" in run)) return null;
  const after = run.run - before - SWITCH_LENGTH[sw];
  if (after < 0 || !RUN_LENGTHS.includes(after)) return null;
  return [
    ...loop.slice(0, runIndex),
    { run: before },
    { tag: "br", token: sw },
    { run: after },
    ...loop.slice(runIndex + 1),
    { jump: "br", connector: 2 },
    ...branch,
  ];
}

const END: Elem = { end: true };

function* templates(maxRun: number): Generator<Template> {
  // Du plus grand au plus petit : les grands circuits, qui utilisent le plus de pièces, passent en premier.
  const runs = RUN_LENGTHS.filter((l) => l <= maxRun).reverse();
  const positive = runs.filter((l) => l > 0);
  const upTo = (max: number) => runs.filter((l) => l <= max);

  // Huit avec croisement : deux boucles de 270° autour du croisement, de tailles et de courbes différentes.
  // Boucle : ligne p, virage, ligne u, virage, ligne w, virage, ligne q ; w et q se déduisent de p et u.
  const loop270 = (curve: "C" | "c" | "R" | "r", p: number, u: number): Elem[] | null => {
    const radius = curve === "C" || curve === "R" ? RADIUS.C : RADIUS.c;
    const w = p + 108 - radius;
    const q = u + radius - 108;
    const [w2, q2] = [nearestRun(w), nearestRun(q)];
    if (w < -3 || Math.abs(w2 - w) > 6 || Math.abs(q2 - q) > 6) return null;
    const c2 = curve + curve;
    return [{ run: p }, c2, { run: u }, c2, { run: w2 }, c2, { run: q2 }];
  };
  // Pour chaque type de courbe, quelques boucles réalisables (du plus grand au plus petit).
  const loopsFor = (curve: "C" | "c" | "R" | "r") => {
    const sizes = RUN_LENGTHS.filter((l) => l <= Math.min(432, maxRun)).reverse();
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
      for (const s of [432, 324, 216, 108]) {
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

    // Formes libres : L, U, haricot, triangle, maison, octogone.
    const K2 = r + r;
    const shapes: { family: Family; turns: string[]; runs: (string | number)[]; params: Record<string, number[]> }[] = [
      {
        family: "l-shape",
        turns: [k2, k2, K2, k2, k2, k2],
        runs: ["x", "a", "b", "c", "d", "y"],
        params: { a: [108, 216, 324], b: [108, 216, 324], c: [108, 216], d: [108, 216, 324] },
      },
      {
        family: "u-shape",
        turns: [k2, k2, k2, K2, K2, k2, k2, k2],
        runs: ["x", "a", "b", "c", "d", "c", "b", "y"],
        params: { a: [216, 324, 432], b: [0, 108, 216], c: [108, 216], d: [108, 216, 324] },
      },
      {
        family: "bean",
        turns: [k, r, r, k, k2, k2, k2, k2],
        runs: ["a", "d", "b", "d", "a", "h", "x", "y"],
        params: { a: [108, 216], d: [0, 108], b: [0, 108, 216], h: [108, 216, 324] },
      },
      { family: "triangle", turns: [k2, k + k2, k + k2], runs: ["a", "x", "y"], params: { a: [216, 324, 432, 648] } },
      {
        family: "house",
        turns: [k2, k, k2, k, k2],
        runs: ["a", "h", "x", "y", "h"],
        params: { a: [108, 216, 324, 432], h: [108, 216, 324] },
      },
      {
        family: "octagon",
        turns: Array(8).fill(k),
        runs: ["s", "s", "s", "s", "s", "s", "x", "y"],
        params: { s: [54, 108, 144, 216] },
      },
    ];
    for (const { family, turns, runs: shapeRuns, params } of shapes) {
      for (const values of combos(params)) {
        const elems = shape(turns, shapeRuns, values);
        if (elems && maxRunOf(elems) <= maxRun) yield { family, elems, checkOverlaps: true };
      }
    }

    // Lignes avec embranchements, au départ d'un ovale ou d'un rectangle.
    const loops: Elem[][] = [];
    for (const a of positive.filter((l) => l >= 216 && l <= 864 && l % 36 === 0)) {
      loops.push([k4, { run: a }, k4, { run: a }]);
      for (const b of [108, 216].filter((l) => l <= a)) {
        loops.push([k2, { run: a }, k2, { run: b }, k2, { run: a }, k2, { run: b }]);
      }
    }
    for (const loop of loops) {
      const runIndex = loop.length - 1; // la dernière ligne droite : l'embranchement part vers l'extérieur
      const length = (loop[runIndex] as { run: number }).run;
      // w, n : aiguillage vers l'extérieur ; Y : aiguillage « retourné », la branche part vers l'arrière.
      for (const sw of ["w", "n", "Y"]) {
        for (const before of [0, 108].filter((l) => l <= length - SWITCH_LENGTH[sw])) {
          // Terminus : une voie qui finit en gare (en biais, perpendiculaire ou parallèle).
          for (const turn of ["", r, k]) {
            for (const s of [216, 324, 432]) {
              const elems = withBranch(loop, runIndex, before, sw, [turn, { run: s }, END]);
              if (elems) yield { family: "terminus", elems, checkOverlaps: true };
            }
          }
          // Fourche : la branche se sépare en deux voies sans issue grâce à l'aiguillage en Y.
          for (const s of [108, 216]) {
            for (const s2 of [108, 216]) {
              const elems = withBranch(loop, runIndex, before, sw, [
                { run: s },
                { tag: "y", token: "J" },
                { run: s2 },
                END,
                { jump: "y", connector: 2 },
                { run: s2 },
                END,
              ]);
              if (elems) yield { family: "fork", elems, checkOverlaps: true };
            }
          }
        }
      }
      // Gare de triage : deux aiguillages à la suite, deux voies sans issue.
      if (length >= 432) {
        for (const gapRun of [108, 216]) {
          const rest = length - 288 - gapRun;
          if (rest < 0 || !RUN_LENGTHS.includes(rest)) continue;
          for (const [first, second] of [
            ["w", "w"],
            ["w", "Y"],
          ]) {
            for (const s of [108, 216, 324]) {
              yield {
                family: "yard",
                elems: [
                  ...loop.slice(0, runIndex),
                  { tag: "a", token: first },
                  { run: gapRun },
                  { tag: "b", token: second },
                  { run: rest },
                  { jump: "a", connector: 2 },
                  "C",
                  { run: s },
                  END,
                  { jump: "b", connector: 2 },
                  second === "w" ? r : "",
                  { run: s },
                  END,
                ],
                checkOverlaps: true,
              };
            }
          }
        }
      }
    }

    // Ligne d'une gare à l'autre : pas de boucle, deux voies sans issue, avec 1 à 3 virages
    // (coude, S, U, zigzag…) choisis parmi les courbes disponibles.
    const bends = [k, r, k2, K2, k + k + k, k4];
    const lineRuns = [432, 216];
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

/**
 * Grands réseaux : une boucle à pont, à croisement ou à voie d'évitement, plus un embranchement
 * qui part d'une ligne droite au sol vers un terminus (ou une fourche).
 */
function* networks(maxRun: number): Generator<Template> {
  const bases = new Set<Family>(["hill", "eight-bridge", "eight-crossing", "passing-loop"]);
  let n = 0;
  for (const base of templates(maxRun)) {
    if (!bases.has(base.family) || n++ % 5 !== 0) continue;
    const runIndex = base.elems.findIndex((e) => typeof e === "object" && "run" in e && !e.elevated && e.run >= 252);
    if (runIndex < 0) continue;
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
  /** Profondeur de recherche (1 par défaut) : chaque niveau en plus cherche et montre deux fois plus de circuits. */
  depth?: number;
  /** « max » : d'abord les circuits qui utilisent le plus de pièces possédées ; « simple » : les plus faciles. */
  sort?: "max" | "simple";
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

const FAMILY_CAP = 60;

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
  const maxRun = Math.min(1512, straightLength / 2 + 216 * maxMissing);
  const totalOwned = Object.entries(inventory)
    .filter(([id]) => !NOT_TRACK.has(catalog[id]?.category ?? "accessory"))
    .reduce((s, [, q]) => s + q, 0);

  const seen = new Set<string>();
  const results: GeneratedLayout[] = [];

  // Au-delà de quelques dizaines de circuits par famille, on n'en montrerait pas plus : on s'arrête là.
  const perFamily = new Map<string, number>();
  const full = (family: Family, kind: string) => (perFamily.get(`${family}:${kind}`) ?? 0) >= familyCap;
  const all = function* () {
    yield* templates(maxRun);
    yield* networks(maxRun);
  };
  for (const template of all()) {
    if (options.families?.length && !options.families.includes(template.family)) continue;
    if (full(template.family, "buildable") && full(template.family, "almost")) continue;
    // Plus de lignes droites que de rails disponibles : inutile d'essayer.
    const runTotal = template.elems.reduce((sum, e) => sum + (typeof e === "object" && "run" in e ? e.run : 0), 0);
    if (runTotal > straightLength + 216 * maxMissing) continue;
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
    if (!isComplete(report, tokens)) continue;

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
    if (missingCount > maxMissing) continue;

    const pieces = placements.length;
    const size = sizeOf(pieces);
    if (options.sizes?.length && !options.sizes.includes(size)) continue;
    const features = featuresOf(tokens);
    const req = options.require ?? {};
    if (
      (req.bridge && !features.bridge) ||
      (req.switches && !features.switches) ||
      (req.crossing && !features.crossing)
    ) {
      continue;
    }
    const kind = missingCount === 0 ? "buildable" : "almost";
    if (full(template.family, kind)) continue;
    // Le test de chevauchement est le plus coûteux : on le fait en dernier.
    if (template.checkOverlaps && overlaps(placements, catalog, true).length > 0) continue;

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
        (options.sort === "simple" ? -pieces * 0.15 : usage * 6 + accessories.length * 0.15 + specials * 0.7) +
        special * 0.8 +
        Math.min(deadEndCount, 2) * 0.3 +
        (report.maxGap < 1 ? 0.3 : 0) -
        missingCount * 0.5,
    });
  }

  const pick = (list: GeneratedLayout[]) => {
    // Variété : au plus 12 circuits par famille, tous différents ; on alterne les familles.
    const byFamily = new Map<Family, GeneratedLayout[]>();
    for (const r of [...list].sort((a, b) => b.score - a.score)) {
      const group = byFamily.get(r.family) ?? [];
      // Deux circuits sont « pareils » s'ils ont le même nombre de pièces et la même suite de virages.
      const turns = (c: GeneratedLayout) => c.code.split("~")[0].replace(/[^CRcr@]/g, "");
      const similar = group.some((g) => g.pieces === r.pieces && turns(g) === turns(r));
      if (!similar && group.length < perFamilyShown) group.push(r);
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
