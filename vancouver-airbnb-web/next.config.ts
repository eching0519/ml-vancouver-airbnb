import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Headers are now handled by middleware.ts to avoid conflicts with Next.js internal routes
  async headers() {
    return [
      {
        // Set Content-Type headers for .mjs files (middleware handles CORP)
        source: "/:path*.mjs",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript",
          },
        ],
      },
      {
        // Set Content-Type headers for .wasm files (middleware handles CORP)
        source: "/:path*.wasm",
        headers: [
          {
            key: "Content-Type",
            value: "application/wasm",
          },
        ],
      },
    ];
  },
  // Ensure proper handling of CSS chunks
  experimental: {
    optimizePackageImports: ["leaflet", "react-leaflet"],
  },
};

export default nextConfig;
