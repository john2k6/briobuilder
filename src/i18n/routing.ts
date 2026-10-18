import { defineRouting } from "next-intl/routing";

// Pour ajouter une langue : l'ajouter ici et créer messages/<code>.json.
export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
});

export type Locale = (typeof routing.locales)[number];
