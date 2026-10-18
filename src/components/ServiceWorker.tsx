"use client";

import { useEffect } from "react";

/** Enregistre le service worker (hors ligne) en production uniquement. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sans service worker, le site fonctionne normalement en ligne.
    });
  }, []);
  return null;
}
