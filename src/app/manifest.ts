import type { MetadataRoute } from "next";

/**
 * PWA manifest (served at /manifest.webmanifest; Next injects the link tag).
 * Installability = manifest + icons + apple-web-app metadata in layout.tsx —
 * deliberately no service worker: the dataset ships inside the JS bundle, so
 * an SW caching layer risks serving a stale app after deploys for marginal
 * offline value. Revisit if offline browsing becomes a real ask.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Truffle — hidden-gem restaurants",
    short_name: "Truffle",
    description:
      "Find the under-the-radar spots before everyone else — ranked for your taste.",
    id: "/feed",
    start_url: "/feed",
    display: "standalone",
    background_color: "#f4f1e8",
    theme_color: "#f4f1e8",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
