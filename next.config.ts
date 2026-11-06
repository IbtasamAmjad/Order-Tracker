import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // react-pdf must load its own React, not the one Next bundles
  serverExternalPackages: ["@react-pdf/renderer", "sharp", "better-sqlite3"],
  // pictures chosen in the customer form travel with the Save (each one is shrunk to about 400 KB first)
  experimental: { serverActions: { bodySizeLimit: "30mb" } },
};

export default nextConfig;
