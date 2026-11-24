import type { GardenTile } from "./geometry";

export type PlantArt = {
  alt: string;
  src: string;
  /** Size in world pixels. One tile is 130 wide. */
  width: number;
  height: number;
};

export type GardenItem = {
  id: string;
  tile: GardenTile;
  art: PlantArt;
};

/**
 * Add persisted plants here for now. Eventually this is supplied by the garden
 * API, still in tile coordinates. Draw order is worked out from the tile, so
 * there is no z-index to maintain.
 */
export const gardenItems: GardenItem[] = [];

/**
 * TEMPORARY: stand-in doodles so placement can be tested before plants can be
 * drawn. Placement mode cycles through these. Replace with the player's
 * inventory once it exists.
 */
export const placeholderPlants: PlantArt[] = [
  { alt: "Placeholder tulip", src: "/placeholders/doodle-tulip.svg", width: 80, height: 130 },
  { alt: "Placeholder grass", src: "/placeholders/doodle-grass.svg", width: 90, height: 120 },
  { alt: "Placeholder daisy", src: "/placeholders/doodle-daisy.svg", width: 80, height: 140 },
];
