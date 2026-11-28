import type { Metadata } from "next";
import { SiteHeader } from "../_components/site-header";
import { InventoryView } from "../_inventory/inventory-view";

export const metadata: Metadata = {
  title: "Inventory",
  description: "The plants you have drawn, ready to plant in your garden.",
};

export default function InventoryPage() {
  return (
    <main className="garden-home">
      <SiteHeader />
      <InventoryView mode="browse" />
    </main>
  );
}
