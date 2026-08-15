/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.dsmcdn.com" },
      { protocol: "https", hostname: "*.trendyol.com" },
    ],
  },
};

export default nextConfig;
