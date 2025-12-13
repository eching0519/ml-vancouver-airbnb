import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Temporarily disable all custom headers to test if they are causing the 500 errors
  // async headers() {
  //   return [
  //     // Headers temporarily disabled for debugging
  //   ];
  // },

  // Set turbopack root to avoid workspace root inference issues
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
