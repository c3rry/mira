/** @type {import('next').NextConfig} */
const backendUrl = (
  process.env.BACKEND_INTERNAL_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

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
      {
        source: "/vision/:path*",
        destination: `${backendUrl}/vision/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
