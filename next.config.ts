import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /* Two hosts serve product imagery: the seed data points at Unsplash, and
       everything uploaded through the admin lands in the Supabase bucket.

       Optimisation happens in Next, not through Supabase's render endpoint,
       so this works on the free tier — see the note in lib/supabase/storage.ts
       about image transformations being a paid-plan feature. The masters in
       the bucket are still never touched. */
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    /* Admins bounce between Products, Orders and Settings constantly. Holding
       each route's RSC payload for 30 seconds makes the second visit instant.
       Every mutation already calls router.refresh(), which busts this, so a
       save is still reflected immediately. */
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
