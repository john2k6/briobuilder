"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { TrackPlan, type StepState } from "@/components/TrackPlan";
import { Avatar, Icon, icons } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { catalog } from "@/lib/catalog";
import { circuitFromCode, circuitHref } from "@/lib/circuits";
import { useCircuitName } from "@/components/CircuitCard";
import { useSearchParams } from "next/navigation";
import type { Placement } from "@/lib/track-engine";
import { actions, badgesFor, useAppState, type BadgeId } from "@/lib/store";

const SPEECH_LANG: Record<string, string> = { fr: "fr-FR", en: "en-GB" };

function speak(text: string, locale: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = SPEECH_LANG[locale] ?? locale;
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

/** Sortie protégée : un adulte maintient le bouton 3 secondes (EF-06). */
/** Bouton pour quitter le mode construction : un simple appui. */
function ExitButton({ onExit, label }: { onExit: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onExit}
      className="flex size-16 shrink-0 items-center justify-center rounded-full bg-surface text-muted"
    >
      <Icon d={icons.close} className="size-6" />
    </button>
  );
}

function Confetti() {
  const colors = ["var(--accent)", "var(--green)", "var(--wood)", "var(--header)"];
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden motion-reduce:hidden" aria-hidden="true">
      {Array.from({ length: 36 }, (_, i) => (
        <span
          key={i}
          className="confetti absolute top-1/3 size-3 rounded-sm"
          style={{
            left: `${50 + ((i * 37) % 60) - 30}%`,
            background: colors[i % colors.length],
            ["--dx" as string]: `${((i * 53) % 400) - 200}px`,
            ["--dy" as string]: `${-120 - ((i * 29) % 200)}px`,
            ["--rot" as string]: `${(i * 47) % 360}deg`,
          }}
        />
      ))}
    </div>
  );
}

const EMPTY: Placement[] = [];

export function BuildView() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const code = useSearchParams().get("c") ?? "";
  const circuit = circuitFromCode(code);
  const nameOf = useCircuitName();
  const placements = circuit?.placements ?? EMPTY;
  const { children, activeChildId, builds, ready } = useAppState();
  const total = Math.max(1, placements.length);
  const [step, setStep] = useState(0);
  const [finished, setFinished] = useState(false);
  const [logged, setLogged] = useState<BadgeId[] | null>(null);
  const [sound, setSound] = useState(true);

  const child = children.find((c) => c.id === activeChildId);
  /** Consigne et précision (retourner la pièce, la poser en hauteur, redescendre…). */
  const describe = (p: Placement | undefined) => {
    if (!p) return { text: "", hint: null as string | null };
    const text = t("build.place", { piece: t(`pieceNames.${p.pieceTypeId}`) });
    const hint =
      p.pieceTypeId === "ramp-reverse"
        ? t("build.down")
        : p.pieceTypeId === "ramp"
          ? t("build.up")
          : (p.level ?? 0) > 0
            ? t("build.elevated")
            : p.flipped
              ? t("build.flip")
              : null;
    return { text, hint };
  };
  const placement = placements[Math.min(step, total - 1)];
  const { text: instruction, hint: flipHint } = describe(placement);

  // Bloque le défilement de la page derrière le mode enfant.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      window.speechSynthesis?.cancel();
    };
  }, []);

  const say = useCallback(
    (text: string) => {
      if (sound) speak(text, locale);
    },
    [sound, locale],
  );

  const go = (next: number) => {
    if (next >= total) {
      setFinished(true);
      say(`${t("build.done")} ${t("build.doneText")}`);
      return;
    }
    const target = Math.max(0, next);
    setStep(target);
    const { text, hint } = describe(placements[target]);
    say(hint ? `${text}. ${hint}` : text);
  };

  // Flèches du clavier pour l'adulte qui accompagne.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished) return;
      if (e.key === "ArrowRight") go(step + 1);
      if (e.key === "ArrowLeft") go(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onBuilt = () => {
    if (!child) {
      router.push("/circuits");
      return;
    }
    const before = new Set(
      badgesFor(builds, child.id)
        .filter((b) => b.earned)
        .map((b) => b.id),
    );
    actions.logBuild(child.id, code);
    const after = badgesFor([...builds, { childId: child.id, layoutId: code, date: "" }], child.id);
    setLogged(after.filter((b) => b.earned && !before.has(b.id)).map((b) => b.id));
  };

  const steps: Record<string, StepState> = Object.fromEntries(
    placements.map((p, i) => [p.id, finished || i < step ? "done" : i === step ? "current" : "todo"]),
  );

  if (!circuit || !placement) {
    return (
      <div className="space-y-6">
        <p className="rounded-2xl border border-border p-6 text-lg">{t("circuit.notFound")}</p>
        <Link href="/circuits" className="font-bold text-accent">
          {t("common.back")}
        </Link>
      </div>
    );
  }
  const name = nameOf(circuit);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true" aria-label={name}>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <ExitButton onExit={() => router.push(circuitHref(code))} label={t("build.exit")} />
        <p className="text-center font-display text-xl font-bold uppercase sm:text-2xl" aria-live="polite">
          {finished ? t("build.done") : t("build.step", { step: step + 1, total })}
        </p>
        <button
          type="button"
          onClick={() => setSound((s) => !s)}
          aria-pressed={sound}
          aria-label={sound ? t("build.soundOn") : t("build.soundOff")}
          className="flex size-16 shrink-0 items-center justify-center rounded-full bg-green text-green-ink aria-[pressed=false]:bg-border aria-[pressed=false]:text-muted"
        >
          <Icon d={sound ? icons.sound : icons.mute} className="size-7" />
        </button>
      </div>

      <div className="h-2 bg-border" aria-hidden="true">
        <div
          className="h-full bg-green transition-[width] duration-300"
          style={{ width: `${((finished ? total : step) / total) * 100}%` }}
        />
      </div>

      <div className="wood-floor flex min-h-0 flex-1 items-center justify-center p-4 sm:p-8">
        <TrackPlan
          placements={placements}
          catalog={catalog}
          title={name}
          accessories={finished ? circuit.accessories : []}
          steps={steps}
          train={finished}
          showConnectors={!finished}
          className="h-full max-h-full w-full"
        />
      </div>

      {!finished ? (
        <div className="space-y-4 px-4 pb-6 pt-4">
          <button
            type="button"
            onClick={() => say(flipHint ? `${instruction}. ${flipHint}` : instruction)}
            className="mx-auto flex min-h-16 w-full max-w-2xl items-center gap-4 rounded-3xl bg-surface p-3 text-left ring-2 ring-border"
          >
            <span className="wood-floor w-20 shrink-0 rounded-2xl p-1.5">
              <TrackPlan
                placements={[{ ...placement, id: "preview", x: 0, y: 0, rotation: 0 }]}
                catalog={catalog}
                title=""
                frame={{ width: 280, height: 200 }}
                showConnectors={false}
                className="w-full"
              />
            </span>
            <span className="flex-1">
              <span className="block font-display text-xl font-bold uppercase leading-tight sm:text-2xl">
                {instruction}
              </span>
              {flipHint && <span className="block font-semibold uppercase text-accent">{flipHint}</span>}
            </span>
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-green text-green-ink">
              <Icon d={icons.sound} />
              <span className="sr-only">{t("build.listen")}</span>
            </span>
          </button>
          <div className="mx-auto grid max-w-2xl grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => go(step - 1)}
              disabled={step === 0}
              className="flex min-h-20 items-center justify-center gap-2 rounded-3xl bg-border text-xl font-bold uppercase disabled:opacity-40"
            >
              <Icon d={icons.left} className="size-8" />
              {t("build.prev")}
            </button>
            <button
              type="button"
              onClick={() => go(step + 1)}
              className="flex min-h-20 items-center justify-center gap-2 rounded-3xl bg-accent text-xl font-bold uppercase text-accent-ink shadow-[0_6px_0_0_var(--accent-dark)] active:translate-y-1 active:shadow-[0_2px_0_0_var(--accent-dark)]"
            >
              {t("build.next")}
              <Icon d={icons.right} className="size-8" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 px-4 pb-6 pt-4 text-center">
          <Confetti />
          {logged === null ? (
            <>
              <p className="text-lg font-semibold">{t("build.doneText")}</p>
              <button
                type="button"
                onClick={onBuilt}
                disabled={!ready}
                className="mx-auto flex min-h-20 w-full max-w-2xl items-center justify-center gap-3 rounded-3xl bg-green text-2xl font-bold uppercase text-green-ink shadow-[0_6px_0_0_var(--header)]"
              >
                {child && <Avatar nickname={child.nickname} color={child.avatar} size="size-11" />}
                {t("build.iBuiltIt")}
              </button>
            </>
          ) : (
            <>
              {logged.length > 0 && (
                <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-3" role="status">
                  <span className="font-display text-xl font-bold text-accent">{t("build.newBadge")}</span>
                  {logged.map((b) => (
                    <span key={b} className="rounded-full bg-accent px-4 py-2 font-semibold text-accent-ink">
                      {t(`badges.${b}`)}
                    </span>
                  ))}
                </div>
              )}
              <Link
                href="/circuits"
                className="mx-auto flex min-h-20 w-full max-w-2xl items-center justify-center rounded-3xl bg-accent text-xl font-bold uppercase text-accent-ink"
              >
                {t("build.again")}
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
