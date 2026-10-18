// Calcul des circuits dans un fil à part : la page reste fluide pendant que le moteur cherche.
import { catalog } from "./catalog";
import { generateLayouts, type GeneratorOptions, type Inventory } from "./track-engine";

self.onmessage = (event: MessageEvent<{ id: number; inventory: Inventory; options: GeneratorOptions }>) => {
  const { id, inventory, options } = event.data;
  self.postMessage({ id, ...generateLayouts(inventory, catalog, options) });
};
