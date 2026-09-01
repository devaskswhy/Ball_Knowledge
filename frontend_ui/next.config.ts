import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.api-sports.io",
        pathname: "/**",
      },
      // football-data.org serves team crests and competition emblems.
      {
        protocol: "https",
        hostname: "crests.football-data.org",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;

