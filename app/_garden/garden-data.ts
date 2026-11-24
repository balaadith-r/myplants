import type { GardenTile } from "./geometry";

export type PlantArt = {
  alt: string;
  src: string;
  /** Size in world pixels. One tile is 130 wide. */
  width: number;
  height: number;
  /**
   * The point of the art that stands on the tile centre, as a fraction of its
   * width and height (0.5, 1 is the bottom middle).
   */
  anchor: { x: number; y: number };
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
 * TEMPORARY: stand-in doodles for testing placement. Planting mode uses the
 * player's drawn plants when there are any, and these otherwise.
 */
export const placeholderPlants: PlantArt[] = [
  { alt: "Placeholder tulip", src: "/placeholders/doodle-tulip.svg", width: 80, height: 130, anchor: { x: 0.5, y: 0.923 } },
  { alt: "Placeholder grass", src: "/placeholders/doodle-grass.svg", width: 90, height: 120, anchor: { x: 0.5, y: 0.917 } },
  { alt: "Placeholder daisy", src: "/placeholders/doodle-daisy.svg", width: 80, height: 140, anchor: { x: 0.5, y: 0.929 } },
];
