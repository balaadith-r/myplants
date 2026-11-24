import type { Metadata } from "next";
import { SiteHeader } from "../_components/site-header";
import { PlantCreator } from "../_drawing/plant-creator";

export const metadata: Metadata = {
  title: "Plant New",
  description: "Draw and name a new plant for your garden.",
};

export default function PlantNewPage() {
  return (
    <main className="garden-home">
      <SiteHeader />
      <PlantCreator />
    </main>
  );
}
