import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a phone load the dev server over the LAN. Without these, Next blocks
  // its dev-only endpoints (including the HMR socket), so the page renders but
  // never hydrates. The Mac's LAN address changes (DHCP), so this allows any
  // 192.168.x.x home-network address rather than one fixed IP. Development
  // only; ignored in production.
  allowedDevOrigins: ["192.168.*.*", "*.local"],
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
