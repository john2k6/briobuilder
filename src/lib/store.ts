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

export interface BuildLog {
  childId: string;
  layoutId: string;
  date: string;
}

export interface Favorite {
  childId: string;
  layoutId: string;
}

export interface AppState {
  version: 1;
  inventory: Inventory;
  /** Inventaires précédents, pour annuler la dernière action. */
  history: Inventory[];
  children: ChildProfile[];
  activeChildId: string | null;
  builds: BuildLog[];
  favorites: Favorite[];
  createdAt: string;
}

const KEY = "rail-builder:v1";
const MAX_HISTORY = 30;
export const MAX_CHILDREN = 6;

const initial: AppState = {
  version: 1,
  inventory: {},
  history: [],
  children: [],
  activeChildId: null,
  builds: [],
  favorites: [],
  createdAt: "",
};

let state: AppState = initial;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...initial, ...(JSON.parse(raw) as AppState) };
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
export function useAppState(): AppState & { ready: boolean } {
  const s = useSyncExternalStore(subscribe, getSnapshot, () => initial);
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return { ...s, ready };
}

function update(fn: (s: AppState) => AppState) {
  load();
  save(fn(state));
}

function withHistory(s: AppState, inventory: Inventory): AppState {
  return { ...s, inventory, history: [...s.history, s.inventory].slice(-MAX_HISTORY) };
}

const newId = () => Math.random().toString(36).slice(2, 10);

export const actions = {
  setQuantity(pieceTypeId: string, quantity: number) {
    update((s) => {
      const q = Math.max(0, Math.min(999, Math.round(quantity) || 0));
      if ((s.inventory[pieceTypeId] ?? 0) === q) return s;
      const inventory = { ...s.inventory };
      if (q === 0) delete inventory[pieceTypeId];
      else inventory[pieceTypeId] = q;
      return withHistory(s, inventory);
    });
  },
  addSet(setId: string) {
    const set = setList.find((x) => x.id === setId);
    if (!set) return;
    update((s) => withHistory({ ...s, createdAt: s.createdAt || new Date().toISOString() }, addSet(s.inventory, set)));
  },
  undo() {
    update((s) =>
      s.history.length === 0
        ? s
        : { ...s, inventory: s.history[s.history.length - 1], history: s.history.slice(0, -1) },
    );
  },
  clearInventory() {
    update((s) => withHistory(s, {}));
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
    } catch {}
    save({ ...initial });
  },
  /** Export JSON de toutes les données (EF-05). */
  exportJson(): string {
    load();
    const { history: _history, ...data } = state;
    void _history;
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
