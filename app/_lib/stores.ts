import { useSyncExternalStore } from "react";

/**
 * A JSON value kept in this browser's localStorage and shared by every
 * component that reads it, including other open tabs. TEMPORARY home for game
 * data until there is a backend. If storage is unavailable (private mode,
 * blocked site data, quota) the value still works for this session; it just
 * does not survive a reload.
 *
 * `parse` receives whatever JSON was stored and must return a valid value, so
 * data saved by an older version of the app is upgraded as it is read.
 */
export function createStoredJson<T>(key: string, empty: T, parse: (stored: unknown) => T) {
  const listeners = new Set<() => void>();
  let memory = empty;
  let storageWorks = true;
  // useSyncExternalStore needs the very same value back while nothing changed.
  let cache: { raw: string | null; value: T } = { raw: null, value: empty };

  function get(): T {
    if (!storageWorks) return memory;
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      return memory;
    }
    if (raw === null) return memory;
    if (raw !== cache.raw) {
      let value = empty;
      try {
        value = parse(JSON.parse(raw));
      } catch {
        // Unreadable data: start empty rather than crash the page.
      }
      cache = { raw, value };
    }
    return cache.value;
  }

  function set(value: T) {
    memory = value;
    try {
      const raw = JSON.stringify(value);
      window.localStorage.setItem(key, raw);
      cache = { raw, value };
    } catch {
      // Keep going from memory, or the stale stored copy would win on read.
      storageWorks = false;
    }
    listeners.forEach((listener) => listener());
  }

  function update(change: (current: T) => T) {
    set(change(get()));
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
    return useSyncExternalStore(subscribe, get, () => empty);
  }

  return { get, set, update, useValue };
}

/** A value shared between components for this page session only (not saved). */
export function createMemoryValue<T>(initial: T) {
  const listeners = new Set<() => void>();
  let value = initial;

  function get() {
    return value;
  }

  function set(next: T) {
    value = next;
    listeners.forEach((listener) => listener());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function useValue() {
    return useSyncExternalStore(subscribe, get, () => initial);
  }

  return { get, set, useValue };
}

const noSubscription = () => () => {};

/**
 * False during the server render and hydration, true after. Stored data only
 * exists in the browser, so pages use this to avoid flashing an "empty" state
 * before the real data is read.
 */
export function useHydrated() {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}
