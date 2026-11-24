"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  cameraTransform,
  clamp,
  clampCamera,
  distance,
  fittedCamera,
  MAX_SCALE,
  midpoint,
  minScale,
  screenToWorld,
  zoomAt,
  type Camera,
  type Size,
} from "./camera";
import { gardenItems, placeholderPlants, type GardenItem, type PlantArt } from "./garden-data";
import { sameTile, tileCenter, tileDepth, tileKey, worldToTile, type GardenTile, type Point } from "./geometry";
import { GridLayer } from "./grid-layer";
import { inventoryArt, useInventory } from "./inventory";
import { hintDismissedFlag, showGridFlag } from "./stored-flag";

// How far a pointer may move, in screen px, and still count as a tap.
const TAP_SLOP = 8;

type Pinch = { camera: Camera; distance: number; midpoint: Point };
type Tap = { pointerId: number; start: Point };

function PlantSprite({ item }: { item: GardenItem }) {
  const base = tileCenter(item.tile);
  const { anchor, height, width } = item.art;
  return (
    // Plants are plain images positioned in world pixels; the camera transform
    // scales them, so they never re-render while panning or zooming.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={item.art.alt}
      className="garden-plant"
      draggable={false}
      height={height}
      src={item.art.src}
      style={{ height, left: base.x - anchor.x * width, top: base.y - anchor.y * height, width }}
      width={width}
    />
  );
}

const PlantLayer = memo(function PlantLayer({ items }: { items: GardenItem[] }) {
  // Nearer tiles (higher column + row) are drawn later so they overlap the
  // plants behind them. Ties sit side by side, so any stable order works.
  const sorted = useMemo(
    () => [...items].sort((a, b) => tileDepth(a.tile) - tileDepth(b.tile) || a.tile.column - b.tile.column),
    [items],
  );

  return (
    <div className="garden-plants">
      {sorted.map((item) => (
        <PlantSprite item={item} key={item.id} />
      ))}
    </div>
  );
});

export function GardenCanvas({ initialItems = gardenItems }: { initialItems?: GardenItem[] }) {
  const canvasRef = useRef<HTMLElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<Size>({ width: 0, height: 0 });
  const cameraRef = useRef<Camera>({ scale: 1, x: 0, y: 0 });
  const frameRef = useRef(0);
  const hasInteractedRef = useRef(false);
  const pointersRef = useRef(new Map<number, Point>());
  const pinchRef = useRef<Pinch | null>(null);
  const tapRef = useRef<Tap | null>(null);
  const nextPlaceholderRef = useRef(0);

  const [items, setItems] = useState(initialItems);
  const [placing, setPlacing] = useState(false);
  const [hoverTile, setHoverTile] = useState<GardenTile | null>(null);
  const showGrid = showGridFlag.useValue();
  const hintDismissed = hintDismissedFlag.useValue();
  const inventory = useInventory();

  const occupied = useMemo(() => new Set(items.map((item) => tileKey(item.tile))), [items]);

  // The camera lives in a ref and is written to the DOM at most once per
  // frame. Panning and zooming never re-render React.
  const setCamera = useCallback((next: Camera) => {
    cameraRef.current = clampCamera(next, sizeRef.current);
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      if (worldRef.current) worldRef.current.style.transform = cameraTransform(cameraRef.current);
    });
  }, []);

  // The first pan or zoom stops the camera refitting on resize and retires
  // the how-to hint for good.
  const markInteracted = useCallback(() => {
    if (hasInteractedRef.current) return;
    hasInteractedRef.current = true;
    if (!hintDismissedFlag.get()) hintDismissedFlag.set(true);
  }, []);

  /** Client coordinates to screen coordinates measured from the canvas centre. */
  const canvasPoint = useCallback((clientX: number, clientY: number): Point => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return { x: clientX - (bounds.left + bounds.width / 2), y: clientY - (bounds.top + bounds.height / 2) };
  }, []);

  const tileAt = (point: Point) => worldToTile(screenToWorld(point, cameraRef.current));

  const updateHover = (tile: GardenTile | null) => {
    setHoverTile((current) => (sameTile(current, tile) ? current : tile));
  };

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const world = worldRef.current;
    if (!canvas || !world) return;

    // Fit before the first paint. The world stays hidden until this runs, so
    // a phone never flashes the server-rendered, unfitted grid. This also
    // re-runs when Next.js shows this page again after navigating back; a
    // camera the viewer moved is kept then, just re-clamped.
    const bounds = canvas.getBoundingClientRect();
    sizeRef.current = { width: bounds.width, height: bounds.height };
    cameraRef.current = hasInteractedRef.current ? clampCamera(cameraRef.current, sizeRef.current) : fittedCamera(sizeRef.current);
    world.style.transform = cameraTransform(cameraRef.current);
    world.dataset.ready = "";

    // Watches the canvas itself, so it also catches changes that are not
    // window resizes, such as the header reflowing once its font loads.
    const observer = new ResizeObserver(([entry]) => {
      sizeRef.current = { width: entry.contentRect.width, height: entry.contentRect.height };
      setCamera(hasInteractedRef.current ? cameraRef.current : fittedCamera(sizeRef.current));
    });
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };
  }, [setCamera]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      markInteracted();

      // Firefox reports mouse wheels in lines or pages rather than pixels.
      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? sizeRef.current.height : 1;
      // Trackpad pinches arrive as ctrl+wheel with small deltas, so they need
      // a stronger curve. The gentle one keeps mouse wheels from jumping.
      const sensitivity = event.ctrlKey ? 0.01 : 0.0008;
      const current = cameraRef.current;
      const scale = clamp(current.scale * Math.exp(-event.deltaY * unit * sensitivity), minScale(sizeRef.current), MAX_SCALE);
      setCamera(zoomAt(current, scale, canvasPoint(event.clientX, event.clientY)));
    }

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [canvasPoint, markInteracted, setCamera]);

  useEffect(() => {
    if (!placing) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPlacing(false);
        setHoverTile(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [placing]);

  function pan(dx: number, dy: number) {
    markInteracted();
    const current = cameraRef.current;
    setCamera({ ...current, x: current.x + dx, y: current.y + dy });
  }

  function handleTap(point: Point) {
    if (!placing) return;
    const tile = tileAt(point);
    if (!tile) return;

    const key = tileKey(tile);
    if (occupied.has(key)) {
      setItems((current) => current.filter((item) => tileKey(item.tile) !== key));
      return;
    }

    // TEMPORARY: until there is an inventory picker, cycle through the
    // player's drawn plants, or the placeholder doodles if they have none.
    const choices: PlantArt[] = inventory.length > 0 ? inventory.map(inventoryArt) : placeholderPlants;
    const art = choices[nextPlaceholderRef.current++ % choices.length];
    setItems((current) => [...current, { id: key, tile, art }]);
  }

  // Mouse, pen and touch all arrive as pointer events. `touch-action: none` on
  // the canvas stops the browser from scrolling or zooming the page instead.
  function handlePointerDown(event: React.PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const pointers = pointersRef.current;
    if (pointers.size >= 2) return; // A third finger is ignored.

    const point = canvasPoint(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, point);

    if (pointers.size === 1) {
      tapRef.current = { pointerId: event.pointerId, start: point };
      if (placing) updateHover(tileAt(point));
      return;
    }

    // A second pointer turns the pan into a pinch. A pinch is never a tap.
    const [first, second] = [...pointers.values()];
    tapRef.current = null;
    pinchRef.current = { camera: cameraRef.current, distance: distance(first, second), midpoint: midpoint(first, second) };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    const point = canvasPoint(event.clientX, event.clientY);
    const pointers = pointersRef.current;
    const previous = pointers.get(event.pointerId);

    if (!previous) {
      // A mouse moving with no button held: show which tile a click would use.
      if (placing && event.pointerType === "mouse") updateHover(tileAt(point));
      return;
    }
    pointers.set(event.pointerId, point);

    const pinch = pinchRef.current;
    if (pinch && pointers.size === 2) {
      const [first, second] = [...pointers.values()];
      const center = midpoint(first, second);
      const scale = clamp(pinch.camera.scale * (distance(first, second) / pinch.distance), minScale(sizeRef.current), MAX_SCALE);
      const zoomed = zoomAt(pinch.camera, scale, pinch.midpoint);
      markInteracted();
      setCamera({ scale, x: zoomed.x + center.x - pinch.midpoint.x, y: zoomed.y + center.y - pinch.midpoint.y });
      return;
    }

    const tap = tapRef.current;
    if (tap) {
      // Hold still until the pointer leaves the tap radius, then catch up on
      // the movement that was held back.
      if (distance(point, tap.start) < TAP_SLOP) return;
      tapRef.current = null;
      if (event.pointerType !== "mouse") setHoverTile(null);
      pan(point.x - tap.start.x, point.y - tap.start.y);
      return;
    }

    pan(point.x - previous.x, point.y - previous.y);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLElement>) {
    const pointers = pointersRef.current;
    if (!pointers.delete(event.pointerId)) return;
    pinchRef.current = null;

    const tap = tapRef.current;
    tapRef.current = null;
    if (tap?.pointerId === event.pointerId) handleTap(tap.start);
    if (event.pointerType !== "mouse") setHoverTile(null);
  }

  function handlePointerCancel(event: React.PointerEvent<HTMLElement>) {
    pointersRef.current.delete(event.pointerId);
    pinchRef.current = null;
    tapRef.current = null;
    setHoverTile(null);
  }

  function handlePointerLeave(event: React.PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse" && !pointersRef.current.has(event.pointerId)) setHoverTile(null);
  }

  function togglePlacing() {
    setPlacing((current) => !current);
    setHoverTile(null);
  }

  function resetCamera() {
    hasInteractedRef.current = false;
    setCamera(fittedCamera(sizeRef.current));
  }

  return (
    <section
      aria-label="Garden canvas"
      className={placing ? "garden-canvas is-placing" : "garden-canvas"}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      ref={canvasRef}
    >
      <div className="garden-world" ref={worldRef}>
        {/* Grid lines are always shown while planting, whatever the viewer's setting. */}
        <GridLayer
          highlight={placing ? hoverTile : null}
          highlightOccupied={hoverTile !== null && occupied.has(tileKey(hoverTile))}
          showLines={showGrid || placing}
        />
        <PlantLayer items={items} />
      </div>
      <div aria-label="Garden view controls" className="garden-controls" onPointerDown={(event) => event.stopPropagation()} role="group">
        <button
          aria-pressed={showGrid}
          className="garden-control"
          disabled={placing}
          onClick={() => showGridFlag.set(!showGrid)}
          title={placing ? "The grid is always shown while planting" : undefined}
          type="button"
        >
          Grid
        </button>
        <button aria-pressed={placing} className="garden-control" onClick={togglePlacing} type="button">
          {placing ? "Done" : "Plant"}
        </button>
        <button className="garden-control" onClick={resetCamera} type="button">
          Reset
        </button>
      </div>
      {placing ? (
        <p className="garden-hint">Tap a tile to plant · Tap again to remove</p>
      ) : (
        // Shown until the viewer first pans or zooms. Both wordings are
        // rendered; CSS picks the one for a touch screen or a mouse.
        <p aria-hidden={hintDismissed} className={hintDismissed ? "garden-hint is-dismissed" : "garden-hint"}>
          <span className="hint-touch">Drag to move · Pinch to zoom</span>
          <span className="hint-mouse">Drag to move · Scroll to zoom</span>
        </p>
      )}
    </section>
  );
}
