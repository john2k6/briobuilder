"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Avatar, buttonPrimary, buttonSecondary, card, Icon, icons, PageHeader } from "@/components/ui";
import {
  actions,
  AVATAR_COLORS,
  badgesFor,
  MAX_CHILDREN,
  useAppState,
  type AgeBand,
  type BadgeId,
  type ChildProfile,
} from "@/lib/store";

const AGE_BANDS: AgeBand[] = ["3-4", "5-6", "7+"];

const BADGE_ICONS: Record<BadgeId, string> = {
  first: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  three: "M5 18h14M7 18V9h10v9M9 9V6h6v3",
  explorer: "M12 21a9 9 0 100-18 9 9 0 000 18zM15.5 8.5l-2 5-5 2 2-5z",
  five: "M6 20h12M8 20v-6h8v6M10 14V9l2-5 2 5v5",
  ten: "M4 20h16M6 20V10l6-6 6 6v10M10 20v-5h4v5",
};

function ChildForm({ initial, onDone }: { initial?: ChildProfile; onDone: () => void }) {
  const t = useTranslations();
  const [nickname, setNickname] = useState(initial?.nickname ?? "");
  const [ageBand, setAgeBand] = useState<AgeBand>(initial?.ageBand ?? "3-4");
  const [avatar, setAvatar] = useState(initial?.avatar ?? 0);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    if (initial) actions.updateChild(initial.id, { nickname: nickname.trim(), ageBand, avatar });
    else actions.addChild({ nickname, ageBand, avatar });
    onDone();
  };

  return (
    <form onSubmit={submit} className={`${card} space-y-5 p-6`}>
      <label className="block space-y-2">
        <span className="font-semibold">{t("kids.nickname")}</span>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          required
          autoComplete="off"
          placeholder={t("kids.nicknameHint")}
          className="min-h-12 w-full rounded-2xl border-2 border-border bg-surface px-4 outline-none focus:border-header"
        />
      </label>
      <fieldset className="space-y-2">
        <legend className="font-semibold">{t("kids.ageBand")}</legend>
        <div className="flex flex-wrap gap-2">
          {AGE_BANDS.map((band) => (
            <label key={band} className="cursor-pointer">
              <input
                type="radio"
                name="age"
                value={band}
                checked={ageBand === band}
                onChange={() => setAgeBand(band)}
                className="peer sr-only"
              />
              <span className="inline-flex min-h-12 items-center rounded-full border-2 border-border px-4 font-semibold peer-checked:border-header peer-checked:bg-header peer-checked:text-header-ink peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                {t(`kids.ages.${band}`)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="font-semibold">{t("kids.avatar")}</legend>
        <div className="flex flex-wrap gap-2">
          {AVATAR_COLORS.map((color, i) => (
            <label key={color} className="cursor-pointer">
              <input
                type="radio"
                name="avatar"
                checked={avatar === i}
                onChange={() => setAvatar(i)}
                className="peer sr-only"
                aria-label={`${i + 1}`}
              />
              <span className="flex size-12 items-center justify-center rounded-full ring-offset-2 ring-offset-surface peer-checked:ring-4 peer-checked:ring-header peer-focus-visible:ring-4 peer-focus-visible:ring-accent">
                <Avatar nickname={nickname || "?"} color={i} size="size-12" />
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={buttonPrimary}>
          {t("common.save")}
        </button>
        <button type="button" className={buttonSecondary} onClick={onDone}>
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

export function KidsView() {
  const t = useTranslations();
  const { children, activeChildId, builds, ready } = useAppState();
  const [editing, setEditing] = useState<string | "new" | null>(null);

  return (
    <div className="space-y-8">
      <PageHeader title={t("kids.title")} intro={t("kids.intro")}>
        {ready && editing === null && (
          <button
            type="button"
            className={buttonPrimary}
            onClick={() => setEditing("new")}
            disabled={children.length >= MAX_CHILDREN}
          >
            <Icon d={icons.plus} className="size-5" />
            {t("kids.add")}
          </button>
        )}
      </PageHeader>
      {ready && children.length >= MAX_CHILDREN && <p className="text-muted">{t("kids.max")}</p>}

      {editing === "new" && <ChildForm onDone={() => setEditing(null)} />}

      {ready && children.length === 0 && editing === null && (
        <p className={`${card} p-6 text-muted`}>{t("kids.none")}</p>
      )}

      <ul className="grid gap-5 md:grid-cols-2">
        {children.map((child) => {
          if (editing === child.id) {
            return (
              <li key={child.id} className="md:col-span-2">
                <ChildForm initial={child} onDone={() => setEditing(null)} />
              </li>
            );
          }
          const count = builds.filter((b) => b.childId === child.id).length;
          const active = child.id === activeChildId;
          return (
            <li key={child.id} className={`${card} space-y-5 p-6 ${active ? "border-header" : ""}`}>
              <div className="flex flex-wrap items-center gap-4">
                <Avatar nickname={child.nickname} color={child.avatar} size="size-16 text-2xl" />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-display text-2xl font-bold">{child.nickname}</h2>
                  <p className="text-muted">
                    {t(`kids.ages.${child.ageBand}`)} · {t("kids.built", { count })}
                  </p>
                </div>
                {active ? (
                  <span className="rounded-full bg-header px-3 py-1 text-sm font-semibold text-header-ink">
                    {t("kids.active")}
                  </span>
                ) : (
                  <button type="button" className={buttonSecondary} onClick={() => actions.setActiveChild(child.id)}>
                    {t("kids.choose")}
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">{t("kids.badges")}</h3>
                <ul className="grid grid-cols-5 gap-2">
                  {badgesFor(builds, child.id).map((b) => (
                    <li
                      key={b.id}
                      className="flex flex-col items-center gap-1 text-center"
                      title={t(`badges.${b.id}Text`)}
                    >
                      <span
                        className={`flex size-14 items-center justify-center rounded-full ${b.earned ? "bg-accent text-accent-ink shadow-[0_3px_0_0_var(--accent-dark)]" : "bg-border text-muted opacity-60"}`}
                      >
                        <Icon d={BADGE_ICONS[b.id]} className="size-7" />
                      </span>
                      <span className={`text-xs font-semibold leading-tight ${b.earned ? "" : "text-muted"}`}>
                        {t(`badges.${b.id}`)}
                      </span>
                      <span className="sr-only">{b.earned ? t(`badges.${b.id}Text`) : t("badges.locked")}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" className={buttonSecondary} onClick={() => setEditing(child.id)}>
                  {t("kids.edit")}
                </button>
                <button
                  type="button"
                  className={buttonSecondary}
                  onClick={() => window.confirm(t("kids.removeConfirm")) && actions.removeChild(child.id)}
                >
                  <Icon d={icons.trash} className="size-5" />
                  {t("common.delete")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
