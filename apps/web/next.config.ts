import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@whatsfiled/db",
    "@whatsfiled/trpc",
    "@whatsfiled/ui",
    "@whatsfiled/edgar-client",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
