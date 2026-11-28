"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { pendingPlant } from "../_garden/layout";
import { useResetOnLeave } from "../_lib/reset-on-leave";
import { useHydrated } from "../_lib/stores";
import { deletePlant, useInventory, type InventoryPlant } from "./inventory";
import { PlantCard } from "./plant-card";
import { rarityRank } from "./rarity";

type SortKey = "latest" | "oldest" | "rarity" | "ownership";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "latest", label: "Latest" },
  { key: "oldest", label: "Oldest" },
  { key: "rarity", label: "Rarity" },
  { key: "ownership", label: "Ownership" },
];

function sortPlants(plants: InventoryPlant[], sort: SortKey) {
  const newestFirst = (a: InventoryPlant, b: InventoryPlant) => b.createdAt - a.createdAt;
  const sorted = [...plants];
  switch (sort) {
    case "latest":
      return sorted.sort(newestFirst);
    case "oldest":
      return sorted.sort((a, b) => a.createdAt - b.createdAt);
    case "rarity":
      return sorted.sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || newestFirst(a, b));
    case "ownership":
      // The player's own plants first, then ones bought from other artists.
      return sorted.sort((a, b) => Number(a.artist !== null) - Number(b.artist !== null) || newestFirst(a, b));
  }
}

// One card and the gaps between cards, in Figma pixels (402px wide frame).
const CARD = { width: 186.535, height: 204.098, gapX: 8.32, gapY: 17.82 };

type GridFit = { columns: number; rows: number; cardWidth: number };

/**
 * How many cards fit without scrolling. Phones always get two columns,
 * shrinking the cards if the screen is narrower than the design; wider screens
 * get more columns at full size. Rows are whatever fits the height, and the
 * rest go on later pages.
 */
function fitGrid(width: number, height: number): GridFit {
  const columns = Math.max(2, Math.floor((width + CARD.gapX) / (CARD.width + CARD.gapX)));
  const cardWidth = Math.min(CARD.width, (width - CARD.gapX * (columns - 1)) / columns);
  const scale = cardWidth / CARD.width;
  // A pixel of slack, so a screen exactly the design's size still fits 3 rows.
  const rows = Math.max(1, Math.floor((height + 1 + CARD.gapY * scale) / ((CARD.height + CARD.gapY) * scale)));
  return { columns, rows, cardWidth };
}

type Selection = { id: string; confirmingDelete: boolean };

type InventoryViewProps =
  /** The Inventory page: picking a card offers Use or Delete. */
  | { mode: "browse" }
  /** Choosing a plant for a garden tile: picking a card chooses it straight away. */
  | { mode: "pick"; onPick: (plant: InventoryPlant) => void; onCancel: () => void };

export function InventoryView(props: InventoryViewProps) {
  const router = useRouter();
  const hydrated = useHydrated();
  const plants = useInventory();
  const areaRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const [sort, setSort] = useState<SortKey>("latest");
  const [menuOpen, setMenuOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [grid, setGrid] = useState<GridFit>({ columns: 2, rows: 3, cardWidth: CARD.width });

  const sorted = useMemo(() => sortPlants(plants, sort), [plants, sort]);

  const perPage = grid.columns * grid.rows;
  const pageCount = Math.max(1, Math.ceil(sorted.length / perPage));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = sorted.slice(currentPage * perPage, (currentPage + 1) * perPage);
  const selected = selection && visible.some((plant) => plant.id === selection.id) ? selection : null;
  const isEmpty = hydrated && sorted.length === 0;

  const onCancel = props.mode === "pick" ? props.onCancel : null;

  // Coming back starts on the first page with nothing selected and the menu
  // shut. Only the sort the player chose is kept.
  useResetOnLeave(() => {
    setSelection(null);
    setMenuOpen(false);
    setPage(0);
  });

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = fitGrid(entry.contentRect.width, entry.contentRect.height);
      setGrid((current) =>
        current.columns === next.columns && current.rows === next.rows && current.cardWidth === next.cardWidth ? current : next,
      );
    });
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  // Escape backs out one step: the menu, then the selection, then the picker.
  useEffect(() => {
    if (!menuOpen && !selected && !onCancel) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (menuOpen) setMenuOpen(false);
      else if (selected) setSelection(null);
      else onCancel?.();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen, selected, onCancel]);

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!filterRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [menuOpen]);

  function chooseSort(key: SortKey) {
    setSort(key);
    setPage(0);
    setMenuOpen(false);
  }

  function goToPage(next: number) {
    setPage(Math.min(Math.max(next, 0), pageCount - 1));
    setSelection(null);
  }

  function choose(plant: InventoryPlant) {
    if (props.mode === "pick") {
      props.onPick(plant);
      return;
    }
    setSelection((current) => (current?.id === plant.id ? null : { id: plant.id, confirmingDelete: false }));
  }

  function use(plant: InventoryPlant) {
    pendingPlant.set(plant.id);
    router.push("/");
  }

  function remove(plant: InventoryPlant) {
    deletePlant(plant.id);
    setSelection(null);
  }

  const sortLabel = SORTS.find((option) => option.key === sort)?.label;

  return (
    <div className={props.mode === "pick" ? "inventory is-picking" : "inventory"}>
      <div className="inventory-toolbar">
        {hydrated && !isEmpty ? (
          <div className="inventory-filter" ref={filterRef}>
            <button aria-expanded={menuOpen} aria-haspopup="menu" className="inventory-filter-button" onClick={() => setMenuOpen(!menuOpen)} type="button">
              <span className="inventory-filter-icon">
                <Image alt="" height={13.6} src="/figma/inventory/filter.svg" width={14.9334} />
              </span>
              Showing: {sortLabel}
            </button>
            {menuOpen ? (
              <div aria-label="Sort plants by" className="inventory-menu" role="menu">
                {SORTS.map((option) => (
                  <button
                    aria-checked={option.key === sort}
                    className="inventory-menu-item"
                    key={option.key}
                    onClick={() => chooseSort(option.key)}
                    role="menuitemradio"
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {/* Every page's back goes home, since there is no home button. Over
            the garden, that just closes the picker. */}
        {onCancel ? (
          <button className="inventory-back" onClick={onCancel} type="button">
            back
          </button>
        ) : (
          <Link className="inventory-back" href="/">
            back
          </Link>
        )}
      </div>

      <div className="inventory-area" ref={areaRef}>
        {hydrated && !isEmpty ? (
          <ul
            className="inventory-grid"
            style={{ "--card-width": `${grid.cardWidth}px`, gridTemplateColumns: `repeat(${grid.columns}, var(--card-width))` } as React.CSSProperties}
          >
            {visible.map((plant, index) => {
              const isSelected = selected?.id === plant.id;
              // Actions go beside the card, on the left for the last column.
              const actionsOnLeft = index % grid.columns === grid.columns - 1;
              return (
                <li className={isSelected ? "inventory-cell is-selected" : "inventory-cell"} key={plant.id}>
                  <button aria-pressed={props.mode === "browse" ? isSelected : undefined} className="inventory-card-button" onClick={() => choose(plant)} type="button">
                    <PlantCard plant={plant} />
                  </button>
                  {isSelected ? (
                    <div className={actionsOnLeft ? "inventory-actions is-left" : "inventory-actions"}>
                      {selected.confirmingDelete ? (
                        <>
                          <button className="inventory-action inventory-delete" onClick={() => remove(plant)} type="button">
                            Delete
                          </button>
                          {/* Focus lands on the safe choice. */}
                          <button autoFocus className="inventory-action inventory-keep" onClick={() => setSelection({ id: plant.id, confirmingDelete: false })} type="button">
                            Keep
                          </button>
                        </>
                      ) : (
                        <>
                          <button autoFocus className="inventory-action inventory-use" onClick={() => use(plant)} type="button">
                            Use
                          </button>
                          <button
                            aria-label={`Delete “${plant.name}”`}
                            className="inventory-action inventory-trash"
                            onClick={() => setSelection({ id: plant.id, confirmingDelete: true })}
                            type="button"
                          >
                            <Image alt="" className="inventory-trash-box" height={68} src="/figma/inventory/trash-box.svg" width={47} />
                            <Image alt="" className="inventory-trash-icon" height={22.8333} src="/figma/inventory/trash.svg" width={20.75} />
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      {/* Always laid out, so the grid does not jump when a second page appears. */}
      <nav aria-hidden={pageCount <= 1} aria-label="Inventory pages" className={pageCount > 1 ? "inventory-pager" : "inventory-pager is-hidden"}>
        <button aria-label="Previous page" className="inventory-page-button" disabled={currentPage === 0} onClick={() => goToPage(currentPage - 1)} type="button">
          <Image alt="" height={39.21} src="/figma/inventory/go-left.svg" width={54.3416} />
        </button>
        <span aria-live="polite" className="inventory-dots">
          <span className="sr-only">
            Page {currentPage + 1} of {pageCount}
          </span>
          {pageCount <= 8
            ? Array.from({ length: pageCount }, (_, index) => (
                <span aria-hidden className={index === currentPage ? "inventory-dot is-current" : "inventory-dot"} key={index} />
              ))
            : (
                <span aria-hidden className="inventory-page-count">
                  {currentPage + 1} / {pageCount}
                </span>
              )}
        </span>
        <button aria-label="Next page" className="inventory-page-button" disabled={currentPage >= pageCount - 1} onClick={() => goToPage(currentPage + 1)} type="button">
          <Image alt="" height={39.21} src="/figma/inventory/go-right.svg" width={54.3416} />
        </button>
      </nav>

      {isEmpty ? (
        <div className="inventory-empty">
          <p>Nothing here</p>
          <Link href="/plant-new">
            Start planting
          </Link>
        </div>
      ) : null}

      {/* Blurs everything but the selected card; tapping it cancels. */}
      {selected ? <div aria-hidden className="inventory-veil" onClick={() => setSelection(null)} /> : null}
    </div>
  );
}
