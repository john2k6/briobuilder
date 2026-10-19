// Génère data/catalog/pieces.json à partir de formes simples (droite, courbe…).
// Lancer : npm run catalog
// Géométrie des rails en bois compatibles (centre de la voie) : droites A2 54, A1 108, A 144, D 216 mm ;
// courbes E (rayon 212 mm, d'après les circuits ronds officiels de 46,4 cm) et E1 (rayon 110 mm), 1/8 de cercle chacune ; aiguillages de la longueur d'un A.
// verified: false = valeur à confirmer en mesurant une vraie pièce.
import { writeFileSync } from "node:fs";

const r2 = (n) => Math.round(n * 100) / 100;
const rad = (d) => (d * Math.PI) / 180;
const con = (x, y, angle, gender, level = 0) => ({ x: r2(x), y: r2(y), angle, gender, level });
const flip = (g) => (g === "male" ? "female" : "male");

function arc(radius, degrees, level = 0) {
  const pts = [];
  for (let d = 0; d <= degrees; d += 5) {
    pts.push([r2(radius * Math.sin(rad(d))), r2(radius * (1 - Math.cos(rad(d)))), level]);
  }
  return pts;
}

const straight = (id, ref, length, verified, category = "straight") => ({
  id,
  ref,
  category,
  verified,
  lengthMm: length,
  connectors: [con(0, 0, 180, "female"), con(length, 0, 0, "male")],
  tracks: [
    [
      [0, 0, 0],
      [length, 0, 0],
    ],
  ],
});

const curve = (id, ref, radius, verified) => {
  const end = arc(radius, 45).at(-1);
  return {
    id,
    ref,
    category: "curve",
    verified,
    lengthMm: r2(rad(45) * radius),
    connectors: [con(0, 0, 180, "female"), con(end[0], end[1], 45, "male")],
    tracks: [arc(radius, 45)],
  };
};

const E = 212;
const E1 = 110;
const branch = arc(E, 45).at(-1);

/** Aiguillage : entrée, sortie droite (A, 144 mm) et sortie déviée (courbe E). */
const switchPiece = (id, ref, entry) => ({
  id,
  ref,
  category: "switch",
  verified: false,
  lengthMm: 144,
  connectors: [con(0, 0, 180, entry), con(144, 0, 0, flip(entry)), con(branch[0], branch[1], 45, flip(entry))],
  tracks: [
    [
      [0, 0, 0],
      [144, 0, 0],
    ],
    arc(E, 45),
  ],
});

/** Rail montant : passe du sol (niveau 0) au niveau 1 sur 216 mm. */
const ramp = (id, ref, low) => ({
  id,
  ref,
  category: "ramp",
  verified: false,
  lengthMm: 216,
  connectors: [con(0, 0, 180, low, 0), con(216, 0, 0, flip(low), 1)],
  tracks: [
    [
      [0, 0, 0],
      [216, 0, 1],
    ],
  ],
});

/** Aiguillage court (O1/P1) : sortie droite A1 (108 mm) et sortie déviée en petite courbe E1. */
const smallBranch = arc(E1, 45).at(-1);
const smallSwitch = {
  id: "switch-small",
  // Vendu dans le coffret de démarrage 13 rails (pack B).
  ref: "33394",
  category: "switch",
  verified: false,
  lengthMm: 108,
  connectors: [con(0, 0, 180, "female"), con(108, 0, 0, "male"), con(smallBranch[0], smallBranch[1], 45, "male")],
  tracks: [
    [
      [0, 0, 0],
      [108, 0, 0],
    ],
    arc(E1, 45),
  ],
};

/** Aiguillage en T (en Y) : une entrée, une courbe E à gauche et une à droite. */
const mirror = (pts) => pts.map(([x, y, l]) => [x, -y, l]);
const tSwitch = {
  id: "switch-t",
  // Aiguillage en Y, croisements : dans le coffret évolution avancé.
  ref: "33307",
  category: "switch",
  verified: false,
  lengthMm: r2(rad(45) * E),
  connectors: [
    con(0, 0, 180, "female"),
    con(branch[0], branch[1], 45, "male"),
    con(branch[0], -branch[1], 315, "male"),
  ],
  tracks: [arc(E, 45), mirror(arc(E, 45))],
};

/** Croisement courbe (H3) : deux courbes E qui se croisent en X, pour relier deux boucles. */
const curvedCrossing = {
  id: "crossing-curved",
  ref: "33307",
  category: "crossing",
  verified: false,
  lengthMm: r2(rad(45) * E),
  connectors: [
    con(0, 0, 180, "female"),
    con(branch[0], branch[1], 45, "male"),
    con(0, branch[1], 180, "female"),
    con(branch[0], 0, 315, "male"),
  ],
  tracks: [arc(E, 45), arc(E, 45).map(([x, y, l]) => [x, r2(branch[1] - y), l])],
};

/**
 * Courbe montante en plastique : un demi-tour (180°, rayon E) qui monte d'un niveau.
 * low = genre du bout bas ; la version inverse sert à redescendre.
 */
const halfTurn = arc(E, 180);
const ascendingCurve = (id, low) => ({
  id,
  ref: "33995",
  category: "ramp",
  verified: false,
  lengthMm: r2(Math.PI * E),
  connectors: [con(0, 0, 180, low, 0), con(halfTurn.at(-1)[0], halfTurn.at(-1)[1], 180, flip(low), 1)],
  tracks: [halfTurn.map(([x, y], i, all) => [x, y, r2(i / (all.length - 1))])],
});

/** Ascenseur de l'entrepôt : le train entre en bas et ressort en haut (niveau 1), sur la longueur d'un rail A. */
const lift = {
  id: "lift",
  ref: "33887",
  category: "ramp",
  verified: false,
  lengthMm: 144,
  connectors: [con(0, 0, 180, "female", 0), con(144, 0, 0, "male", 1)],
  tracks: [[[0, 0, 0], [144, 0, 1]]],
};

/** Pont courbe : une grande courbe E portée en hauteur. */
const curvedBridge = { ...curve("curved-bridge", "33699", E, false), category: "bridge" };

const accessory = (id, ref = null, category = "accessory") => ({
  id, ref, category, verified: true, lengthMm: 0, connectors: [], tracks: [],
});
const building = (id, ref = null) => accessory(id, ref, "building");

const pieces = [
  straight("straight-long", "33341", 216, true),
  straight("straight-medium", "33335", 144, true),
  straight("straight-short", "33334", 108, true),
  straight("straight-mini", "33333", 54, true),
  curve("curve-large", "33342", E, true),
  curve("curve-small", "33337", E1, true),
  switchPiece("switch", "33344", "female"),
  switchPiece("switch-reverse", "33344", "male"),
  smallSwitch,
  tSwitch,
  {
    id: "crossing",
    ref: "33307",
    category: "crossing",
    verified: false,
    lengthMm: 216,
    connectors: [
      con(0, 0, 180, "female"),
      con(216, 0, 0, "male"),
      con(108, -108, 270, "female"),
      con(108, 108, 90, "male"),
    ],
    tracks: [
      [
        [0, 0, 0],
        [216, 0, 0],
      ],
      [
        [108, -108, 0],
        [108, 108, 0],
      ],
    ],
  },
  curvedCrossing,
  straight("level-crossing", "33388", 144, false, "crossing"),
  ramp("ramp", "33332", "female"),
  ramp("ramp-reverse", "33332", "male"),
  ascendingCurve("curve-ascending", "female"),
  ascendingCurve("curve-ascending-reverse", "male"),
  lift,
  straight("suspension-bridge", "33683", 216, false, "bridge"),
  straight("lifting-bridge", "33757", 216, false, "bridge"),
  curvedBridge,
  {
    id: "buffer-stop",
    ref: "33385",
    category: "buffer",
    verified: false,
    lengthMm: 40,
    connectors: [con(0, 0, 180, "female")],
    tracks: [
      [
        [0, 0, 0],
        [40, 0, 0],
      ],
    ],
  },
  {
    id: "adapter-male-male",
    ref: "33393",
    category: "adapter",
    verified: false,
    lengthMm: 54,
    connectors: [con(0, 0, 180, "male"), con(54, 0, 0, "male")],
    tracks: [
      [
        [0, 0, 0],
        [54, 0, 0],
      ],
    ],
  },
  {
    id: "adapter-female-female",
    ref: "33393",
    category: "adapter",
    verified: false,
    lengthMm: 54,
    connectors: [con(0, 0, 180, "female"), con(54, 0, 0, "female")],
    tracks: [
      [
        [0, 0, 0],
        [54, 0, 0],
      ],
    ],
  },
  accessory("support", "33254"),
  accessory("stacking-bridge", "33253"),
  accessory("tunnel", "33735"),
  accessory("signal", "33754"),
  accessory("traffic-light", "33743"),
  accessory("crane", "33835"),
  accessory("tree"),
  accessory("turntable", "33361"),
  // Gares et bâtiments : chacun a son dessin et sa place dans les circuits.
  building("station", "33649"),
  building("cargo-station", "33280"),
  building("fire-station", "33833"),
  building("police-station", "33813"),
  building("farm", "36012"),
  building("roundhouse", "33736"),
  building("garage", "33574"),
  building("signal-box", "33674"),
  // Gares toutes différentes, chacune d'après sa famille de produits.
  building("station-platform", "33512"),
  building("station-central", "33649"),
  building("station-metro", "33513"),
  building("station-space", "36155"),
  building("station-castle", "33312"),
  building("station-winter", "36014"),
  building("station-modern", "33972"),
  // Tunnels différents : montagne, volcan, tunnel d'action, tunnel phosphorescent.
  building("tunnel-mountain", "33889"),
  building("tunnel-volcano", "36092"),
  building("tunnel-action", "33873"),
  building("tunnel-metro", "33970"),
];

const url = new URL("../data/catalog/pieces.json", import.meta.url);
writeFileSync(url, JSON.stringify(pieces, null, 2) + "\n");
console.log(`${pieces.length} pièces écrites dans data/catalog/pieces.json`);
