import { catalog } from "./catalog";
import { chain, type ChainStep } from "./track-engine";

const curve: ChainStep = { pieceTypeId: "curve-large" };
const straight: ChainStep = { pieceTypeId: "straight-long" };

/** Ovale de démonstration : 8 grandes courbes et 4 droites longues. */
export const demoOval = chain(
  [curve, curve, curve, curve, straight, straight, curve, curve, curve, curve, straight, straight],
  catalog,
);
