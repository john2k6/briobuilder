import { describe, expect, it } from "vitest";
import { catalog, setList } from "./catalog";
import { layouts } from "./layouts";
import { addSet, analyzeJoints, matchInventory, overlaps, relevance, suggestPurchases } from "./track-engine";

describe("bibliothèque de circuits", () => {
  it.each(layouts.map((l) => [l.id, l] as const))("%s se referme sans chevauchement", (_id, layout) => {
    const report = analyzeJoints(layout.placements, catalog);
    expect(report.errors).toEqual([]);
    expect(report.openConnectors).toEqual([]);
    expect(overlaps(layout.placements, catalog)).toEqual([]);
  });

  it("les identifiants sont uniques", () => {
    expect(new Set(layouts.map((l) => l.id)).size).toBe(layouts.length);
  });

  it("un coffret de démarrage seul permet 5 circuits", () => {
    const inv = addSet({}, setList.find((s) => s.id === "starter")!);
    const { buildable, almost } = matchInventory(inv, layouts);
    expect(buildable.map((m) => m.layout.id).sort()).toEqual(["circle", "long-oval", "oval", "short-oval", "stadium"]);
    expect(almost.length).toBeGreaterThan(0);
  });

  it("coffret de démarrage + 1 extension aiguillages : au moins 10 circuits (objectif du MVP)", () => {
    const starter = setList.find((s) => s.id === "starter")!;
    const ext = setList.find((s) => s.id === "expansion-switches")!;
    expect(matchInventory(addSet(addSet({}, starter), ext), layouts).buildable.length).toBeGreaterThanOrEqual(10);
  });

  it("la bibliothèque compte au moins 20 circuits, dont un 8 avec croisement", () => {
    expect(layouts.length).toBeGreaterThanOrEqual(20);
    expect(layouts.find((l) => l.id === "figure-eight")?.bom.crossing).toBe(1);
  });
});

describe("classement et suggestions", () => {
  const small = { id: "a", placements: layouts[0].placements, ageMin: 3, theme: "classic" };
  const big = { id: "b", placements: layouts[5].placements, ageMin: 5, theme: "city" };

  it("préfère les circuits qui utilisent la caisse et conviennent à l'âge", () => {
    const inv = { "curve-large": 8, "straight-long": 6 };
    expect(relevance(big, { inventory: inv })).toBeGreaterThan(relevance(small, { inventory: inv }));
    expect(relevance(big, { inventory: inv, childAge: 3 })).toBeLessThan(
      relevance(small, { inventory: inv, childAge: 3 }),
    );
  });

  it("donne un bonus aux circuits jamais construits, aux thèmes favoris et aux nouveautés", () => {
    const ctx = { inventory: {} };
    const base = relevance(small, { ...ctx, builtIds: new Set(["a"]) });
    expect(relevance(small, ctx)).toBeGreaterThan(base);
    expect(
      relevance(small, { ...ctx, builtIds: new Set(["a"]), favoriteThemes: new Set(["classic"]) }),
    ).toBeGreaterThan(base);
    expect(relevance(small, { ...ctx, builtIds: new Set(["a"]), newIds: new Set(["a"]) })).toBeGreaterThan(base);
  });

  it("suggère la pièce qui débloque le plus de circuits", () => {
    const inv = addSet({}, setList.find((s) => s.id === "starter")!);
    const [best] = suggestPurchases(inv, layouts, Object.keys(catalog));
    // 2 rails droits moyens débloquent 6 circuits d'un coup.
    expect(best.pieceTypeId).toBe("straight-medium");
    expect(best.quantity).toBe(2);
    expect(best.unlocks).toHaveLength(6);
  });
});
