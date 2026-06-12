/**
 * next.config.mjs
 * إعدادات Next.js لمشروع Stream Hunter
 * serverExternalPackages: يمنع Next.js من محاولة تجميع Puppeteer للـ client
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['puppeteer', 'puppeteer-core'],
};

export default nextConfig;
