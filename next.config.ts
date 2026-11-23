import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a phone load the dev server over the LAN. Without these, Next blocks
  // its dev-only endpoints (including the HMR socket), so the page renders but
  // never hydrates. Development only; ignored in production.
  allowedDevOrigins: ["192.168.0.118", "*.local"],
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
