import Image from "next/image";
import { DevIconAnchors } from "./dev-icon-anchors";
import { GardenCanvas } from "./garden-canvas";

const navigation = [
  {
    label: "Nursery",
    className: "nursery-link",
    icons: [
      { className: "nursery-cash", src: "/figma/nursery-cash.svg" },
      { className: "nursery-tree", src: "/figma/nursery-tree.svg" },
    ],
  },
  {
    label: "Inventory",
    className: "inventory-link",
    icons: [
      { className: "inventory-pot-one", src: "/figma/inventory-pot-one.svg" },
      { className: "inventory-pot-two", src: "/figma/inventory-pot-two.svg" },
    ],
  },
  {
    label: "Plant New",
    className: "plant-new-link",
    icons: [
      { className: "plant-new-grass", src: "/figma/plant-new-grass.svg" },
      { className: "plant-new-shovel", src: "/figma/plant-new-shovel.svg" },
    ],
  },
  {
    label: "Me",
    className: "me-link",
    icons: [{ className: "me-flower", src: "/figma/me-flower.svg" }],
  },
] as const;

export default function Home() {
  return (
    <main className="garden-home">
      {process.env.NODE_ENV === "development" ? <DevIconAnchors /> : null}
      <header className="garden-header">
        <h1 className="sr-only">myPlants</h1>
        <nav aria-label="Primary navigation" className="garden-navigation">
          {navigation.map(({ label, icons, className }) => (
            <button className={`nav-link ${className}`} key={label} type="button">
              <span className="nav-label">
                {icons.map((icon) => (
                  <Image
                    alt=""
                    className={`nav-icon ${icon.className}`}
                    height={50}
                    key={icon.src}
                    loading="eager"
                    src={icon.src}
                    width={50}
                  />
                ))}
                {label}
              </span>
            </button>
          ))}
        </nav>
      </header>
      <GardenCanvas />
    </main>
  );
}
