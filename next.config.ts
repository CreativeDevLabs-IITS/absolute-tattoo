import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static site: `next build` emits plain HTML/CSS/JS into `out/`.
  output: "export",
  // Write the build to ./dist so the domain's web root can point straight at that folder.
  distDir: "dist",
  // No image server in a static export; responsive AVIF/WebP are pre-built by scripts/optimize-images.mjs.
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
