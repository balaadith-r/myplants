import type { CSSProperties } from "react";
import { BOX, type Bounds } from "../_drawing/drawing";
import { plantImageUrl, svgDataUrl, type InventoryPlant } from "./inventory";
import { RARITY_LABELS } from "./rarity";

// The drawing frame on a card, in Figma pixels. The ink is fitted into the
// middle of it with some air around, and never enlarged past its drawn size,
// so a tiny doodle stays a tiny doodle.
const FRAME = { width: 176, height: 111.012 };
const FIT = { width: FRAME.width * 0.9, height: FRAME.height * 0.8 };

/** Places the whole drawing so its ink sits centred in the frame. */
function framing(bounds: Bounds): CSSProperties {
  const scale = Math.min(FIT.width / bounds.width, FIT.height / bounds.height, 1);
  const left = FRAME.width / 2 - (bounds.x + bounds.width / 2) * scale;
  const top = FRAME.height / 2 - (bounds.y + bounds.height / 2) * scale;
  // Percentages of the frame, so the card can scale on small screens.
  return {
    height: `${((BOX.height * scale) / FRAME.height) * 100}%`,
    left: `${(left / FRAME.width) * 100}%`,
    top: `${(top / FRAME.height) * 100}%`,
    width: `${((BOX.width * scale) / FRAME.width) * 100}%`,
  };
}

/**
 * One plant as a card: drawing, name, rarity, who drew it and their
 * signature. Built from spans so it can sit inside a button.
 */
export function PlantCard({ plant }: { plant: InventoryPlant }) {
  return (
    <span className="plant-card">
      <span className="plant-card-frame">
        {/* A data URL of the player's own drawing; nothing for next/image to optimise. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" className="plant-card-art" draggable={false} src={plantImageUrl(plant)} style={framing(plant.bounds)} />
      </span>
      <span className="plant-card-name">“{plant.name}”</span>
      <span className="plant-card-details">
        <span className="plant-card-rarity">
          Rarity: <span className={`rarity-mark rarity-${plant.rarity}`}>{RARITY_LABELS[plant.rarity]}</span>
        </span>
        <span className="plant-card-artist">{plant.artist ?? "Original"}</span>
        {/* Reserved for the artist's signature from their account settings. */}
        <span className="plant-card-signature">
          {plant.signature ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={`${plant.artist ?? "Your"} signature`} src={svgDataUrl(plant.signature)} />
          ) : null}
        </span>
      </span>
    </span>
  );
}
