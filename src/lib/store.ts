"use client";

import { useSyncExternalStore } from "react";
import { setList } from "./catalog";
import type { AgeBand } from "./profiles";
import { addSet, type Inventory } from "./track-engine";

// Version 1 sans compte : tout est enregistré dans le navigateur (localStorage).
// Le lot 1 remplacera ce stockage par Supabase, avec la même forme de données.

export { AGE_OF_BAND, AVATAR_COLORS, type AgeBand } from "./profiles";

export interface ChildProfile {
  id: string;
  nickname: string;
  ageBand: AgeBand;
  avatar: number;
}

/** `layoutId` : code du circuit (voir `circuitFromCode`). */
export interface BuildLog {
  childId: string;
  layoutId: string;
  date: string;
}

export interface Favorite {
  childId: string;
  layoutId: string;
}

/** Réglages du générateur, retenus d'une visite à l'autre. */
export interface GeneratorPrefs {
  sizes: ("small" | "medium" | "large")[];
  bridge: boolean;
  switches: boolean;
  crossing: boolean;
  decorate: boolean;
}

interface Box {
  /** Coffrets possédés : identifiant → nombre. */
  sets: Record<string, number>;
  /** Corrections pièce par pièce (positives ou négatives), en plus des coffrets. */
  adjustments: Inventory;
}

export interface AppState extends Box {
  version: 2;
  /** États précédents de la caisse, pour annuler la dernière action. */
  history: Box[];
  /** Photo de sa propre boîte (réduite), par coffret : reste sur l'appareil. */
  photos: Record<string, string>;
  children: ChildProfile[];
  activeChildId: string | null;
  builds: BuildLog[];
  favorites: Favorite[];
  prefs: GeneratorPrefs;
  createdAt: string;
}

const KEY = "rail-builder:v2";
const OLD_KEY = "rail-builder:v1";
const MAX_HISTORY = 30;
export const MAX_CHILDREN = 6;

const initial: AppState = {
  version: 2,
  sets: {},
  adjustments: {},
  history: [],
  photos: {},
  children: [],
  activeChildId: null,
  builds: [],
  favorites: [],
  prefs: { sizes: [], bridge: false, switches: false, crossing: false, decorate: true },
  createdAt: "",
};

/** Inventaire réel : pièces des coffrets + corrections, jamais négatif. */
export function inventoryOf(box: Box): Inventory {
  let inv: Inventory = {};
  for (const [id, qty] of Object.entries(box.sets)) {
    const set = setList.find((x) => x.id === id);
    if (set && qty > 0) inv = addSet(inv, set, qty);
  }
  for (const [id, delta] of Object.entries(box.adjustments)) inv[id] = (inv[id] ?? 0) + delta;
  for (const id of Object.keys(inv)) if (inv[id] <= 0) delete inv[id];
  return inv;
}

let state: AppState = initial;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as AppState;
      state = { ...initial, ...saved, prefs: { ...initial.prefs, ...saved.prefs } };
    } else {
      // Reprise de la version 1 : l'ancienne caisse devient des corrections pièce par pièce.
      const old = window.localStorage.getItem(OLD_KEY);
      if (old) {
        const v1 = JSON.parse(old) as { inventory?: Inventory } & Partial<AppState>;
        state = {
          ...initial,
          adjustments: v1.inventory ?? {},
          children: v1.children ?? [],
          activeChildId: v1.activeChildId ?? null,
          builds: v1.builds ?? [],
          createdAt: v1.createdAt ?? "",
        };
      }
    }
  } catch {
    // Stockage indisponible (navigation privée…) : l'app fonctionne, sans mémoire.
  }
}

function save(next: AppState) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Idem : on garde l'état en mémoire.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    loaded = false;
    load();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  load();
  return state;
}

/** État de l'app ; `ready` est faux pendant le premier rendu (avant lecture du navigateur). */
export function useAppState(): AppState & { ready: boolean; inventory: Inventory } {
  const s = useSyncExternalStore(subscribe, getSnapshot, () => initial);
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return { ...s, ready, inventory: inventoryCache(s) };
}

let lastBox: AppState | null = null;
let lastInventory: Inventory = {};
function inventoryCache(s: AppState): Inventory {
  if (s !== lastBox) {
    lastBox = s;
    lastInventory = inventoryOf(s);
  }
  return lastInventory;
}

function update(fn: (s: AppState) => AppState) {
  load();
  save(fn(state));
}

function withHistory(s: AppState, box: Partial<Box>): AppState {
  const previous: Box = { sets: s.sets, adjustments: s.adjustments };
  return {
    ...s,
    ...box,
    createdAt: s.createdAt || new Date().toISOString(),
    history: [...s.history, previous].slice(-MAX_HISTORY),
  };
}

const newId = () => Math.random().toString(36).slice(2, 10);

export const actions = {
  /** Fixe la quantité totale d'une pièce : la différence avec les coffrets devient une correction. */
  setQuantity(pieceTypeId: string, quantity: number) {
    update((s) => {
      const q = Math.max(0, Math.min(999, Math.round(quantity) || 0));
      const current = inventoryOf(s)[pieceTypeId] ?? 0;
      if (current === q) return s;
      const fromSets = inventoryOf({ sets: s.sets, adjustments: {} })[pieceTypeId] ?? 0;
      const adjustments = { ...s.adjustments, [pieceTypeId]: q - fromSets };
      if (adjustments[pieceTypeId] === 0) delete adjustments[pieceTypeId];
      return withHistory(s, { adjustments });
    });
  },
  setSetCount(setId: string, count: number) {
    if (!setList.some((x) => x.id === setId)) return;
    update((s) => {
      const n = Math.max(0, Math.min(20, Math.round(count) || 0));
      if ((s.sets[setId] ?? 0) === n) return s;
      const sets = { ...s.sets, [setId]: n };
      if (n === 0) delete sets[setId];
      return withHistory(s, { sets });
    });
  },
  addSet(setId: string) {
    load();
    actions.setSetCount(setId, (state.sets[setId] ?? 0) + 1);
  },
  undo() {
    update((s) => {
      const previous = s.history[s.history.length - 1];
      return previous ? { ...s, ...previous, history: s.history.slice(0, -1) } : s;
    });
  },
  clearInventory() {
    update((s) => withHistory(s, { sets: {}, adjustments: {} }));
  },
  setPhoto(setId: string, dataUrl: string | null) {
    update((s) => {
      const photos = { ...s.photos };
      if (dataUrl) photos[setId] = dataUrl;
      else delete photos[setId];
      return { ...s, photos };
    });
  },
  setPrefs(patch: Partial<GeneratorPrefs>) {
    update((s) => ({ ...s, prefs: { ...s.prefs, ...patch } }));
  },
  addChild(child: Omit<ChildProfile, "id">) {
    update((s) => {
      if (s.children.length >= MAX_CHILDREN) return s;
      const c = { ...child, nickname: child.nickname.trim().slice(0, 20), id: newId() };
      return { ...s, children: [...s.children, c], activeChildId: s.activeChildId ?? c.id };
    });
  },
  updateChild(id: string, patch: Partial<Omit<ChildProfile, "id">>) {
    update((s) => ({ ...s, children: s.children.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  },
  removeChild(id: string) {
    update((s) => {
      const children = s.children.filter((c) => c.id !== id);
      return {
        ...s,
        children,
        activeChildId: s.activeChildId === id ? (children[0]?.id ?? null) : s.activeChildId,
        builds: s.builds.filter((b) => b.childId !== id),
        favorites: s.favorites.filter((f) => f.childId !== id),
      };
    });
  },
  setActiveChild(id: string) {
    update((s) => ({ ...s, activeChildId: id }));
  },
  toggleFavorite(childId: string, layoutId: string) {
    update((s) => {
      const exists = s.favorites.some((f) => f.childId === childId && f.layoutId === layoutId);
      return {
        ...s,
        favorites: exists
          ? s.favorites.filter((f) => !(f.childId === childId && f.layoutId === layoutId))
          : [...s.favorites, { childId, layoutId }],
      };
    });
  },
  logBuild(childId: string, layoutId: string) {
    update((s) => ({ ...s, builds: [...s.builds, { childId, layoutId, date: new Date().toISOString() }] }));
  },
  /** Supprime toutes les données (EF-05). */
  deleteAll() {
    try {
      window.localStorage.removeItem(KEY);
      window.localStorage.removeItem(OLD_KEY);
    } catch {}
    save({ ...initial });
  },
  /** Export JSON de toutes les données (EF-05). */
  exportJson(): string {
    load();
    const { history: _history, photos: _photos, ...data } = state;
    void _history;
    void _photos;
    return JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2);
  },
};

export type BadgeId = "first" | "three" | "five" | "explorer" | "ten";

/** Badges gagnés par un enfant, dans l'ordre où ils se débloquent. */
export function badgesFor(builds: BuildLog[], childId: string): { id: BadgeId; earned: boolean }[] {
  const mine = builds.filter((b) => b.childId === childId);
  const distinct = new Set(mine.map((b) => b.layoutId)).size;
  return [
    { id: "first", earned: mine.length >= 1 },
    { id: "three", earned: mine.length >= 3 },
    { id: "explorer", earned: distinct >= 3 },
    { id: "five", earned: mine.length >= 5 },
    { id: "ten", earned: mine.length >= 10 },
  ];
}
