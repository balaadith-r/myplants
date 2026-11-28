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

/** One planted tile. The same plant can stand on several tiles. */
export type GardenItem = {
  /** Unique per tile, not per plant. */
  id: string;
  tile: GardenTile;
  art: PlantArt;
};
