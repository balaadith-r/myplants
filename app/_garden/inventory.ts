import { useSyncExternalStore } from "react";
import { ANCHOR, BOX, DRAWING_TO_WORLD } from "../_drawing/drawing";
import type { PlantArt } from "./garden-data";

/**
 * TEMPORARY: the player's drawn plants, kept in this browser's localStorage
 * until there is a backend. Same shape a server would return, so swapping the
 * storage later does not change the components that use it.
 */
export type InventoryPlant = {
  id: string;
  name: string;
  /** Standalone SVG document, in drawing box units. */
  svg: string;
  createdAt: number;
};

const STORAGE_KEY = "garden:inventory";
const EMPTY: InventoryPlant[] = [];
const listeners = new Set<() => void>();
let fallback: InventoryPlant[] = EMPTY;
// useSyncExternalStore needs the same array back while nothing has changed.
let cache: { raw: string | null; plants: InventoryPlant[] } = { raw: null, plants: EMPTY };

function read(): InventoryPlant[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return fallback;
  }
  if (raw === null) return fallback;
  if (raw !== cache.raw) {
    try {
      cache = { raw, plants: JSON.parse(raw) as InventoryPlant[] };
    } catch {
      cache = { raw, plants: EMPTY };
    }
  }
  return cache.plants;
}

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function newId() {
  // randomUUID only exists on secure origins; a phone testing over the LAN
  // (plain http) does not have it.
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export function addToInventory(name: string, svg: string): InventoryPlant {
  const plant = { id: newId(), name, svg, createdAt: Date.now() };
  const next = [...read(), plant];
  fallback = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or unavailable: the plant lives for this session only.
  }
  listeners.forEach((listener) => listener());
  return plant;
}

export function useInventory() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** How a drawn plant is shown in the garden. */
export function inventoryArt(plant: InventoryPlant): PlantArt {
  return {
    alt: plant.name,
    src: svgDataUrl(plant.svg),
    width: BOX.width * DRAWING_TO_WORLD,
    height: BOX.height * DRAWING_TO_WORLD,
    anchor: { x: ANCHOR.x / BOX.width, y: ANCHOR.y / BOX.height },
  };
}
