import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["react-markdown"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "thhqhyihadvbwybybqrq.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
