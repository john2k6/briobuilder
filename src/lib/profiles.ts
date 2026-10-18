// Constantes des profils enfants, utilisables côté serveur comme côté navigateur.

export type AgeBand = "3-4" | "5-6" | "7+";

export const AGE_OF_BAND: Record<AgeBand, number> = { "3-4": 3, "5-6": 5, "7+": 7 };
export const AVATAR_COLORS = ["#d2232a", "#1f8a4c", "#2e6fb5", "#e0a020", "#8a4fbf", "#a6773f"];
