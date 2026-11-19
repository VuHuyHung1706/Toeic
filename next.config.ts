import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Data/ (~1,7 GB audio/ảnh) được phục vụ lúc chạy qua /media, không đóng gói vào bản build
  outputFileTracingExcludes: {
    "/*": ["./Data/**/*"],
  },
  cacheComponents: true,
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
