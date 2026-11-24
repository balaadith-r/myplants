import { SiteHeader } from "./_components/site-header";
import { GardenCanvas } from "./_garden/garden-canvas";
import { DevIconAnchors } from "./dev-icon-anchors";

export default function Home() {
  return (
    <main className="garden-home">
      {process.env.NODE_ENV === "development" ? <DevIconAnchors /> : null}
      <SiteHeader />
      <GardenCanvas />
    </main>
  );
}
