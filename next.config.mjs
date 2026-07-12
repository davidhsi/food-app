/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Real HTTP redirect at the edge for the bare domain. The app-router
  // `redirect()` in `src/app/page.tsx` only redirects once JS runs — non-JS
  // clients (link unfurlers, crawlers) hitting a shared "eatanaba.com" would
  // otherwise see an empty shell.
  redirects: async () => [
    { source: "/", destination: "/feed", permanent: false },
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
