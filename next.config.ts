import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Next.js from trying to bundle native-module packages.
  // playwright and node-cron must run server-side only.
  serverExternalPackages: ['playwright', 'playwright-core', 'playwright-extra', 'puppeteer-extra-plugin-stealth', 'node-cron', '@prisma/client', 'prisma'],
};

export default nextConfig;
