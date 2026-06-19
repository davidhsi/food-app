/**
 * Canonical site origin, used for absolute URLs in metadata, OG images, and
 * share links. Prefers an explicit NEXT_PUBLIC_SITE_URL, falls back to the
 * Vercel-provided deployment URL, then localhost for dev.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const SITE_NAME = "Truffle";
export const SITE_TAGLINE = "Find the spots before everyone else";
