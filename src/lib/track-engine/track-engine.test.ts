import { describe, expect, it } from "vitest";
import { catalog, pieceList, setList } from "../catalog";
import {
  addSet,
  analyzeJoints,
  angleDiff,
  attach,
  billOfMaterials,
  chain,
  connect,
  flexTolerance,
  fullBillOfMaterials,
  supportsNeeded,
  tokensToSteps,
  isClosed,
  matchInventory,
  overlaps,
  totalPieces,
  transform,
  type ChainStep,
  type Placement,
} from ".";

const curve = (flipped = false): ChainStep => ({ pieceTypeId: "curve-large", flipped });
const straight: ChainStep = { pieceTypeId: "straight-long" };

/** Ovale : 4 courbes, 2 droites, 4 courbes, 2 droites. */
const ovalSteps: ChainStep[] = [
  curve(),
  curve(),
  curve(),
  curve(),
  straight,
  straight,
  curve(),
  curve(),
  curve(),
  curve(),
  straight,
  straight,
];

describe("catalogue", () => {
  it("contient les pièces et des coffrets cohérents", () => {
    expect(pieceList.length).toBeGreaterThanOrEqual(20);
    expect(setList.length).toBeGreaterThanOrEqual(15);
    expect(new Set(setList.map((s) => s.id)).size).toBe(setList.length);
    for (const set of setList) {
      for (const item of set.contents) expect(catalog[item.pieceTypeId]).toBeDefined();
    }
  });

  it("chaque rail a de 1 à 4 connecteurs et au moins un tracé ; les accessoires aucun", () => {
    for (const piece of pieceList) {
      if (piece.category === "accessory") {
        expect(piece.connectors).toHaveLength(0);
        continue;
      }
      expect(piece.connectors.length).toBeGreaterThanOrEqual(1);
      expect(piece.connectors.length).toBeLessThanOrEqual(4);
      expect(piece.tracks.length).toBeGreaterThan(0);
    }
  });
});

describe("connect", () => {
  const base = { x: 0, y: 0, level: 0 };
  it("accepte un mâle face à une femelle", () => {
    expect(connect({ ...base, angle: 0, gender: "male" }, { ...base, angle: 180, gender: "female" })).toEqual({
      ok: true,
    });
  });
  it("refuse un mâle face à un mâle", () => {
    expect(connect({ ...base, angle: 0, gender: "male" }, { ...base, angle: 180, gender: "male" })).toEqual({
      ok: false,
      reason: "same-gender",
    });
  });
  it("refuse deux extrémités trop éloignées, mal orientées ou à des niveaux différents", () => {
    const m = { ...base, angle: 0, gender: "male" as const };
    expect(connect(m, { ...base, x: 5, angle: 180, gender: "female" })).toMatchObject({ reason: "too-far" });
    expect(connect(m, { ...base, angle: 90, gender: "female" })).toMatchObject({ reason: "misaligned" });
    expect(connect(m, { ...base, angle: 180, gender: "female", level: 1 })).toMatchObject({ reason: "level" });
  });
  it("tolère 3 mm d'écart", () => {
    expect(connect({ ...base, angle: 0, gender: "male" }, { ...base, x: 2.5, angle: 180.5, gender: "female" }).ok).toBe(
      true,
    );
  });
});

describe("géométrie", () => {
  it("angleDiff gère le passage par 0", () => {
    expect(angleDiff(350, 10)).toBe(20);
    expect(angleDiff(-90, 270)).toBe(0);
  });

  it("une courbe retournée tourne dans l'autre sens", () => {
    const p: Placement = { id: "a", pieceTypeId: "curve-large", x: 0, y: 0, rotation: 0, flipped: true };
    const [, end] = transform(p, catalog["curve-large"]);
    expect(end.y).toBeLessThan(0);
    expect(end.angle).toBeCloseTo(315);
  });

  it("attach raccorde exactement deux pièces", () => {
    const first: Placement = { id: "a", pieceTypeId: "straight-long", x: 10, y: 20, rotation: 30, flipped: false };
    const out = transform(first, catalog["straight-long"])[1];
    const second = attach(catalog["curve-large"], 0, out, { id: "b" });
    const inC = transform(second, catalog["curve-large"])[0];
    expect(connect(out, inC)).toEqual({ ok: true });
  });
});

describe("fermeture (critères du lot 0)", () => {
  it("un ovale de 8 courbes et 4 droites est fermé", () => {
    const oval = chain(ovalSteps, catalog);
    const report = analyzeJoints(oval, catalog);
    expect(report.openConnectors).toHaveLength(0);
    expect(report.errors).toHaveLength(0);
    expect(report.joints).toHaveLength(12);
    expect(isClosed(oval, catalog)).toBe(true);
  });

  it("un cercle de 8 courbes est fermé", () => {
    expect(
      isClosed(
        chain(
          Array.from({ length: 8 }, () => curve()),
          catalog,
        ),
        catalog,
      ),
    ).toBe(true);
  });

  it("un circuit ouvert est détecté ouvert", () => {
    const open = chain(ovalSteps.slice(0, -1), catalog);
    const report = analyzeJoints(open, catalog);
    expect(report.closed).toBe(false);
    expect(report.openConnectors).toHaveLength(2);
    expect(isClosed([], catalog)).toBe(false);
  });

  it("un raccord mâle-mâle est refusé", () => {
    const a: Placement = { id: "a", pieceTypeId: "straight-long", x: 0, y: 0, rotation: 0, flipped: false };
    // Deuxième droite tournée de 180° : son extrémité mâle touche celle de la première.
    const b: Placement = { id: "b", pieceTypeId: "straight-long", x: 432, y: 0, rotation: 180, flipped: false };
    const report = analyzeJoints([a, b], catalog);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].reason).toBe("same-gender");
    expect(report.closed).toBe(false);
  });

  it("des adaptateurs permettent d'inverser le sens d'une portion", () => {
    const placements = chain([straight, { pieceTypeId: "adapter-female-female" }], catalog);
    const ends = transform(placements[1], catalog["adapter-female-female"]);
    const reversed = attach(catalog["straight-long"], 1, ends[1], { id: "c" });
    const report = analyzeJoints([...placements, reversed], catalog);
    expect(report.errors).toHaveLength(0);
    expect(report.joints).toHaveLength(2);
  });

  it("une rampe monte d'un niveau, et les pièces suivantes restent en hauteur", () => {
    const placements = chain([{ pieceTypeId: "ramp" }, straight], catalog);
    expect(placements[1].level).toBe(1);
    const ends = transform(placements[1], catalog["straight-long"]);
    expect(ends[1].level).toBe(1);
    expect(analyzeJoints(placements, catalog).errors).toEqual([]);
    expect(supportsNeeded(placements, catalog)).toBe(2);
    expect(fullBillOfMaterials(placements, catalog).support).toBe(2);
  });

  it("une droite posée au sol ne se raccorde pas au haut d'une rampe", () => {
    const ramp: Placement = { id: "a", pieceTypeId: "ramp", x: 0, y: 0, rotation: 0, flipped: false };
    const ground: Placement = { id: "b", pieceTypeId: "straight-long", x: 216, y: 0, rotation: 0, flipped: false };
    expect(analyzeJoints([ramp, ground], catalog).errors[0]?.reason).toBe("level");
  });

  it("une colline (montée, pont, descente) revient au sol", () => {
    const placements = chain(
      [
        { pieceTypeId: "ramp" },
        { pieceTypeId: "suspension-bridge" },
        { pieceTypeId: "ramp-reverse", inConnector: 1, outConnector: 0 },
        straight,
      ],
      catalog,
    );
    expect(placements.map((p) => p.level ?? 0)).toEqual([0, 1, 0, 0]);
    expect(analyzeJoints(placements, catalog).errors).toEqual([]);
  });

  it("le jeu des rails absorbe un petit écart à la fermeture d'une grande boucle", () => {
    // Huit avec croisement et petites courbes : se referme à moins de 3 mm.
    const eight = chain(tokensToSteps("Xrrrrrr@1.3cccccc"), catalog);
    const report = analyzeJoints(eight, catalog);
    expect(report.closed).toBe(true);
    expect(report.maxGap).toBeGreaterThan(0);
    expect(report.maxGap).toBeLessThan(flexTolerance(eight.length).position);
  });

  it("un aiguillage laisse une branche libre", () => {
    const placements = chain([{ pieceTypeId: "switch" }, straight], catalog);
    expect(analyzeJoints(placements, catalog).openConnectors).toHaveLength(3);
  });
});

describe("chain", () => {
  it("peut repartir d'une pièce déjà posée", () => {
    const placements = chain(
      [{ pieceTypeId: "crossing" }, { pieceTypeId: "straight-short", from: { index: 0, connector: 3 } }],
      catalog,
    );
    const [inC] = transform(placements[1], catalog["straight-short"]);
    expect(inC.x).toBeCloseTo(108);
    expect(inC.y).toBeCloseTo(108);
  });

  it("signale une pièce de départ absente", () => {
    expect(() => chain([{ pieceTypeId: "straight-short", from: { index: 4, connector: 0 } }], catalog)).toThrow();
    expect(() =>
      chain(
        [{ pieceTypeId: "straight-short" }, { pieceTypeId: "straight-short", from: { index: 4, connector: 0 } }],
        catalog,
      ),
    ).toThrow();
  });
});

describe("chevauchements", () => {
  it("un ovale ne se chevauche pas", () => {
    expect(overlaps(chain(ovalSteps, catalog), catalog)).toEqual([]);
  });

  it("deux droites posées l'une sur l'autre se chevauchent", () => {
    const a: Placement = { id: "a", pieceTypeId: "straight-long", x: 0, y: 0, rotation: 0, flipped: false };
    const b: Placement = { ...a, id: "b", x: 50, y: 10 };
    expect(overlaps([a, b], catalog)).toEqual([["a", "b"]]);
  });

  it("deux voies qui se croisent au même niveau se chevauchent", () => {
    const a: Placement = { id: "a", pieceTypeId: "straight-long", x: 0, y: 0, rotation: 0, flipped: false };
    const b: Placement = { id: "b", pieceTypeId: "straight-long", x: 108, y: -108, rotation: 90, flipped: false };
    expect(overlaps([a, b], catalog)).toHaveLength(1);
  });

  it("une voie surélevée passe au-dessus d'une voie au sol", () => {
    const ramp: Placement = { id: "a", pieceTypeId: "ramp", x: 0, y: 0, rotation: 0, flipped: false };
    // La voie au sol passe sous la moitié haute de la rampe.
    const under: Placement = { id: "b", pieceTypeId: "straight-long", x: 170, y: -108, rotation: 90, flipped: false };
    expect(overlaps([ramp, under], catalog)).toEqual([]);
  });
});

describe("inventaire", () => {
  it("la nomenclature se déduit des placements", () => {
    expect(billOfMaterials(chain(ovalSteps, catalog))).toEqual({ "curve-large": 8, "straight-long": 4 });
  });

  it("ajouter un coffret ajoute toutes ses pièces", () => {
    const set = setList.find((s) => s.id === "firefighter")!;
    const inv = addSet({ "curve-large": 1 }, set, 2);
    expect(inv["curve-large"]).toBe(17);
    expect(totalPieces(addSet({}, set))).toBe(set.contents.reduce((s, c) => s + c.quantity, 0));
  });

  it("classe les circuits réalisables et presque réalisables", () => {
    const oval = { id: "oval", placements: chain(ovalSteps, catalog) };
    const circle = {
      id: "circle",
      placements: chain(
        Array.from({ length: 8 }, () => curve()),
        catalog,
      ),
    };
    const big = { id: "big", placements: chain([...ovalSteps, straight, straight, straight, straight], catalog) };

    const result = matchInventory({ "curve-large": 8, "straight-long": 2 }, [oval, circle, big]);
    expect(result.buildable.map((r) => r.layout.id)).toEqual(["circle"]);
    expect(result.almost.map((r) => r.layout.id)).toEqual(["oval"]);
    expect(result.almost[0].missing).toEqual({ "straight-long": 2 });
  });
});

describe("catalogue de pièces", () => {
  it("chaque connecteur est au bout d'un tracé, au bon niveau", () => {
    for (const piece of Object.values(catalog)) {
      const ends = piece.tracks.flatMap((t) => [t[0], t.at(-1)!]);
      for (const c of piece.connectors) {
        const hit = ends.some(([x, y, level]) => Math.hypot(x - c.x, y - c.y) < 0.5 && level === c.level);
        expect(hit, `${piece.id} (${c.x}, ${c.y})`).toBe(true);
      }
    }
  });
});
