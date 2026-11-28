import { createMemoryValue, createStoredJson } from "../_lib/stores";
import { GRID_COLUMNS, GRID_ROWS, sameTile, type GardenTile } from "./geometry";

/**
 * Which inventory plant stands on which tile. Planting never takes a plant out
 * of the inventory, and the same plant can stand on any number of tiles.
 *
 * TEMPORARY: kept in localStorage until there is a backend.
 */
export type Placement = { plantId: string; tile: GardenTile };

function isTile(value: unknown): value is GardenTile {
  if (typeof value !== "object" || value === null) return false;
  const { column, row } = value as GardenTile;
  return Number.isInteger(column) && Number.isInteger(row) && column >= 0 && row >= 0 && column < GRID_COLUMNS && row < GRID_ROWS;
}

function parsePlacements(stored: unknown): Placement[] {
  if (!Array.isArray(stored)) return [];
  return stored.filter(
    (entry): entry is Placement => typeof entry === "object" && entry !== null && typeof entry.plantId === "string" && isTile(entry.tile),
  );
}

const layout = createStoredJson<Placement[]>("garden:layout", [], parsePlacements);

export const usePlacements = layout.useValue;

export function placementAt(placements: Placement[], tile: GardenTile) {
  return placements.find((placement) => sameTile(placement.tile, tile)) ?? null;
}

/** Puts a plant on a tile, in place of whatever stood there. */
export function plantOnTile(plantId: string, tile: GardenTile) {
  layout.update((current) => [...current.filter((placement) => !sameTile(placement.tile, tile)), { plantId, tile }]);
}

/** Clears this tile. The plant itself stays in the inventory. */
export function stashTile(tile: GardenTile) {
  layout.update((current) => current.filter((placement) => !sameTile(placement.tile, tile)));
}

/** Takes a plant off every tile it stands on. */
export function removeFromGarden(plantId: string) {
  layout.update((current) => current.filter((placement) => placement.plantId !== plantId));
}

/**
 * The plant chosen with "Use" on the inventory page, waiting for the player to
 * tap a tile in the garden. Not saved, and dropped if they leave the garden
 * without planting it.
 */
export const pendingPlant = createMemoryValue<string | null>(null);
