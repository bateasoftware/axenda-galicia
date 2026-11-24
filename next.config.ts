import type { NextConfig } from "next";

// Carteles publicados desde el panel: Vercel Blob (con Turso) o Supabase Storage (bucket "carteles")
const supabase = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : "*.supabase.co";

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/carteles/**" },
      { protocol: "https", hostname: supabase, pathname: "/storage/v1/object/public/carteles/**" },
    ],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
