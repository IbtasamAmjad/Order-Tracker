import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // react-pdf must load its own React, not the one Next bundles
  serverExternalPackages: ["@react-pdf/renderer", "sharp", "better-sqlite3"],
  /* config options here */
};

export default nextConfig;
