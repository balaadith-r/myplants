"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { gardenItems, type GardenItem, type GardenTile } from "./garden-data";

const GRID_WIDTH = 654.921;
const GRID_HEIGHT = 377.226;
const MIN_SCALE = 0.25;
const MAX_SCALE = 3;
// How far the camera may zoom out past the fitted (default) view. 1 would stop
// at the default; 2 allows zooming out twice as far.
const MAX_ZOOM_OUT = 2;
// Nudges the grid down from the vertical centre of the canvas, in screen px.
// Increase to move the garden lower; set to 0 to centre it again.
const GRID_OFFSET_Y = 24;

// These dimensions and the tile centres come from isometric-surface-grid.svg.
// Keeping them in world pixels is intentional: CSS performs the camera
// transform, while garden data stays in stable grid coordinates.
const TILE_CENTER = { x: 327.1, y: 38 };
const TILE_X_STEP = 65.05;
const TILE_Y_STEP = 37.5;

type Camera = { scale: number; x: number; y: number };
type PointerPosition = { x: number; y: number };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function getTilePosition({ column, row }: GardenTile) {
  return {
    x: TILE_CENTER.x + (column - row) * TILE_X_STEP,
    y: TILE_CENTER.y + (column + row) * TILE_Y_STEP,
  };
}

function getZoomedCamera(camera: Camera, nextScale: number, point: { x: number; y: number }) {
  const ratio = nextScale / camera.scale;

  return {
    scale: nextScale,
    x: point.x - ratio * (point.x - camera.x),
    y: point.y - ratio * (point.y - camera.y),
  };
}

function getFittedScale(bounds: { height: number; width: number }) {
  // The fitted view is the default zoom level: the whole grid centred with a
  // little breathing room rather than touching the edges.
  return clamp(Math.min(1, (bounds.width - 64) / GRID_WIDTH, (bounds.height - 96) / GRID_HEIGHT), MIN_SCALE, MAX_SCALE);
}

function getMinScale(bounds: { height: number; width: number }) {
  return Math.max(MIN_SCALE, getFittedScale(bounds) / MAX_ZOOM_OUT);
}

function getFittedCamera(canvas: HTMLElement): Camera {
  return { scale: getFittedScale(canvas.getBoundingClientRect()), x: 0, y: 0 };
}

// The pannable box is the fitted view scaled by MAX_ZOOM_OUT: the grid centred
// inside it. Zooming in shrinks the camera box, which may then move around, but
// it can never leave the pannable box. At max zoom-out the camera fills the
// box, so there is no panning left to do there.
function getClampedCamera(camera: Camera, canvas: HTMLElement): Camera {
  const bounds = canvas.getBoundingClientRect();
  const minScale = getMinScale(bounds);
  const scale = clamp(camera.scale, minScale, MAX_SCALE);
  const limitX = Math.max(0, (bounds.width * (scale / minScale - 1)) / 2);
  const limitY = Math.max(0, (bounds.height * (scale / minScale - 1)) / 2);

  return {
    scale,
    x: clamp(camera.x, -limitX, limitX),
    y: clamp(camera.y, -limitY, limitY),
  };
}

function getMidpoint(first: PointerPosition, second: PointerPosition): PointerPosition {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function getDistance(first: PointerPosition, second: PointerPosition) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function GardenItemLayer({ item, scale }: { item: GardenItem; scale: number }) {
  const position = getTilePosition(item.tile);
  const offset = item.offset ?? { x: 0, y: 0 };

  return (
    <div
      aria-label={item.asset.alt}
      className="garden-item"
      role="img"
      style={{
        height: item.asset.height * scale,
        left: (position.x + offset.x) * scale,
        top: (position.y + offset.y) * scale,
        width: item.asset.width * scale,
        zIndex: item.zIndex ?? 1,
      }}
    >
      <Image alt="" fill sizes={`${item.asset.width}px`} src={item.asset.src} />
    </div>
  );
}

export function GardenCanvas({ items = gardenItems }: { items?: GardenItem[] }) {
  const canvasRef = useRef<HTMLElement>(null);
  const cameraRef = useRef<Camera>({ scale: 1, x: 0, y: 0 });
  const pointersRef = useRef(new Map<number, PointerPosition>());
  const dragRef = useRef<{ pointerId: number; position: PointerPosition } | null>(null);
  const pinchRef = useRef<{ camera: Camera; distance: number; midpoint: PointerPosition } | null>(null);
  const hasInteractedRef = useRef(false);
  const [camera, setCamera] = useState<Camera>({ scale: 1, x: 0, y: 0 });

  const getCanvasPoint = useCallback((clientX: number, clientY: number): PointerPosition => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };

    return {
      x: clientX - (bounds.left + bounds.width / 2),
      y: clientY - (bounds.top + bounds.height / 2),
    };
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const syncCamera = () => {
      if (!hasInteractedRef.current) {
        const next = getFittedCamera(canvas);
        cameraRef.current = next;
        setCamera(next);
        return;
      }

      // A rotated phone or resized window can leave the old offset outside the
      // new boundary, so clamp instead of letting the garden drift away.
      const next = getClampedCamera(cameraRef.current, canvas);
      cameraRef.current = next;
      setCamera(next);
    };

    syncCamera();
    // The canvas tracks viewport changes, including device rotation. A window
    // listener is more broadly supported than ResizeObserver in mobile webviews.
    window.addEventListener("resize", syncCamera);
    return () => window.removeEventListener("resize", syncCamera);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasElement: HTMLElement = canvas;

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      hasInteractedRef.current = true;

      const bounds = canvasElement.getBoundingClientRect();
      const zoomPoint = {
        x: event.clientX - (bounds.left + bounds.width / 2),
        y: event.clientY - (bounds.top + bounds.height / 2),
      };
      // Trackpads often emit many tiny deltas; this curve stays smooth there
      // while making a physical mouse wheel less jumpy.
      const multiplier = Math.exp(-event.deltaY * 0.0008);

      setCamera((current) => {
        const nextScale = clamp(current.scale * multiplier, getMinScale(bounds), MAX_SCALE);
        const next = getClampedCamera(getZoomedCamera(current, nextScale, zoomPoint), canvasElement);
        cameraRef.current = next;
        return next;
      });
    }

    canvasElement.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvasElement.removeEventListener("wheel", handleWheel);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasElement: HTMLElement = canvas;

    function beginTouch(touches: TouchList) {
      if (touches.length === 1) {
        const touch = touches[0];
        dragRef.current = { pointerId: touch.identifier, position: getCanvasPoint(touch.clientX, touch.clientY) };
        pinchRef.current = null;
      }

      if (touches.length === 2) {
        const first = getCanvasPoint(touches[0].clientX, touches[0].clientY);
        const second = getCanvasPoint(touches[1].clientX, touches[1].clientY);
        dragRef.current = null;
        pinchRef.current = { camera: cameraRef.current, distance: getDistance(first, second), midpoint: getMidpoint(first, second) };
      }
    }

    function isControlTouch(event: TouchEvent) {
      return event.target instanceof Element && event.target.closest(".garden-controls") !== null;
    }

    function handleTouchStart(event: TouchEvent) {
      // Let taps on the controls reach the browser as normal clicks. Calling
      // preventDefault() here would suppress the click on mobile.
      if (isControlTouch(event)) return;
      event.preventDefault();
      beginTouch(event.touches);
    }

    function handleTouchMove(event: TouchEvent) {
      if (isControlTouch(event)) return;
      event.preventDefault();
      const pinch = pinchRef.current;

      if (pinch && event.touches.length === 2) {
        const first = getCanvasPoint(event.touches[0].clientX, event.touches[0].clientY);
        const second = getCanvasPoint(event.touches[1].clientX, event.touches[1].clientY);
        const midpoint = getMidpoint(first, second);
        const minScale = getMinScale(canvasElement.getBoundingClientRect());
        const nextScale = clamp(pinch.camera.scale * (getDistance(first, second) / pinch.distance), minScale, MAX_SCALE);
        const zoomed = getZoomedCamera(pinch.camera, nextScale, pinch.midpoint);
        const panned = { ...zoomed, x: zoomed.x + midpoint.x - pinch.midpoint.x, y: zoomed.y + midpoint.y - pinch.midpoint.y };
        const next = getClampedCamera(panned, canvasElement);
        hasInteractedRef.current = true;
        cameraRef.current = next;
        setCamera(next);
        return;
      }

      const touch = event.touches[0];
      const drag = dragRef.current;
      if (!touch || !drag || touch.identifier !== drag.pointerId) return;
      const position = getCanvasPoint(touch.clientX, touch.clientY);
      const moved = { ...cameraRef.current, x: cameraRef.current.x + position.x - drag.position.x, y: cameraRef.current.y + position.y - drag.position.y };
      const next = getClampedCamera(moved, canvasElement);
      dragRef.current = { ...drag, position };
      hasInteractedRef.current = true;
      cameraRef.current = next;
      setCamera(next);
    }

    function handleTouchEnd(event: TouchEvent) {
      if (isControlTouch(event)) return;
      event.preventDefault();
      beginTouch(event.touches);
      if (event.touches.length === 0) dragRef.current = null;
    }

    canvasElement.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvasElement.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvasElement.addEventListener("touchend", handleTouchEnd, { passive: false });
    canvasElement.addEventListener("touchcancel", handleTouchEnd, { passive: false });
    return () => {
      canvasElement.removeEventListener("touchstart", handleTouchStart);
      canvasElement.removeEventListener("touchmove", handleTouchMove);
      canvasElement.removeEventListener("touchend", handleTouchEnd);
      canvasElement.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [getCanvasPoint]);

  function handlePointerDown(event: React.PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") return;
    if (event.button !== 0) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const position = getCanvasPoint(event.clientX, event.clientY);
    pointersRef.current.set(event.pointerId, position);

    if (pointersRef.current.size === 1) {
      dragRef.current = { pointerId: event.pointerId, position };
      return;
    }

    if (pointersRef.current.size === 2) {
      const [first, second] = [...pointersRef.current.values()];
      pinchRef.current = { camera: cameraRef.current, distance: getDistance(first, second), midpoint: getMidpoint(first, second) };
      dragRef.current = null;
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") return;
    if (!pointersRef.current.has(event.pointerId)) return;
    event.preventDefault();
    const position = getCanvasPoint(event.clientX, event.clientY);
    pointersRef.current.set(event.pointerId, position);

    const pinch = pinchRef.current;
    if (pinch && pointersRef.current.size === 2) {
      const [first, second] = [...pointersRef.current.values()];
      const midpoint = getMidpoint(first, second);
      const canvas = canvasRef.current;
      const minScale = canvas ? getMinScale(canvas.getBoundingClientRect()) : MIN_SCALE;
      const nextScale = clamp(pinch.camera.scale * (getDistance(first, second) / pinch.distance), minScale, MAX_SCALE);
      const zoomed = getZoomedCamera(pinch.camera, nextScale, pinch.midpoint);
      hasInteractedRef.current = true;
      const panned = { ...zoomed, x: zoomed.x + midpoint.x - pinch.midpoint.x, y: zoomed.y + midpoint.y - pinch.midpoint.y };
      const next = canvas ? getClampedCamera(panned, canvas) : panned;
      cameraRef.current = next;
      setCamera(next);
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const x = position.x - drag.position.x;
    const y = position.y - drag.position.y;
    dragRef.current = { ...drag, position };
    hasInteractedRef.current = true;
    setCamera((current) => {
      const moved = { ...current, x: current.x + x, y: current.y + y };
      const next = canvasRef.current ? getClampedCamera(moved, canvasRef.current) : moved;
      cameraRef.current = next;
      return next;
    });
  }

  function stopDragging(event: React.PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") return;
    pointersRef.current.delete(event.pointerId);
    pinchRef.current = null;
    const remaining = [...pointersRef.current.entries()][0];
    dragRef.current = remaining ? { pointerId: remaining[0], position: remaining[1] } : null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function resetCamera() {
    const canvas = canvasRef.current;
    hasInteractedRef.current = false;
    if (canvas) {
      const next = getFittedCamera(canvas);
      cameraRef.current = next;
      setCamera(next);
    }
  }

  return (
    <section
      aria-label="Garden canvas"
      className="garden-canvas"
      onPointerCancel={stopDragging}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      ref={canvasRef}
    >
      <div
        className="garden-camera"
        style={{
          height: GRID_HEIGHT * camera.scale,
          marginLeft: camera.x - (GRID_WIDTH * camera.scale) / 2,
          marginTop: camera.y + GRID_OFFSET_Y - (GRID_HEIGHT * camera.scale) / 2,
          width: GRID_WIDTH * camera.scale,
        }}
      >
        <Image alt="Isometric garden grid" className="isometric-grid" draggable="false" height={377} priority src="/figma/isometric-surface-grid.svg" unoptimized width={655} />
        <div className="garden-items-layer">
          {items.map((item) => (
            <GardenItemLayer item={item} key={item.id} scale={camera.scale} />
          ))}
        </div>
      </div>
      <div aria-label="Garden view controls" className="garden-controls" onPointerDown={(event) => event.stopPropagation()} role="group">
        <button className="garden-control garden-reset" onClick={resetCamera} type="button">Reset</button>
      </div>
      <p className="garden-hint">Drag or pinch · Scroll to zoom</p>
    </section>
  );
}
