/**
 * Grid coordinates are stable world coordinates, not viewport pixels.
 *
 * (0, 0) is the upper-most diamond in the supplied SVG. Increasing column
 * moves down-right; increasing row moves down-left. This makes stored gardens
 * independent of a person's screen size and their current pan/zoom level.
 */
export type GardenTile = {
  column: number;
  row: number;
};

export type GardenItem = {
  id: string;
  tile: GardenTile;
  asset: {
    alt: string;
    height: number;
    src: string;
    width: number;
  };
  /** Fine-tuning for artwork whose visual base is not centered. */
  offset?: { x: number; y: number };
  zIndex?: number;
};

export const GRID_COLUMNS = 5;
export const GRID_ROWS = 5;

/**
 * Add persisted plants and decorations here for now. Eventually this can be
 * supplied by the garden API without changing the canvas coordinate system.
 */
export const gardenItems: GardenItem[] = [];
