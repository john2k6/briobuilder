import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pieceList, setList } from "./catalog";

type Tree = { [key: string]: string | Tree };
const keys = (tree: Tree, prefix = ""): string[] =>
  Object.entries(tree).flatMap(([k, v]) => (typeof v === "string" ? [prefix + k] : keys(v, `${prefix}${k}.`)));

const dir = new URL("../../messages/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
const load = (file: string) => JSON.parse(readFileSync(new URL(file, dir), "utf8")) as Tree;
const reference = keys(load("fr.json")).sort();

describe("traductions", () => {
  it.each(files)("%s a exactement les mêmes clés que fr.json", (file) => {
    expect(keys(load(file)).sort()).toEqual(reference);
  });

  it("chaque pièce et chaque coffret a un nom", () => {
    for (const p of pieceList) expect(reference).toContain(`pieceNames.${p.id}`);
    for (const s of setList) expect(reference).toContain(`setNames.${s.id}`);
  });
});
