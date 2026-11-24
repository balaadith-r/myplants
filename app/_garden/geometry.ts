/**
 * Garden geometry, in world pixels.
 *
 * Grid space uses (u, v) = (column, row), where whole numbers fall on tile
 * edges. (0, 0) is the top vertex of the whole grid: increasing column moves
 * down-right, increasing row moves down-left. A tile (column, row) is the
 * diamond between u = column..column + 1 and v = row..row + 1.
 *
 * Gardens are stored in tile coordinates, so they do not depend on screen size
 * or the current pan/zoom.
 */

export const GRID_COLUMNS = 5;
export const GRID_ROWS = 5;

// Half of one tile diamond's width and height. A 2:√3 ratio is true isometric.
export const TILE_HALF_WIDTH = 65;
export const TILE_HALF_HEIGHT = 37.5;

export type Point = { x: number; y: number };
export type GardenTile = { column: number; row: number };

export function gridToWorld(u: number, v: number): Point {
  return { x: (u - v) * TILE_HALF_WIDTH, y: (u + v) * TILE_HALF_HEIGHT };
}

export function tileCenter({ column, row }: GardenTile): Point {
  return gridToWorld(column + 0.5, row + 0.5);
}

/** The tile under a world point, or null when the point is off the grid. */
export function worldToTile({ x, y }: Point): GardenTile | null {
  const u = y / (2 * TILE_HALF_HEIGHT) + x / (2 * TILE_HALF_WIDTH);
  const v = y / (2 * TILE_HALF_HEIGHT) - x / (2 * TILE_HALF_WIDTH);
  const column = Math.floor(u);
  const row = Math.floor(v);

  if (column < 0 || row < 0 || column >= GRID_COLUMNS || row >= GRID_ROWS) return null;
  return { column, row };
}

/** Higher depth is nearer the viewer, so it must be drawn later. */
export function tileDepth({ column, row }: GardenTile) {
  return column + row;
}

export function tileKey({ column, row }: GardenTile) {
  return `${column}:${row}`;
}

export function sameTile(a: GardenTile | null, b: GardenTile | null) {
  return a === b || (a !== null && b !== null && a.column === b.column && a.row === b.row);
}

/** SVG `points` for a diamond spanning grid space u0..u1, v0..v1. */
export function diamondPoints(u0: number, v0: number, u1: number, v1: number) {
  return [gridToWorld(u0, v0), gridToWorld(u1, v0), gridToWorld(u1, v1), gridToWorld(u0, v1)]
    .map(({ x, y }) => `${x},${y}`)
    .join(" ");
}

export const GRID_BOUNDS = {
  left: -GRID_ROWS * TILE_HALF_WIDTH,
  top: 0,
  width: (GRID_COLUMNS + GRID_ROWS) * TILE_HALF_WIDTH,
  height: (GRID_COLUMNS + GRID_ROWS) * TILE_HALF_HEIGHT,
};

export const GRID_CENTER: Point = {
  x: GRID_BOUNDS.left + GRID_BOUNDS.width / 2,
  y: GRID_BOUNDS.top + GRID_BOUNDS.height / 2,
};
