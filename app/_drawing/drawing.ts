/**
 * The plant drawing model. Coordinates are in "box units": the blue box from
 * the Figma design, with (0, 0) at its top-left corner. Strokes are stored as
 * points and turned into SVG, so plants stay sharp at any garden zoom.
 */

// Size of the blue drawing box in the Figma design (Plant New page).
export const BOX = { width: 243.78, height: 221.567 };
// The blue dot inside the box: where the centre of the tile sits. This is the
// point that lands on the centre of a garden tile.
export const ANCHOR = { x: 121.89, y: 192.503 };

/**
 * Box units to garden world pixels: how big a drawing appears in the garden.
 *
 * Taken from the "hitbox" frame placed on the garden grid on the Figma home
 * page: 105.064 x 97.890 on a grid whose tiles are 130.58 x 75.21, which is
 * 104.6 x 97.6 in garden pixels (tiles here are 130 x 75). That box is a
 * little taller for its width than the drawing box, so one scale cannot match
 * both sides exactly (0.4291 by width, 0.4406 by height); this is the average,
 * within 1.5% of each. Change this one number to resize every drawn plant.
 */
export const DRAWING_TO_WORLD = 0.4348;

export const INK = "#3e3e3e";
export const PEN_WIDTH = 3.5;
export const ERASER_WIDTH = 16;
// Points closer than this to the previous one are skipped: keeps saved
// drawings small without visibly changing the line.
const MIN_POINT_GAP = 1;

export type Tool = "pen" | "eraser";
/** `points` is flat: [x0, y0, x1, y1, ...], rounded to 0.1 box units. */
export type Stroke = { tool: Tool; points: number[] };

export function isInsideBox(x: number, y: number) {
  return x >= 0 && y >= 0 && x <= BOX.width && y <= BOX.height;
}

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * The part of the line from (x0, y0) to (x1, y1) that lies inside the box, as
 * start and end fractions along it, or null if it misses the box entirely
 * (Liang-Barsky clipping). Lets a stroke run exactly to the box edge however
 * far apart two pointer samples are.
 */
export function clipToBox(x0: number, y0: number, x1: number, y1: number): [number, number] | null {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let start = 0;
  let end = 1;
  const edges: [number, number][] = [
    [-dx, x0],
    [dx, BOX.width - x0],
    [-dy, y0],
    [dy, BOX.height - y0],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) start = Math.max(start, t);
    else end = Math.min(end, t);
    if (start > end) return null;
  }
  return [start, end];
}

/** Appends a point unless it is too close to the last one. Mutates `points`. */
export function addPoint(points: number[], x: number, y: number) {
  const length = points.length;
  if (length >= 2 && Math.hypot(x - points[length - 2], y - points[length - 1]) < MIN_POINT_GAP) return false;
  points.push(round(x), round(y));
  return true;
}

/**
 * A smooth path through the points: straight to the first midpoint, then
 * quadratic curves through each point to the next midpoint. A single point
 * becomes a dot (a zero-length line with round caps).
 */
export function strokePath(points: number[]) {
  if (points.length < 2) return "";
  const [x0, y0] = points;
  if (points.length === 2) return `M${x0} ${y0}l0.01 0`;
  if (points.length === 4) return `M${x0} ${y0}L${points[2]} ${points[3]}`;

  let d = `M${x0} ${y0}`;
  for (let i = 2; i < points.length - 2; i += 2) {
    const midX = round((points[i] + points[i + 2]) / 2);
    const midY = round((points[i + 1] + points[i + 3]) / 2);
    d += `Q${points[i]} ${points[i + 1]} ${midX} ${midY}`;
  }
  return `${d}L${points[points.length - 2]} ${points[points.length - 1]}`;
}

/**
 * SVG markup for the strokes, without the outer <svg>. Eraser strokes become
 * masks over everything drawn before them, so later pen strokes can draw over
 * an erased area again, exactly as on paper. `idPrefix` keeps mask ids unique
 * when several drawings share a page.
 */
export function strokesMarkup(strokes: Stroke[], idPrefix: string) {
  let defs = "";
  let body = "";

  strokes.forEach((stroke, index) => {
    const d = strokePath(stroke.points);
    if (!d) return;
    if (stroke.tool === "pen") {
      body += `<path d="${d}"/>`;
      return;
    }
    if (!body) return; // Nothing to erase yet.
    const id = `${idPrefix}e${index}`;
    defs +=
      `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${BOX.width}" height="${BOX.height}">` +
      `<rect width="${BOX.width}" height="${BOX.height}" fill="#fff"/>` +
      `<path d="${d}" fill="none" stroke="#000" stroke-width="${ERASER_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>` +
      `</mask>`;
    body = `<g mask="url(#${id})">${body}</g>`;
  });

  const style = `fill="none" stroke="${INK}" stroke-width="${PEN_WIDTH}" stroke-linecap="round" stroke-linejoin="round"`;
  return `${defs ? `<defs>${defs}</defs>` : ""}<g ${style}>${body}</g>`;
}

/** A standalone SVG document of the drawing, the format saved to the inventory. */
export function drawingToSvg(strokes: Stroke[]) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BOX.width}" height="${BOX.height}" viewBox="0 0 ${BOX.width} ${BOX.height}">` +
    strokesMarkup(strokes, "p") +
    `</svg>`
  );
}

export function hasInk(strokes: Stroke[]) {
  return strokes.some((stroke) => stroke.tool === "pen");
}
