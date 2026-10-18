import { describe, expect, it } from "vitest";
import { catalog, setList } from "./catalog";
import { circuitFromCode, missingFor } from "./circuits";
import { addSet, analyzeJoints, generateLayouts, isComplete, overlaps, type Inventory } from "./track-engine";

const boxes = (...ids: string[]) =>
  ids.reduce<Inventory>((acc, id) => {
    const set = setList.find((s) => s.id === id);
    if (!set) throw new Error(id);
    return addSet(acc, set);
  }, {});

describe("générateur de circuits", () => {
  const travel = boxes("travel-switching");
  const result = generateLayouts(travel, catalog, { decorate: true, limit: 40 });

  it("propose des circuits variés avec une seule boîte", () => {
    expect(result.total.buildable).toBeGreaterThanOrEqual(10);
    expect(result.buildable.length).toBeGreaterThanOrEqual(8);
    expect(new Set(result.buildable.map((r) => r.family)).size).toBeGreaterThanOrEqual(4);
    // Tous différents.
    expect(new Set(result.buildable.map((r) => r.code)).size).toBe(result.buildable.length);
  });

  it("chaque proposition se referme, sans chevauchement, et tient dans l'inventaire", () => {
    for (const r of result.buildable) {
      expect(isComplete(analyzeJoints(r.placements, catalog), r.code.split(":")[1].split("~")[0])).toBe(true);
      expect(overlaps(r.placements, catalog)).toEqual([]);
      for (const [id, q] of Object.entries(r.bom)) expect(travel[id] ?? 0).toBeGreaterThanOrEqual(q);
    }
  });

  it("les « presque réalisables » indiquent 1 à 3 pièces manquantes exactes", () => {
    for (const r of result.almost) {
      expect(r.missingCount).toBeGreaterThanOrEqual(1);
      expect(r.missingCount).toBeLessThanOrEqual(3);
      expect(missingFor(circuitFromCode(r.code)!, travel)).toEqual(r.missing);
    }
  });

  it("utilise un pont quand on le demande, avec ses piliers", () => {
    const bridges = generateLayouts(travel, catalog, { require: { bridge: true } }).buildable;
    expect(bridges.length).toBeGreaterThan(0);
    for (const r of bridges) {
      expect(r.features.bridge).toBe(true);
      expect(r.bom.support).toBeGreaterThanOrEqual(2);
      expect(r.placements.some((p) => (p.level ?? 0) > 0)).toBe(true);
    }
  });

  it("mélanger deux boîtes donne plus de circuits, dont des voies d'évitement", () => {
    const mixed = generateLayouts(boxes("travel-switching", "firefighter"), catalog, { limit: 100 });
    expect(mixed.total.buildable).toBeGreaterThan(result.total.buildable);
    expect(mixed.buildable.some((r) => r.family === "passing-loop")).toBe(true);
  });

  it("propose un huit avec croisement quand on a les pièces", () => {
    const inv = boxes("expansion-advanced", "pack-short-curves", "pack-short-curves", "pack-short-curves");
    const eights = generateLayouts(inv, catalog, { families: ["eight-crossing"] }).buildable;
    expect(eights.length).toBeGreaterThan(0);
    expect(eights[0].features.crossing).toBe(true);
  });

  it("respecte la taille demandée", () => {
    const big = generateLayouts(boxes("deluxe-railway"), catalog, { sizes: ["large"] }).buildable;
    expect(big.length).toBeGreaterThan(0);
    for (const r of big) expect(r.pieces).toBeGreaterThan(20);
  });

  it("place les accessoires disponibles et les retrouve dans le code", () => {
    const decorated = result.buildable.find((r) => r.accessories.length > 0)!;
    expect(decorated.code).toContain("~");
    expect(circuitFromCode(decorated.code)?.accessories).toEqual(decorated.accessories);
  });

  it("reste raisonnable (moins de quatre secondes pour un gros inventaire, même mesuré pendant la couverture ; le calcul tourne dans un fil à part)", () => {
    const t0 = performance.now();
    generateLayouts(boxes("deluxe-railway", "cargo-deluxe", "travel-switching"), catalog, { decorate: true });
    expect(performance.now() - t0).toBeLessThan(4000);
  });

  it("un code invalide ou un circuit ouvert est refusé", () => {
    expect(circuitFromCode("oval:XYZ")).toBeNull();
    expect(circuitFromCode("nope:CCCC")).toBeNull();
    expect(circuitFromCode("oval:CCCCL")).toBeNull();
    expect(circuitFromCode("circle:CCCCCCCC")?.pieces).toBe(8);
  });

  it("invente d'autres formes que des ronds : L, U, haricot, triangle, maison, octogone", () => {
    const big = boxes("world-deluxe", "pack-deluxe-track");
    const families = new Set(generateLayouts(big, catalog, { limit: 200 }).buildable.map((r) => r.family));
    for (const f of ["l-shape", "u-shape", "bean", "triangle", "house", "octagon"]) expect(families).toContain(f);
  });

  it("part dans tous les sens avec les aiguillages : terminus, fourche, gare de triage, ligne", () => {
    const inv = boxes("world-deluxe", "expansion-advanced", "pack-deluxe-track");
    const r = generateLayouts(inv, catalog, { limit: 200, decorate: true });
    const families = new Set(r.buildable.map((c) => c.family));
    for (const f of ["terminus", "fork", "yard", "line"]) expect(families).toContain(f);
    const fork = r.buildable.find((c) => c.family === "fork")!;
    expect(fork.bom["switch-t"]).toBe(1);
    expect(overlaps(fork.placements, catalog)).toEqual([]);
    // Les gares vont au bout des voies sans issue.
    expect(fork.accessories.some((a) => a.kind === "station")).toBe(true);
  });

  it("sans butoir, une voie sans issue reste ouverte et le code se relit", () => {
    const inv = boxes("deluxe-railway");
    delete inv["buffer-stop"];
    const terminus = generateLayouts(inv, catalog, { families: ["terminus", "line"], limit: 10 }).buildable;
    expect(terminus.length).toBeGreaterThan(0);
    for (const c of terminus) {
      expect(c.code).toContain("|");
      expect(c.bom["buffer-stop"]).toBeUndefined();
      expect(circuitFromCode(c.code)?.pieces).toBe(c.pieces);
    }
  });

  it("utilise la plaque tournante et les gares disponibles dans le décor", () => {
    const inv = boxes("deluxe-railway", "turntable-mechanical");
    const r = generateLayouts(inv, catalog, { families: ["terminus"], decorate: true, limit: 5 });
    expect(r.buildable[0].accessories.map((a) => a.kind)).toEqual(expect.arrayContaining(["station", "turntable"]));
  });

  it("utilise les pièces spéciales du coffret : ascenseur, courbes montantes, ponts empilables (33887)", () => {
    const inv = boxes("warehouse", "expansion-intermediate");
    const r = generateLayouts(inv, catalog, { limit: 40 });
    const top = r.buildable.slice(0, 4);
    expect(top.some((c) => c.bom.lift === 1)).toBe(true);
    expect(top.some((c) => (c.bom["curve-ascending"] ?? 0) > 0)).toBe(true);
    expect(top.some((c) => (c.bom["stacking-bridge"] ?? 0) > 0)).toBe(true);
    for (const c of r.buildable) expect(overlaps(c.placements, catalog)).toEqual([]);
  });
});
