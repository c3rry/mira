/** @type {import('next').NextConfig} */
const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const nextConfig = {
  // enable zero-cors api proxy rewrites to fastapi backend
  async rewrites() {
    return [
      {
        source: "/health",
        destination: `${backendUrl}/health`,
      },
      {
        source: "/world/:path*",
        destination: `${backendUrl}/world/:path*`,
      },
      {
        source: "/npc/:path*",
        destination: `${backendUrl}/npc/:path*`,
      },
    ];
  },
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
