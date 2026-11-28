"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { addPlant, svgDataUrl } from "../_inventory/inventory";
import { rollRarity } from "../_inventory/rarity";
import { diamondPoints, gridToWorld, TILE_HALF_HEIGHT } from "../_garden/geometry";
import {
  addPoint,
  ANCHOR,
  BOX,
  clipToBox,
  DRAWING_TO_WORLD,
  drawingToSvg,
  hasInk,
  INK,
  inkBounds,
  isInsideBox,
  PEN_WIDTH,
  strokePath,
  strokesMarkup,
  type Stroke,
  type Tool,
} from "./drawing";

// Long enough for a fun name, short enough to fit one line on a card.
const NAME_LIMIT = 20;

// The drawing stage shows the blue box plus the guide tile, which pokes out
// past the box. Positions are from the Figma design, relative to the box.
const TILE = { x: 46.913 - 79.11, y: 362.871 - 255.57, width: 308.174, height: 171.014 };
const STAGE = { x: TILE.x, y: 0, width: TILE.width, height: TILE.y + TILE.height };

type Gesture = {
  pointerId: number;
  toBox: DOMMatrix;
  segments: Stroke[];
  current: Stroke | null;
  /** The previous sample, in box units, whether or not it was inside. */
  last: { x: number; y: number } | null;
};

function DrawingStage({ strokes, tool, onCommit }: { strokes: Stroke[]; tool: Tool; onCommit: (segments: Stroke[]) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const frameRef = useRef(0);
  const [live, setLive] = useState<Stroke[]>([]);
  // Mask and clip ids must be unique on the page and valid inside url(#...).
  const idPrefix = useId().replace(/[^a-zA-Z0-9]/g, "");
  const clipId = `${idPrefix}clip`;

  const committed = useMemo(() => strokesMarkup(strokes, `${idPrefix}c`), [strokes, idPrefix]);
  // A live eraser stroke has to mask what is under it, so it is drawn through
  // the full markup. Live pen strokes are cheap plain paths on top.
  const erasingLive = live.length > 0 && live[0].tool === "eraser";
  const markup = erasingLive ? strokesMarkup([...strokes, ...live], `${idPrefix}l`) : committed;

  function scheduleRender() {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      const gesture = gestureRef.current;
      setLive(gesture ? gesture.segments.map((segment) => ({ ...segment, points: [...segment.points] })) : []);
    });
  }

  function addClientPoint(gesture: Gesture, clientX: number, clientY: number) {
    const { x, y } = new DOMPoint(clientX, clientY).matrixTransform(gesture.toBox);
    const last = gesture.last;
    gesture.last = { x, y };

    const startSegment = (startX: number, startY: number) => {
      gesture.current = { tool, points: [] };
      gesture.segments.push(gesture.current);
      addPoint(gesture.current.points, startX, startY);
    };

    if (!last) {
      if (isInsideBox(x, y)) startSegment(x, y);
      return;
    }

    // Nothing is ever drawn outside the box. Leaving it ends the line exactly
    // at the edge; coming back starts a new line at the edge it crossed.
    const clip = clipToBox(last.x, last.y, x, y);
    if (!clip) {
      gesture.current = null;
      return;
    }
    const [start, end] = clip;
    const at = (t: number) => [last.x + (x - last.x) * t, last.y + (y - last.y) * t] as const;
    if (!gesture.current || start > 0) startSegment(...at(start));
    addPoint(gesture.current!.points, ...at(end));
    if (end < 1) gesture.current = null;
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (gestureRef.current) return; // One finger draws; others are ignored.
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    const gesture: Gesture = { pointerId: event.pointerId, toBox: matrix.inverse(), segments: [], current: null, last: null };
    gestureRef.current = gesture;
    addClientPoint(gesture, event.clientX, event.clientY);
    scheduleRender();
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    // Coalesced events carry the in-between samples a fast stroke would
    // otherwise lose, so curves stay smooth.
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const sample of samples.length > 0 ? samples : [event.nativeEvent]) {
      addClientPoint(gesture, sample.clientX, sample.clientY);
    }
    scheduleRender();
  }

  function finishGesture(event: React.PointerEvent<SVGSVGElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    setLive([]);
    const segments = gesture.segments.filter((segment) => segment.points.length > 0);
    if (segments.length > 0) onCommit(segments);
  }

  return (
    <svg
      aria-label="Drawing area"
      className={tool === "eraser" ? "drawing-stage is-erasing" : "drawing-stage"}
      onPointerCancel={finishGesture}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishGesture}
      ref={svgRef}
      role="img"
      viewBox={`${STAGE.x} ${STAGE.y} ${STAGE.width} ${STAGE.height}`}
    >
      <defs>
        <clipPath id={clipId}>
          <rect height={BOX.height} width={BOX.width} />
        </clipPath>
      </defs>
      <image height={TILE.height} href="/figma/plant-new/tile.svg" width={TILE.width} x={TILE.x} y={TILE.y} />
      <g clipPath={`url(#${clipId})`}>
        <g dangerouslySetInnerHTML={{ __html: markup }} />
        {erasingLive
          ? null
          : live.map((segment, index) => (
              <path
                d={strokePath(segment.points)}
                fill="none"
                key={index}
                stroke={INK}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={PEN_WIDTH}
              />
            ))}
      </g>
      <image height={BOX.height} href="/figma/plant-new/hitbox.svg" width={BOX.width} x={0} y={0} />
    </svg>
  );
}

// Preview: a 3 x 3 patch of garden tiles at garden proportions, with the plant
// standing on the middle tile exactly as it will in the garden.
const PREVIEW_TILES = 3;
const PREVIEW_PLANT = { width: BOX.width * DRAWING_TO_WORLD, height: BOX.height * DRAWING_TO_WORLD };

function previewLines() {
  let d = "";
  for (let k = 0; k <= PREVIEW_TILES; k++) {
    const a = gridToWorld(k, 0);
    const b = gridToWorld(k, PREVIEW_TILES);
    const c = gridToWorld(0, k);
    const e = gridToWorld(PREVIEW_TILES, k);
    d += `M${a.x} ${a.y}L${b.x} ${b.y}M${c.x} ${c.y}L${e.x} ${e.y}`;
  }
  return d;
}

function PlantPreview({ strokes }: { strokes: Stroke[] }) {
  const src = useMemo(() => svgDataUrl(drawingToSvg(strokes)), [strokes]);
  const center = gridToWorld(1.5, 1.5);
  const top = Math.min(0, center.y - ANCHOR.y * DRAWING_TO_WORLD) - 8;
  const half = PREVIEW_TILES * gridToWorld(1, 0).x;
  const bottom = PREVIEW_TILES * 2 * TILE_HALF_HEIGHT + 4;

  return (
    <svg aria-label="Preview of the plant in a garden" className="drawing-stage drawing-preview" role="img" viewBox={`${-half - 4} ${top} ${half * 2 + 8} ${bottom - top}`}>
      <path d={previewLines()} fill="none" stroke={INK} strokeLinecap="round" strokeWidth={1} />
      <polygon fill="rgb(62 62 62 / 0.08)" points={diamondPoints(1, 1, 2, 2)} />
      <image
        height={PREVIEW_PLANT.height}
        href={src}
        width={PREVIEW_PLANT.width}
        x={center.x - ANCHOR.x * DRAWING_TO_WORLD}
        y={center.y - ANCHOR.y * DRAWING_TO_WORLD}
      />
    </svg>
  );
}

export function PlantCreator() {
  const router = useRouter();
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  // Each entry is the drawing as it was before one action, so undo also
  // brings back a cleared drawing.
  const [history, setHistory] = useState<Stroke[][]>([]);
  const [tool, setTool] = useState<Tool>("pen");
  const [previewing, setPreviewing] = useState(false);
  const [name, setName] = useState("");

  const canCreate = hasInk(strokes) && name.trim().length > 0;

  function commit(segments: Stroke[]) {
    setHistory((current) => [...current, strokes]);
    setStrokes([...strokes, ...segments]);
  }

  function undo() {
    if (history.length === 0) return;
    setStrokes(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  }

  function clear() {
    if (strokes.length === 0) return;
    setHistory((current) => [...current, strokes]);
    setStrokes([]);
  }

  // Next.js keeps this page's state when navigating away (Cache Components
  // hides routes instead of unmounting them), so a finished or discarded
  // drawing has to be cleared by hand. Leaving any other way keeps the draft.
  function reset() {
    setStrokes([]);
    setHistory([]);
    setTool("pen");
    setPreviewing(false);
    setName("");
  }

  function create(event: React.FormEvent) {
    event.preventDefault();
    if (!canCreate) return;
    addPlant({ name: name.trim(), svg: drawingToSvg(strokes), bounds: inkBounds(strokes), rarity: rollRarity() });
    reset();
    // The congrats page and live rarity draw will go here.
    router.push("/");
  }

  return (
    <form className="plant-creator" onSubmit={create}>
      <div className="creator-instructions">
        <p>Draw within the blue box</p>
        <p className="creator-dot-line">
          <Image alt="Blue dot" className="creator-dot" height={5.45876} src="/figma/plant-new/center-dot.svg" width={5.45876} />
          is the center of the tile
        </p>
        <p>And give it a nice name</p>
      </div>

      <div className="creator-stage">
        {previewing ? <PlantPreview strokes={strokes} /> : <DrawingStage onCommit={commit} strokes={strokes} tool={tool} />}
      </div>

      <div className="creator-tools" role="toolbar" aria-label="Drawing tools">
        <button aria-label="Undo" className="creator-button creator-icon-button" disabled={previewing || history.length === 0} onClick={undo} type="button">
          <Image alt="" height={15} src="/figma/plant-new/undo.svg" width={16} />
        </button>
        <button
          aria-label="Eraser"
          aria-pressed={tool === "eraser"}
          className="creator-button creator-icon-button"
          disabled={previewing}
          onClick={() => setTool(tool === "eraser" ? "pen" : "eraser")}
          type="button"
        >
          <Image alt="" height={20} src="/figma/plant-new/eraser.svg" width={20} />
        </button>
        <button aria-label="Clear drawing" className="creator-button creator-icon-button" disabled={previewing || strokes.length === 0} onClick={clear} type="button">
          <Image alt="" height={17} src="/figma/plant-new/trash.svg" width={15.5} />
        </button>
        <button
          aria-pressed={previewing}
          className="creator-button creator-text-button"
          disabled={!previewing && !hasInk(strokes)}
          onClick={() => setPreviewing(!previewing)}
          type="button"
        >
          {previewing ? "Edit" : "Preview"}
        </button>
      </div>

      <label className="creator-name">
        <span className="sr-only">Plant name</span>
        <input maxLength={NAME_LIMIT} onChange={(event) => setName(event.target.value)} placeholder="Give it a name..." type="text" value={name} />
        <span aria-live="polite" className="creator-count">
          {name.length}/{NAME_LIMIT}
        </span>
      </label>

      <div className="creator-actions">
        {/* There is no back button, so Discard is the way home. */}
        <Link className="creator-button creator-text-button creator-discard" href="/" onClick={reset}>
          Discard
        </Link>
        <button className="creator-button creator-text-button creator-create" disabled={!canCreate} type="submit">
          Create
        </button>
        <Image alt="" className="creator-flower" height={104.99} src="/figma/plant-new/create-flower.svg" width={61.9205} />
      </div>
    </form>
  );
}
