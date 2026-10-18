import images from "../../data/catalog/official-images.json";

/**
 * Images et pages officielles des produits compatibles (choix du porteur du projet, 18 octobre 2026).
 * Les images restent hébergées chez le fabricant (simple lien, jamais copiées sur notre serveur),
 * toujours avec le crédit © et un lien vers la page officielle du produit.
 */
const officialImages: Record<string, string> = images;

/** Numéro d'article à 8 chiffres utilisé par les sites officiels (33512 → 63351200). */
export const articleNumber = (ref: string) => `6${ref}00`;

/** Page officielle du produit dans la langue du visiteur (anglais par défaut). */
export function officialPage(ref: string | null, locale: string): string | null {
  if (!ref || !/^\d{5}$/.test(ref)) return null;
  if (locale === "fr") return `https://www.ravensburger.fr/fr-FR/pdp/${articleNumber(ref)}`;
  return `https://www.brio.co.uk/en-GB/pdp/${articleNumber(ref)}`;
}

/** Image officielle d'un produit, si elle a été renseignée dans data/catalog/official-images.json. */
export function officialImage(ref: string | null): string | null {
  return (ref && officialImages[ref]) || null;
}
