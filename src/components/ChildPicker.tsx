"use client";

import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui";
import { actions, useAppState } from "@/lib/store";

/** Choix de l'enfant actif (classement, favoris, badges). */
export function ChildPicker() {
  const t = useTranslations("kids");
  const { children, activeChildId, ready } = useAppState();
  if (!ready || children.length === 0) return null;
  return (
    <div role="radiogroup" aria-label={t("active")} className="flex flex-wrap gap-2">
      {children.map((c) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={c.id === activeChildId}
          onClick={() => actions.setActiveChild(c.id)}
          className="inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-border bg-surface py-1 pl-1 pr-4 font-semibold aria-checked:border-header aria-checked:bg-header aria-checked:text-header-ink"
        >
          <Avatar nickname={c.nickname} color={c.avatar} size="size-9" />
          {c.nickname}
        </button>
      ))}
    </div>
  );
}
