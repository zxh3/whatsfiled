import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@whatsfiled/db",
    "@whatsfiled/trpc",
    "@whatsfiled/ui",
    "@whatsfiled/edgar-client",
  ],
};

export default nextConfig;
