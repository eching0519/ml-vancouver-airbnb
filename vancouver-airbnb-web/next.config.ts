import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Headers migrated from middleware.ts to use the proxy pattern
  async headers() {
    return [
      {
        // Add CORP headers to Next.js static chunks so they work with COEP
        // This is required when COEP is enabled on the HTML page
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
        ],
      },
      {
        // Set Content-Type and CORP headers for .mjs files
        source: "/:path*.mjs",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "cross-origin",
          },
        ],
      },
      {
        // Set Content-Type and CORP headers for .wasm files
        source: "/:path*.wasm",
        headers: [
          {
            key: "Content-Type",
            value: "application/wasm",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "cross-origin",
          },
        ],
      },
      {
        // Add COOP/COEP headers to HTML pages only (not API routes or static assets)
        // This prevents 500 errors on Next.js chunks while still enabling SharedArrayBuffer support
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
        // Note: Next.js automatically excludes _next/* and /api/* from header matching
        // File extensions are handled by other rules above
      },
    ];
  },
};

export default nextConfig;
