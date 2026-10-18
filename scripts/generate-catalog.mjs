// Génère data/catalog/pieces.json à partir de formes simples (droite, courbe…).
// Lancer : npm run catalog
// Les dimensions marquées verified: false sont à mesurer sur de vraies pièces.
import { writeFileSync } from "node:fs";

const r2 = (n) => Math.round(n * 100) / 100;
const rad = (d) => (d * Math.PI) / 180;
const con = (x, y, angle, gender, level = 0) => ({ x: r2(x), y: r2(y), angle, gender, level });

function arc(radius, degrees) {
  const pts = [];
  for (let d = 0; d <= degrees; d += 5) {
    pts.push([r2(radius * Math.sin(rad(d))), r2(radius * (1 - Math.cos(rad(d)))), 0]);
  }
  return pts;
}

const straight = (id, ref, length, verified) => ({
  id, ref, category: "straight", verified, lengthMm: length,
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

const LARGE_RADIUS = 182;
const SMALL_RADIUS = 90;
const branch = arc(LARGE_RADIUS, 45).at(-1);

const pieces = [
  straight("straight-long", "33341", 216, true),
  straight("straight-medium", "33335", 144, false),
  straight("straight-short", "33334", 108, true),
  curve("curve-large", "33342", LARGE_RADIUS, false),
  curve("curve-small", "33337", SMALL_RADIUS, false),
  {
    id: "switch", ref: "33344", category: "switch", verified: false, lengthMm: 145,
    connectors: [con(0, 0, 180, "female"), con(145, 0, 0, "male"), con(branch[0], branch[1], 45, "male")],
    tracks: [[[0, 0, 0], [145, 0, 0]], arc(LARGE_RADIUS, 45)],
  },
  {
    id: "ramp", ref: "33332", category: "ramp", verified: true, lengthMm: 216,
    connectors: [con(0, 0, 180, "female", 0), con(216, 0, 0, "male", 1)],
    tracks: [[[0, 0, 0], [216, 0, 1]]],
  },
  {
    id: "crossing", ref: "33388", category: "crossing", verified: false, lengthMm: 144,
    connectors: [
      con(0, 0, 180, "female"), con(144, 0, 0, "male"),
      con(72, -72, 270, "female"), con(72, 72, 90, "male"),
    ],
    tracks: [[[0, 0, 0], [144, 0, 0]], [[72, -72, 0], [72, 72, 0]]],
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
];

const url = new URL("../data/catalog/pieces.json", import.meta.url);
writeFileSync(url, JSON.stringify(pieces, null, 2) + "\n");
console.log(`${pieces.length} pièces écrites dans data/catalog/pieces.json`);
