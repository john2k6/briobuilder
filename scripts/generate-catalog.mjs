// Génère data/catalog/pieces.json à partir de formes simples (droite, courbe…).
// Lancer : npm run catalog
// Géométrie des rails en bois compatibles (centre de la voie) : droites A2 54, A1 108, A 144, D 216 mm ;
// courbes E (rayon 202 mm) et E1 (rayon 110 mm), 1/8 de cercle chacune ; aiguillages de la longueur d'un A.
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
  id, ref, category, verified, lengthMm: length,
  connectors: [con(0, 0, 180, "female"), con(length, 0, 0, "male")],
  tracks: [[[0, 0, 0], [length, 0, 0]]],
});

const curve = (id, ref, radius, verified) => {
  const end = arc(radius, 45).at(-1);
  return {
    id, ref, category: "curve", verified, lengthMm: r2(rad(45) * radius),
    connectors: [con(0, 0, 180, "female"), con(end[0], end[1], 45, "male")],
    tracks: [arc(radius, 45)],
  };
};

const E = 202;
const E1 = 110;
const branch = arc(E, 45).at(-1);

/** Aiguillage : entrée, sortie droite (A, 144 mm) et sortie déviée (courbe E). */
const switchPiece = (id, ref, entry) => ({
  id, ref, category: "switch", verified: false, lengthMm: 144,
  connectors: [con(0, 0, 180, entry), con(144, 0, 0, flip(entry)), con(branch[0], branch[1], 45, flip(entry))],
  tracks: [[[0, 0, 0], [144, 0, 0]], arc(E, 45)],
});

/** Rail montant : passe du sol (niveau 0) au niveau 1 sur 216 mm. */
const ramp = (id, ref, low) => ({
  id, ref, category: "ramp", verified: false, lengthMm: 216,
  connectors: [con(0, 0, 180, low, 0), con(216, 0, 0, flip(low), 1)],
  tracks: [[[0, 0, 0], [216, 0, 1]]],
});

const accessory = (id, ref = null) => ({
  id, ref, category: "accessory", verified: true, lengthMm: 0, connectors: [], tracks: [],
});

const pieces = [
  straight("straight-long", "33341", 216, true),
  straight("straight-medium", "33335", 144, true),
  straight("straight-short", "33334", 108, true),
  straight("straight-mini", null, 54, true),
  curve("curve-large", "33342", E, true),
  curve("curve-small", "33337", E1, true),
  switchPiece("switch", "33344", "female"),
  switchPiece("switch-reverse", "33344", "male"),
  {
    id: "crossing", ref: null, category: "crossing", verified: false, lengthMm: 216,
    connectors: [
      con(0, 0, 180, "female"), con(216, 0, 0, "male"),
      con(108, -108, 270, "female"), con(108, 108, 90, "male"),
    ],
    tracks: [[[0, 0, 0], [216, 0, 0]], [[108, -108, 0], [108, 108, 0]]],
  },
  straight("level-crossing", "33388", 144, false, "crossing"),
  ramp("ramp", "33332", "female"),
  ramp("ramp-reverse", "33332", "male"),
  straight("suspension-bridge", null, 216, false, "bridge"),
  {
    id: "buffer-stop", ref: null, category: "buffer", verified: false, lengthMm: 40,
    connectors: [con(0, 0, 180, "female")],
    tracks: [[[0, 0, 0], [40, 0, 0]]],
  },
  {
    id: "adapter-male-male", ref: "33393", category: "adapter", verified: false, lengthMm: 54,
    connectors: [con(0, 0, 180, "male"), con(54, 0, 0, "male")],
    tracks: [[[0, 0, 0], [54, 0, 0]]],
  },
  {
    id: "adapter-female-female", ref: "33393", category: "adapter", verified: false, lengthMm: 54,
    connectors: [con(0, 0, 180, "female"), con(54, 0, 0, "female")],
    tracks: [[[0, 0, 0], [54, 0, 0]]],
  },
  accessory("support"),
  accessory("tunnel"),
  accessory("station"),
  accessory("signal"),
  accessory("crane"),
  accessory("tree"),
];

const url = new URL("../data/catalog/pieces.json", import.meta.url);
writeFileSync(url, JSON.stringify(pieces, null, 2) + "\n");
console.log(`${pieces.length} pièces écrites dans data/catalog/pieces.json`);
