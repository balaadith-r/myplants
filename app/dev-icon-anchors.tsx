"use client";

import { useEffect } from "react";

const OVERLAY_CLASS = "show-icon-anchors";

/**
 * Development-only helper for positioning the navigation icons.
 * Press Shift+D to toggle an overlay that outlines each label and marks
 * the anchor point every icon is measured from (the label's center).
 */
export function DevIconAnchors() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key.toLowerCase() !== "d") {
        return;
      }

      const active = document.body.classList.toggle(OVERLAY_CLASS);
      console.info(`[nav icons] anchor overlay ${active ? "on" : "off"}`);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
