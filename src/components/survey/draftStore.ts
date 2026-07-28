"use client";

/**
 * The in-progress survey, kept on the device and nowhere else.
 *
 * A server-side draft would be an identity — something durable that can be
 * tied back to a person across requests. Keeping partial answers in
 * localStorage means a refresh costs the visitor nothing while we still hold
 * nothing.
 *
 * Modelled as an external store rather than component state so React can read
 * it with `useSyncExternalStore`: the server snapshot is empty, the client
 * snapshot is whatever was saved, and React swaps between them after
 * hydration without a mismatch warning or a cascading re-render.
 */

const STORAGE_KEY = "wwe-draft";
export const STEP_KEY = "__step";
/** Furthest screen reached, so a revisit can return there in one step instead of replaying every screen. */
export const FURTHEST_STEP_KEY = "__furthestStep";
const BOOKKEEPING_KEYS = new Set([STEP_KEY, FURTHEST_STEP_KEY]);

export type Draft = Record<string, unknown>;

const EMPTY: Draft = Object.freeze({});

let snapshot: Draft = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function persist(draft: Draft) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage unavailable (private mode, blocked). The survey still works;
    // a refresh just loses the draft.
  }
}

/**
 * Snapshot for the client. Loads once, then returns a stable reference —
 * `useSyncExternalStore` calls this during render and would loop forever if it
 * returned a fresh object each time.
 */
export function getDraft(): Draft {
  if (!loaded) {
    loaded = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) snapshot = JSON.parse(raw) as Draft;
    } catch {
      snapshot = EMPTY;
    }
  }
  return snapshot;
}

/** The server cannot know what is on someone's device. */
export function getServerDraft(): Draft {
  return EMPTY;
}

export function subscribeToDraft(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function commit(next: Draft) {
  snapshot = next;
  loaded = true;
  persist(next);
  listeners.forEach((notify) => notify());
}

export function setDraftValue(key: string, value: unknown) {
  commit({ ...getDraft(), [key]: value });
}

/** Sets several keys as one write, so callers that update related bookkeeping together don't notify listeners twice. */
export function setDraftValues(patch: Draft) {
  commit({ ...getDraft(), ...patch });
}

/** Seeds answers the landing page already collected, without clobbering saved ones. */
export function seedDraft(seed: Draft) {
  if (Object.keys(seed).length === 0) return;
  commit({ ...getDraft(), ...seed });
}

export function clearDraft() {
  snapshot = EMPTY;
  loaded = true;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clean up */
  }
  listeners.forEach((notify) => notify());
}

/** The answers alone — step markers are bookkeeping, never a survey answer. */
export function answersOf(draft: Draft): Draft {
  return Object.fromEntries(Object.entries(draft).filter(([key]) => !BOOKKEEPING_KEYS.has(key)));
}
