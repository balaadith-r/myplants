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
import { inventoryArt, useInventory, type InventoryPlant } from "../_inventory/inventory";
import { InventoryView } from "../_inventory/inventory-view";
import { useResetOnLeave } from "../_lib/reset-on-leave";
import type { GardenItem } from "./garden-data";
import { sameTile, tileCenter, tileDepth, tileKey, worldToTile, type GardenTile, type Point } from "./geometry";
import { GridLayer } from "./grid-layer";
import { pendingPlant, plantOnTile, stashTile, usePlacements } from "./layout";
import { hintDismissedFlag } from "./stored-flag";

// How far a pointer may move, in screen px, and still count as a tap.
const TAP_SLOP = 8;

type Pinch = { camera: Camera; distance: number; midpoint: Point };
type Tap = { pointerId: number; start: Point };

function applyCamera(world: HTMLElement, camera: Camera) {
  world.style.transform = cameraTransform(camera);
  // Lets UI placed in the world, such as things shown under a selected plant,
  // divide by the zoom to keep its size on screen.
  world.style.setProperty("--zoom", String(camera.scale));
}

/** Keeps the garden's pan, pinch and taps away from UI laid over it. */
function stopPropagation(event: React.SyntheticEvent) {
  event.stopPropagation();
}

/** Where a plant's art sits in the world: its anchor on the tile centre. */
function spriteOrigin(item: GardenItem): Point {
  const base = tileCenter(item.tile);
  return { x: base.x - item.art.anchor.x * item.art.width, y: base.y - item.art.anchor.y * item.art.height };
}

/** Nearer tiles (higher column + row) are drawn later, over the plants behind. */
function drawOrder(a: GardenItem, b: GardenItem) {
  return tileDepth(a.tile) - tileDepth(b.tile) || a.tile.column - b.tile.column;
}

function PlantSprite({ item, dimmed }: { item: GardenItem; dimmed: boolean }) {
  const origin = spriteOrigin(item);
  const { height, width } = item.art;
  return (
    // Plants are plain images positioned in world pixels; the camera transform
    // scales them, so they never re-render while panning or zooming.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={item.art.alt}
      className={dimmed ? "garden-plant is-dimmed" : "garden-plant"}
      draggable={false}
      height={height}
      src={item.art.src}
      style={{ height, left: origin.x, top: origin.y, width }}
      width={width}
    />
  );
}

/**
 * `focusId` is the selected plant while editing; every other plant fades back.
 * While a plant from "Use" waits for a tile, they all do.
 */
const PlantLayer = memo(function PlantLayer({ items, focusId, placing }: { items: GardenItem[]; focusId: string | null; placing: boolean }) {
  const sorted = useMemo(() => [...items].sort(drawOrder), [items]);

  return (
    <div className="garden-plants">
      {sorted.map((item) => (
        <PlantSprite dimmed={placing || (focusId !== null && item.id !== focusId)} item={item} key={item.id} />
      ))}
    </div>
  );
});

export function GardenCanvas() {
  const canvasRef = useRef<HTMLElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<Size>({ width: 0, height: 0 });
  const cameraRef = useRef<Camera>({ scale: 1, x: 0, y: 0 });
  const frameRef = useRef(0);
  const hasInteractedRef = useRef(false);
  const pointersRef = useRef(new Map<number, Point>());
  const pinchRef = useRef<Pinch | null>(null);
  const tapRef = useRef<Tap | null>(null);

  const [editing, setEditing] = useState(false);
  const [hoverTile, setHoverTile] = useState<GardenTile | null>(null);
  /** The tile tapped in edit mode, empty or planted. It stays highlighted. */
  const [selectedTile, setSelectedTile] = useState<GardenTile | null>(null);
  /** The tile a plant is being chosen for, while the inventory is open. */
  const [pickerTile, setPickerTile] = useState<GardenTile | null>(null);
  const hintDismissed = hintDismissedFlag.useValue();
  const plants = useInventory();
  const placements = usePlacements();
  const pendingId = pendingPlant.useValue();

  const items = useMemo(() => {
    const byId = new Map(plants.map((plant) => [plant.id, plant]));
    return placements.flatMap(({ plantId, tile }): GardenItem[] => {
      const plant = byId.get(plantId);
      return plant ? [{ id: tileKey(tile), tile, art: inventoryArt(plant) }] : [];
    });
  }, [plants, placements]);

  // A plant chosen with "Use" on the Inventory page waits here for a tile.
  // That also opens edit mode, and the next tile tapped gets it.
  const placingPlant = pendingId ? (plants.find((plant) => plant.id === pendingId) ?? null) : null;
  const isEditing = editing || placingPlant !== null;
  const activeTile = isEditing && !placingPlant ? selectedTile : null;
  const selectedItem = activeTile ? (items.find((item) => sameTile(item.tile, activeTile)) ?? null) : null;

  // The camera lives in a ref and is written to the DOM at most once per
  // frame. Panning and zooming never re-render React.
  const setCamera = useCallback((next: Camera) => {
    cameraRef.current = clampCamera(next, sizeRef.current);
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      if (worldRef.current) applyCamera(worldRef.current, cameraRef.current);
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

  /**
   * The tile under a screen point. Taps and hovers only ever go by tile, never
   * by a plant's drawing, which rises over the tiles behind it and would make
   * them hard to reach.
   */
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
    // re-runs when Next.js shows this page again. Leaving usually resets the
    // camera, so it refits; after a trip to the Inventory page mid-edit, the
    // camera the viewer moved is kept, just re-clamped.
    const bounds = canvas.getBoundingClientRect();
    sizeRef.current = { width: bounds.width, height: bounds.height };
    cameraRef.current = hasInteractedRef.current ? clampCamera(cameraRef.current, sizeRef.current) : fittedCamera(sizeRef.current);
    applyCamera(world, cameraRef.current);
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
      // The inventory picker sits over the garden; leave its wheel events alone.
      if (event.target instanceof Element && event.target.closest("[data-no-camera]")) return;
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

  // Leaving the page ends whatever was going on: coming back home starts out
  // of edit mode with the whole garden in view. The one exception is a trip
  // to the Inventory page mid-edit, say to pick a plant with Use: coming
  // straight back from there finds everything as it was.
  useResetOnLeave(
    () => {
      setEditing(false);
      setSelectedTile(null);
      setPickerTile(null);
      setHoverTile(null);
      pendingPlant.set(null);
      // The camera refits when the page is shown again.
      hasInteractedRef.current = false;
    },
    () => (isEditing ? "/inventory" : null),
  );

  // Escape backs out one step: the selection, then the waiting plant, then
  // edit mode. The inventory picker handles its own Escape.
  useEffect(() => {
    if (!isEditing || pickerTile) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (activeTile) setSelectedTile(null);
      else if (placingPlant) pendingPlant.set(null);
      else setEditing(false);
      setHoverTile(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditing, pickerTile, activeTile, placingPlant]);

  function pan(dx: number, dy: number) {
    markInteracted();
    const current = cameraRef.current;
    setCamera({ ...current, x: current.x + dx, y: current.y + dy });
  }

  // With a plant waiting from "Use", a tap plants it right there, in place of
  // anything already on the tile. Otherwise a tap only selects the tile, and
  // it stays highlighted so the player can see exactly which tile the buttons
  // will act on. Tapping it again, or off the grid, lets go.
  function handleTap(point: Point) {
    if (!isEditing) return;
    const tile = tileAt(point);
    if (placingPlant) {
      if (!tile) return;
      plantOnTile(placingPlant.id, tile);
      pendingPlant.set(null);
      // Edit mode stays open afterwards, as if the player had pressed Edit,
      // with nothing selected.
      setEditing(true);
      setSelectedTile(null);
      setHoverTile(null);
      return;
    }
    setSelectedTile(tile && !sameTile(tile, activeTile) ? tile : null);
  }

  function pickPlant(plant: InventoryPlant) {
    if (!pickerTile) return;
    // Replacing works the same way: the new plant takes the tile.
    plantOnTile(plant.id, pickerTile);
    setPickerTile(null);
    setSelectedTile(null);
  }

  function stashSelected() {
    if (!selectedItem) return;
    stashTile(selectedItem.tile);
    setSelectedTile(null);
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
      if (isEditing) updateHover(tileAt(point));
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
      if (isEditing && event.pointerType === "mouse") updateHover(tileAt(point));
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

  function toggleEditing() {
    if (isEditing) {
      setEditing(false);
      pendingPlant.set(null);
      setSelectedTile(null);
    } else {
      setEditing(true);
    }
    setHoverTile(null);
  }

  function resetCamera() {
    hasInteractedRef.current = false;
    setCamera(fittedCamera(sizeRef.current));
  }

  return (
    <section
      aria-label="Garden canvas"
      className={isEditing ? "garden-canvas is-editing" : "garden-canvas"}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      ref={canvasRef}
    >
      <div className="garden-world" ref={worldRef}>
        {/* The tile lines are an editing aid: shown in edit mode, never outside
            it. A selected tile keeps its highlight; a mouse hover only shows
            while nothing is selected. */}
        <GridLayer highlight={isEditing ? (activeTile ?? hoverTile) : null} showLines={isEditing} />
        <PlantLayer focusId={selectedItem?.id ?? null} items={items} placing={placingPlant !== null} />
      </div>
      {/* The space under a selected plant is kept free for things shown with it
          later, so its options sit with the other controls. */}
      <div aria-label="Garden controls" className="garden-controls" onPointerDown={stopPropagation} role="group">
        {activeTile ? (
          <div aria-label={selectedItem ? `Options for “${selectedItem.art.alt}”` : "Options for this tile"} className="garden-controls-row" role="group">
            {selectedItem ? (
              <>
                <button className="garden-control" onClick={stashSelected} type="button">
                  Stash
                </button>
                <button className="garden-control" onClick={() => setPickerTile(selectedItem.tile)} type="button">
                  Replace
                </button>
              </>
            ) : (
              <button className="garden-control" onClick={() => setPickerTile(activeTile)} type="button">
                Add plant
              </button>
            )}
          </div>
        ) : null}
        <div className="garden-controls-row">
          <button aria-pressed={isEditing} className="garden-control" onClick={toggleEditing} type="button">
            {isEditing ? "Done" : "Edit"}
          </button>
          <button className="garden-control" onClick={resetCamera} type="button">
            Reset
          </button>
        </div>
      </div>
      {isEditing ? (
        activeTile ? null : (
          <p className="garden-hint">{placingPlant ? `Tap a tile to plant “${placingPlant.name}”` : "Tap a tile to add or change its plant"}</p>
        )
      ) : (
        // Shown until the viewer first pans or zooms. Both wordings are
        // rendered; CSS picks the one for a touch screen or a mouse.
        <p aria-hidden={hintDismissed} className={hintDismissed ? "garden-hint is-dismissed" : "garden-hint"}>
          <span className="hint-touch">Drag to move · Pinch to zoom</span>
          <span className="hint-mouse">Drag to move · Scroll to zoom</span>
        </p>
      )}
      {pickerTile ? (
        <div className="garden-picker" data-no-camera onPointerDown={stopPropagation} onPointerMove={stopPropagation} onPointerUp={stopPropagation}>
          <InventoryView mode="pick" onCancel={() => setPickerTile(null)} onPick={pickPlant} />
        </div>
      ) : null}
    </section>
  );
}
