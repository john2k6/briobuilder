import pieces from "../../data/catalog/pieces.json";
import sets from "../../data/catalog/sets.json";
import type { Catalog, PieceType, TrackSet } from "./track-engine";

export const pieceList = pieces as PieceType[];
export const setList = sets as TrackSet[];
export const catalog: Catalog = Object.fromEntries(pieceList.map((p) => [p.id, p]));
