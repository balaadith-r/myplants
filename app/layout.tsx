import type { Metadata } from "next";
import { Just_Another_Hand } from "next/font/google";
import "./globals.css";

const handFont = Just_Another_Hand({
  variable: "--font-hand",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Placeholder",
  description: "A hand-drawn isometric garden.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={handFont.variable}>
      <body>{children}</body>
    </html>
  );
}
