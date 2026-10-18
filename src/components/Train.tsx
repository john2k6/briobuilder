"use client";

import { useEffect, useRef } from "react";

/** Vitesse du train (mm par seconde) et écart entre la locomotive et le wagon (mm). */
const SPEED = 140;
const GAP = 84;

/** Petit train original vu de dessus, qui suit le tracé. Immobile si l'utilisateur réduit les animations. */
export function Train({ path }: { path: string }) {
  const ref = useRef<SVGGElement>(null);

  useEffect(() => {
    const svg = ref.current?.ownerSVGElement;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => (query.matches ? svg?.pauseAnimations() : svg?.unpauseAnimations());
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  // Longueur approximative du tracé, pour une vitesse constante quel que soit le circuit.
  const pts = path.match(/-?\d+(\.\d+)?/g)!.map(Number);
  let length = 0;
  for (let i = 2; i < pts.length; i += 2) length += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
  const dur = `${(length / SPEED).toFixed(2)}s`;
  const lead = `${(-GAP / SPEED).toFixed(2)}s`;

  return (
    <g ref={ref} aria-hidden="true">
      {/* Échelle 1,3 : le train reste lisible sur les petits plans. */}
      <g>
        <g transform="scale(1.3)">
          {/* Wagon */}
          <rect
            x={-26}
            y={-15}
            width={52}
            height={30}
            rx={6}
            fill="var(--green)"
            stroke="var(--header)"
            strokeWidth={2.5}
          />
          <rect x={-18} y={-8} width={36} height={16} rx={3} fill="var(--wood)" />
          <circle cx={-31} cy={0} r={4} fill="var(--header)" />
        </g>
        <animateMotion dur={dur} repeatCount="indefinite" rotate="auto" path={path} />
      </g>
      <g>
        <g transform="scale(1.3)">
          {/* Locomotive */}
          <rect
            x={-30}
            y={-16}
            width={60}
            height={32}
            rx={7}
            fill="var(--accent)"
            stroke="var(--header)"
            strokeWidth={2.5}
          />
          <rect x={-26} y={-12} width={20} height={24} rx={4} fill="var(--header)" />
          <circle cx={14} cy={0} r={7} fill="var(--header)" />
          <circle cx={14} cy={0} r={3} fill="var(--wood)" />
          <circle cx={-35} cy={0} r={4} fill="var(--header)" />
        </g>
        <animateMotion dur={dur} begin={lead} repeatCount="indefinite" rotate="auto" path={path} />
      </g>
    </g>
  );
}
