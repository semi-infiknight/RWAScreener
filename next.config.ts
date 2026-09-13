import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* static seed lives in /data */
  serverExternalPackages: ["pg"],
};

export default nextConfig;
