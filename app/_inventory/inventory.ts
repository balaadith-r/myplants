import { ANCHOR, BOX, DRAWING_TO_WORLD, FULL_BOX, type Bounds } from "../_drawing/drawing";
import type { PlantArt } from "../_garden/garden-data";
import { removeFromGarden } from "../_garden/layout";
import { createStoredJson } from "../_lib/stores";
import { isRarity, type Rarity } from "./rarity";

/**
 * Every plant the player owns. Planting one does not use it up: it stays
 * here, and can stand on any number of tiles.
 *
 * TEMPORARY: kept in this browser's localStorage until there is a backend.
 * Same shape a server would return, so swapping the storage later does not
 * change the components that use it.
 */
export type InventoryPlant = {
  id: string;
  name: string;
  /** Standalone SVG document, in drawing box units. */
  svg: string;
  /** Where the ink is inside the drawing box, so cards can frame it. */
  bounds: Bounds;
  rarity: Rarity;
  /** Who drew it: null for the player's own plants, the artist's username for bought ones. */
  artist: string | null;
  /** The artist's signature as an SVG document, once accounts have one. */
  signature?: string;
  createdAt: number;
};

function isBounds(value: unknown): value is Bounds {
  if (typeof value !== "object" || value === null) return false;
  const { x, y, width, height } = value as Bounds;
  return [x, y, width, height].every(Number.isFinite) && width > 0 && height > 0;
}

/** Reads stored plants, filling in fields that older saves did not have. */
function parsePlants(stored: unknown): InventoryPlant[] {
  if (!Array.isArray(stored)) return [];
  const plants: InventoryPlant[] = [];
  for (const entry of stored) {
    if (typeof entry !== "object" || entry === null) continue;
    const { id, name, svg, createdAt, bounds, rarity, artist, signature } = entry;
    if (typeof id !== "string" || typeof name !== "string" || typeof svg !== "string") continue;
    plants.push({
      id,
      name,
      svg,
      bounds: isBounds(bounds) ? bounds : FULL_BOX,
      rarity: isRarity(rarity) ? rarity : "common",
      artist: typeof artist === "string" ? artist : null,
      ...(typeof signature === "string" ? { signature } : {}),
      createdAt: typeof createdAt === "number" ? createdAt : 0,
    });
  }
  return plants;
}

const inventory = createStoredJson<InventoryPlant[]>("garden:inventory", [], parsePlants);

export const useInventory = inventory.useValue;

function newId() {
  // randomUUID only exists on secure origins; a phone testing over the LAN
  // (plain http) does not have it.
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export function addPlant(plant: Pick<InventoryPlant, "name" | "svg" | "bounds" | "rarity">): InventoryPlant {
  const created: InventoryPlant = { ...plant, id: newId(), artist: null, createdAt: Date.now() };
  inventory.update((current) => [...current, created]);
  return created;
}

/** Deletes a plant for good, clearing every tile it stands on. */
export function deletePlant(id: string) {
  removeFromGarden(id);
  inventory.update((current) => current.filter((plant) => plant.id !== id));
}

export function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// Stored plants keep their identity until the data changes, so one encoding
// per plant is enough, however many cards and sprites show it.
const imageUrls = new WeakMap<InventoryPlant, string>();
const arts = new WeakMap<InventoryPlant, PlantArt>();

export function plantImageUrl(plant: InventoryPlant) {
  let url = imageUrls.get(plant);
  if (!url) {
    url = svgDataUrl(plant.svg);
    imageUrls.set(plant, url);
  }
  return url;
}

/** How a drawn plant is shown in the garden. */
export function inventoryArt(plant: InventoryPlant): PlantArt {
  let art = arts.get(plant);
  if (!art) {
    art = {
      alt: plant.name,
      src: plantImageUrl(plant),
      width: BOX.width * DRAWING_TO_WORLD,
      height: BOX.height * DRAWING_TO_WORLD,
      anchor: { x: ANCHOR.x / BOX.width, y: ANCHOR.y / BOX.height },
    };
    arts.set(plant, art);
  }
  return art;
}
