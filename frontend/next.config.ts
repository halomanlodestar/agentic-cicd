/** @format */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Transpile workspace packages (they export raw TS source, not compiled JS)
  transpilePackages: ["@rift/types", "@rift/queue", "@rift/redis"],
  // Keep Node.js-only packages out of the client bundle
  serverExternalPackages: ["ioredis", "bullmq"],
};

export default nextConfig;
