import { setList } from "./catalog";
import { layoutById, layouts } from "./layouts";
import { addSet, matchInventory } from "./track-engine";

export const demoOval = layoutById["oval"].placements;

/** Ce que permet un coffret de démarrage seul, calculé par le moteur de matching. */
export const starterInventory = addSet({}, setList.find((s) => s.id === "starter")!);
export const starterMatches = matchInventory(starterInventory, layouts);
