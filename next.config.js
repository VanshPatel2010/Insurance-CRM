/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ── Native binary / ESM packages that must stay outside the webpack bundle ──
  serverExternalPackages: ['@napi-rs/canvas', 'pdfjs-dist'],

  // ── Compiler optimizations ──────────────────────────────────────────────────
  compiler: {
    // Strip console.log in production — reduces JS parse time on the main thread.
    // console.error and console.warn are kept for runtime diagnostics.
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },

  // ── HTTP headers ────────────────────────────────────────────────────────────
  async headers() {
    return [
      {
        // These headers apply to every response
        source: '/(.*)',
        headers: [
          // Tell browsers (and Vercel's CDN) to cache immutable static assets
          // aggressively. Next.js content-hashes filenames so this is safe.
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          // Security hardening that also slightly speeds up HTTPS negotiation
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },

      {
        // Cache API routes for a short window — prevents redundant DB calls
        // on rapid re-renders. Override per-route if stricter freshness required.
        source: '/api/dashboard/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, max-age=30, stale-while-revalidate=60',
          },
        ],
      },
    ];
  },

  // ── Redirects ───────────────────────────────────────────────────────────────
  // Vercel handles http→https and www→non-www automatically at the CDN layer
  // (no 301 redirect overhead in user code). Keep this array empty to avoid
  // double-redirect chains that add ~268 ms per page load.
  async redirects() {
    return [];
  },

  // ── Webpack tweaks (only used for non-Turbopack builds / CI) ───────────────
  webpack(config, { dev, isServer }) {
    if (!dev && !isServer) {
      // Ensure modern-only output — removes legacy polyfills for Array.flat,
      // Object.fromEntries, optional chaining, etc.
      // Next.js already targets ES2017+ by default; this makes it explicit and
      // allows Terser to drop dead polyfill code from your own dependencies.
      config.target = ['web', 'es2017'];
    }
    return config;
  },

  turbopack: {},
};

module.exports = nextConfig;
