import Image from "next/image";

const navigation = [
  { label: "Nursery", assets: ["/figma/nursery-cash.svg", "/figma/nursery-tree.svg"], className: "nursery-link" },
  { label: "Inventory", assets: ["/figma/inventory-pot-one.svg", "/figma/inventory-pot-two.svg"], className: "inventory-link" },
  { label: "Plant New", assets: ["/figma/plant-new-grass.svg", "/figma/plant-new-shovel.svg"], className: "plant-new-link" },
  { label: "Me", assets: ["/figma/me-flower.svg"], className: "me-link" },
] as const;

export default function Home() {
  return (
    <main className="garden-home">
      <header className="garden-header">
        <p className="wordmark">Placeholder</p>
        <nav aria-label="Primary navigation" className="garden-navigation">
          {navigation.map(({ label, assets, className }) => (
            <button className={`nav-link ${className}`} key={label} type="button">
              <span aria-hidden="true" className="nav-art">
                {assets.map((asset) => <Image alt="" height={50} key={asset} src={asset} width={50} />)}
              </span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </header>
      <section aria-label="Garden canvas" className="garden-canvas">
        <Image alt="Isometric garden grid" className="isometric-grid" height={376} priority src="/figma/isometric-surface-grid.svg" width={653} />
      </section>
    </main>
  );
}
