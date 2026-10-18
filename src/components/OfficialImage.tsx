"use client";

import { useState } from "react";

/**
 * Image officielle hébergée chez le fabricant (lien direct, jamais recopiée).
 * Si elle ne se charge pas (hors ligne, adresse changée), on affiche le dessin original à la place.
 */
export function OfficialImage({
  src,
  className,
  fallback,
}: {
  src: string | null;
  className?: string;
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(src)}
      className={className}
    />
  );
}
