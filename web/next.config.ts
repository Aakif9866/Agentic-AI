import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pure static site: `npm run build` writes ./out, deployable to any static host.
  output: "export",
  // /modules/4/index.html — served by any static host (Render, GitHub Pages) without rewrite rules.
  trailingSlash: true,
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
