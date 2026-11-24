import { memo } from "react";
import { diamondPoints, GRID_BOUNDS, GRID_COLUMNS, GRID_ROWS, gridToWorld, type GardenTile } from "./geometry";

// Room around the grid so strokes on the outer edge are not clipped.
const PAD = 4;

function buildInnerLines() {
  const segments: string[] = [];
  for (let column = 1; column < GRID_COLUMNS; column++) {
    const from = gridToWorld(column, 0);
    const to = gridToWorld(column, GRID_ROWS);
    segments.push(`M${from.x} ${from.y}L${to.x} ${to.y}`);
  }
  for (let row = 1; row < GRID_ROWS; row++) {
    const from = gridToWorld(0, row);
    const to = gridToWorld(GRID_COLUMNS, row);
    segments.push(`M${from.x} ${from.y}L${to.x} ${to.y}`);
  }
  return segments.join("");
}

const INNER_LINES = buildInnerLines();
const BORDER = diamondPoints(0, 0, GRID_COLUMNS, GRID_ROWS);

type GridLayerProps = {
  /** Inner tile lines. The outer border is always drawn. */
  showLines: boolean;
  highlight: GardenTile | null;
  highlightOccupied: boolean;
};

/**
 * The grid is drawn in world pixels, so the SVG's viewBox equals its own
 * position in the world: no coordinate conversion is needed anywhere.
 */
export const GridLayer = memo(function GridLayer({ showLines, highlight, highlightOccupied }: GridLayerProps) {
  const left = GRID_BOUNDS.left - PAD;
  const top = GRID_BOUNDS.top - PAD;
  const width = GRID_BOUNDS.width + PAD * 2;
  const height = GRID_BOUNDS.height + PAD * 2;

  return (
    <svg
      aria-hidden="true"
      className="garden-grid"
      height={height}
      style={{ left, top }}
      viewBox={`${left} ${top} ${width} ${height}`}
      width={width}
    >
      {highlight ? (
        <polygon
          className={highlightOccupied ? "garden-tile-highlight is-occupied" : "garden-tile-highlight"}
          points={diamondPoints(highlight.column, highlight.row, highlight.column + 1, highlight.row + 1)}
        />
      ) : null}
      {showLines ? <path className="garden-grid-lines" d={INNER_LINES} /> : null}
      <polygon className="garden-grid-border" points={BORDER} />
    </svg>
  );
});
