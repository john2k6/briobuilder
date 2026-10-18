import type { ReactNode } from "react";
import { AVATAR_COLORS } from "@/lib/profiles";

export const iconClass = "fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]";

export function Icon({ d, className = "size-6" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} ${iconClass}`} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export const icons = {
  check: "M5 12l5 5 9-10",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  undo: "M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4",
  heart: "M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z",
  sound: "M4 9v6h4l5 4V5L8 9H4zM16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11",
  mute: "M4 9v6h4l5 4V5L8 9H4zM17 9l5 6M22 9l-5 6",
  close: "M6 6l12 12M18 6L6 18",
  left: "M15 5l-7 7 7 7",
  right: "M9 5l7 7-7 7",
  box: "M3 8l9-4 9 4-9 4-9-4zM3 8v8l9 4 9-4V8M12 12v8",
  print: "M7 9V4h10v5M7 17H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2h-2M7 14h10v6H7z",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 100-8 4 4 0 000 8z",
  up: "M6 15l6-6 6 6",
  down: "M6 9l6 6 6-6",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6",
  bridge: "M3 17h18M5 17v-4a7 7 0 0114 0v4M9 17v-3M15 17v-3",
  switch: "M4 20V4M4 12c6 0 10-4 16-8M4 12c6 0 10 2 16 8",
  cross: "M4 4l16 16M20 4L4 20",
  cart: "M3 4h2l2.5 11h11L21 7H6.5M9 20a1 1 0 100-2 1 1 0 000 2zM18 20a1 1 0 100-2 1 1 0 000 2z",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
};

export function Check({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} shrink-0 fill-none stroke-current stroke-[3] [stroke-linecap:round] [stroke-linejoin:round]`}
      aria-hidden="true"
    >
      <path d={icons.check} />
    </svg>
  );
}

export function Stars({ level, label }: { level: number; label: string }) {
  return (
    <span className="flex gap-0.5 text-accent" role="img" aria-label={label}>
      {[1, 2, 3].map((n) => (
        <svg
          key={n}
          viewBox="0 0 24 24"
          className={`size-4 ${n <= level ? "fill-current" : "fill-border"}`}
          aria-hidden="true"
        >
          <path d={icons.star} />
        </svg>
      ))}
    </span>
  );
}

export function Avatar({ nickname, color, size = "size-10" }: { nickname: string; color: number; size?: string }) {
  return (
    <span
      className={`${size} inline-flex shrink-0 items-center justify-center rounded-full font-extrabold text-white`}
      style={{ background: AVATAR_COLORS[color % AVATAR_COLORS.length] }}
      aria-hidden="true"
    >
      {nickname.slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}

export function PageHeader({ title, intro, children }: { title: string; intro?: string; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">{title}</h1>
        {intro && <p className="text-lg text-muted">{intro}</p>}
      </div>
      {children}
    </header>
  );
}

/** Logo : un rail en bois et une locomotive sur fond rouge. */
export function Logo({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={`${className} shrink-0`} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="var(--accent)" />
      <path d="M26 64A38 38 0 0 1 64 26" fill="none" stroke="#a9783f" strokeWidth="18" />
      <path d="M26 64A38 38 0 0 1 64 26" fill="none" stroke="#e2bd86" strokeWidth="14.5" />
      <g transform="translate(37.1 37.1) rotate(-45)">
        <rect x="-10" y="-7" width="20" height="14" rx="3" fill="#1b2a4a" />
        <circle cx="5" cy="0" r="2.6" fill="#e2bd86" />
      </g>
    </svg>
  );
}

/** Titre de section, gris ardoise, à la manière des grandes rubriques. */
export function SectionTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`text-3xl font-semibold tracking-tight md:text-4xl ${className}`}>{children}</h2>;
}

export const buttonPrimary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 font-bold text-accent-ink transition hover:bg-accent-dark active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-accent";
export const buttonSecondary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-ink px-5 font-bold text-ink transition-colors hover:bg-ink hover:text-background disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink";
export const buttonGreen =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-green px-6 font-bold text-green-ink transition hover:bg-green-dark disabled:opacity-40";
export const card = "rounded-2xl border border-border bg-surface";
/** Carte « bulle » : un grand coin arrondi en haut à gauche et en bas à droite. */
export const blob = "rounded-tl-[2.5rem] rounded-br-[2.5rem] rounded-tr-xl rounded-bl-xl overflow-hidden";
