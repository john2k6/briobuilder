import type { MetadataRoute } from "next";

// Application installable (PWA) : écran d'accueil de la tablette, plein écran.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rail Builder",
    short_name: "Rail Builder",
    description: "Circuits de train en bois réalisables avec vos pièces · Wooden railway layouts you can build",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f7f3ec",
    theme_color: "#2e3236",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
