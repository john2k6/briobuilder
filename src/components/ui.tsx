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
  cart: "M3 4h2l2.5 11h11L21 7H6.5M9 20a1 1 0 100-2 1 1 0 000 2zM18 20a1 1 0 100-2 1 1 0 000 2z",
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
      className={`${size} inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold text-white`}
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
      <div className="max-w-2xl space-y-2">
        <h1 className="font-display text-4xl font-bold tracking-tight">{title}</h1>
        {intro && <p className="text-lg text-muted">{intro}</p>}
      </div>
      {children}
    </header>
  );
}

export const buttonPrimary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 font-semibold text-accent-ink shadow-[0_4px_0_0_var(--accent-dark)] transition active:translate-y-0.5 active:shadow-[0_2px_0_0_var(--accent-dark)] disabled:opacity-40";
export const buttonSecondary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-header px-5 font-semibold transition-colors hover:bg-header hover:text-header-ink disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-current";
export const card = "rounded-3xl border-2 border-border bg-surface";
