import products from "../../data/catalog/official-images.json";

/**
 * Images et pages officielles des produits compatibles (choix du porteur du projet, 18 octobre 2026).
 * Les images restent hébergées chez le fabricant (simple lien, jamais copiées sur notre serveur),
 * toujours avec le crédit © et un lien vers la page officielle du produit.
 * data/catalog/official-images.json : pour chaque référence, l'image et les sites où la page existe
 * (vérifiés le 18 octobre 2026 ; certains produits ne sont pas vendus en France).
 */
const officialProducts: Record<string, { image: string; fr: boolean; en: boolean }> = products;

/** Numéro d'article à 8 chiffres utilisé par les sites officiels (33512 → 63351200). */
export const articleNumber = (ref: string) => `6${ref}00`;

/** Page officielle du produit, dans la langue du visiteur si elle existe (sinon en anglais). */
export function officialPage(ref: string | null, locale: string): string | null {
  const product = ref ? officialProducts[ref] : undefined;
  if (!ref || !product) return null;
  if (locale === "fr" && product.fr) return `https://www.brio.fr/fr-FR/pdp/${articleNumber(ref)}`;
  if (product.en) return `https://www.brio.co.uk/en-GB/pdp/${articleNumber(ref)}`;
  return product.fr ? `https://www.brio.fr/fr-FR/pdp/${articleNumber(ref)}` : null;
}

/** Image officielle d'un produit. */
export function officialImage(ref: string | null): string | null {
  return (ref && officialProducts[ref]?.image) || null;
}
