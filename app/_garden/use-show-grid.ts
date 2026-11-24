import { useCallback, useSyncExternalStore } from "react";

// The grid-lines toggle is a per-viewer preference kept in this browser only.
// It never changes what other people see when they visit a garden.
const STORAGE_KEY = "garden:show-grid";
const listeners = new Set<() => void>();
// Fallback for when storage is unavailable (private mode, blocked site data):
// the toggle still works, it just does not survive a reload.
let fallback = true;

function read() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored !== "off";
  } catch {
    // Fall through to the in-memory value.
  }
  return fallback;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useShowGrid() {
  const showGrid = useSyncExternalStore(subscribe, read, () => true);

  const setShowGrid = useCallback((value: boolean) => {
    fallback = value;
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? "on" : "off");
    } catch {
      // Keep the in-memory value only.
    }
    listeners.forEach((listener) => listener());
  }, []);

  return [showGrid, setShowGrid] as const;
}
