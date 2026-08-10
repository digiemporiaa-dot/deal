/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
  },
  eslint: {
    // Lint is run explicitly via `npm run lint`; keep it out of the build step.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
