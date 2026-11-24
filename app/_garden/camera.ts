import { GRID_BOUNDS, GRID_CENTER, type Point } from "./geometry";

/**
 * Camera maths. Screen points are measured from the centre of the canvas.
 * A world point w appears on screen at (w - GRID_CENTER) * scale + (x, y), so
 * (x, y) is where the grid's centre sits on screen.
 */
export type Camera = { scale: number; x: number; y: number };
export type Size = { width: number; height: number };

const MIN_SCALE = 0.25;
export const MAX_SCALE = 3;
// How far the camera may zoom out past the fitted (default) view. 1 would stop
// at the default; 2 allows zooming out twice as far.
const MAX_ZOOM_OUT = 2;
// Nudges the grid down from the vertical centre of the canvas, in screen px.
// Increase to move the garden lower; set to 0 to centre it again.
const GRID_OFFSET_Y = 24;

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function fittedScale(size: Size) {
  // The whole grid centred with a little breathing room around it.
  const fit = Math.min(1, (size.width - 64) / GRID_BOUNDS.width, (size.height - 96) / GRID_BOUNDS.height);
  return clamp(fit, MIN_SCALE, MAX_SCALE);
}

export function minScale(size: Size) {
  return Math.max(MIN_SCALE, fittedScale(size) / MAX_ZOOM_OUT);
}

export function fittedCamera(size: Size): Camera {
  return { scale: fittedScale(size), x: 0, y: GRID_OFFSET_Y };
}

// The pannable box is the fitted view scaled by MAX_ZOOM_OUT, with the grid
// centred in it. Zooming in shrinks the camera box, which may then move
// around, but it can never leave the pannable box. At max zoom-out the camera
// fills the box, so there is no panning left to do there.
export function clampCamera(camera: Camera, size: Size): Camera {
  const lowest = minScale(size);
  const scale = clamp(camera.scale, lowest, MAX_SCALE);
  const limitX = Math.max(0, (size.width * (scale / lowest - 1)) / 2);
  const limitY = Math.max(0, (size.height * (scale / lowest - 1)) / 2);

  return {
    scale,
    x: clamp(camera.x, -limitX, limitX),
    y: clamp(camera.y, GRID_OFFSET_Y - limitY, GRID_OFFSET_Y + limitY),
  };
}

/** Zoom to `scale` while keeping the world point under `anchor` still. */
export function zoomAt(camera: Camera, scale: number, anchor: Point): Camera {
  const ratio = scale / camera.scale;
  return {
    scale,
    x: anchor.x - ratio * (anchor.x - camera.x),
    y: anchor.y - ratio * (anchor.y - camera.y),
  };
}

export function screenToWorld(point: Point, camera: Camera): Point {
  return {
    x: (point.x - camera.x) / camera.scale + GRID_CENTER.x,
    y: (point.y - camera.y) / camera.scale + GRID_CENTER.y,
  };
}

export function cameraTransform({ scale, x, y }: Camera) {
  return `translate(${x}px, ${y}px) scale(${scale}) translate(${-GRID_CENTER.x}px, ${-GRID_CENTER.y}px)`;
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
