import Image from "next/image";
import Link from "next/link";

type NavItem = {
  label: string;
  className: string;
  /** Pages that exist are links; the rest stay buttons until they are built. */
  href?: string;
  icons: readonly { className: string; src: string }[];
};

const navigation: readonly NavItem[] = [
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
    href: "/plant-new",
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
];

export function SiteHeader() {
  return (
    <header className="garden-header">
      <h1 className="sr-only">myPlants</h1>
      <nav aria-label="Primary navigation" className="garden-navigation">
        {navigation.map(({ label, icons, className, href }) => {
          const content = (
            <span className="nav-label">
              {icons.map((icon) => (
                <Image alt="" className={`nav-icon ${icon.className}`} height={50} key={icon.src} loading="eager" src={icon.src} width={50} />
              ))}
              {label}
            </span>
          );

          return href ? (
            <Link className={`nav-link ${className}`} href={href} key={label}>
              {content}
            </Link>
          ) : (
            <button className={`nav-link ${className}`} key={label} type="button">
              {content}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
