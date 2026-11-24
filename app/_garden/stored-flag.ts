import { useSyncExternalStore } from "react";

/**
 * A boolean preference kept in this browser only (localStorage), shared by
 * every component that reads it. If storage is unavailable (private mode,
 * blocked site data) the value still works for the session, it just does not
 * survive a reload.
 */
export function createStoredFlag(key: string, defaultValue: boolean) {
  const listeners = new Set<() => void>();
  let fallback = defaultValue;

  function get() {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) return stored === "on";
    } catch {
      // Fall through to the in-memory value.
    }
    return fallback;
  }

  function set(value: boolean) {
    fallback = value;
    try {
      window.localStorage.setItem(key, value ? "on" : "off");
    } catch {
      // Keep the in-memory value only.
    }
    listeners.forEach((listener) => listener());
  }

  function subscribe(listener: () => void) {
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) listener();
    };
    listeners.add(listener);
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  function useValue() {
    return useSyncExternalStore(subscribe, get, () => defaultValue);
  }

  return { get, set, useValue };
}

/** Whether this viewer sees the inner grid lines. Never affects other viewers. */
export const showGridFlag = createStoredFlag("garden:show-grid", true);

/** Set once the viewer has panned or zoomed, which retires the how-to hint. */
export const hintDismissedFlag = createStoredFlag("garden:hint-dismissed", false);
