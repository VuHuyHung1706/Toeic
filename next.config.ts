import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Data/ (~1,7 GB audio/ảnh) được phục vụ lúc chạy qua /media, không đóng gói vào bản build
  outputFileTracingExcludes: {
    "/*": ["./Data/**/*"],
  },
  // PGlite (Postgres WASM, chỉ dùng ở dev) đọc file .wasm/.data của chính nó → không đóng gói
  serverExternalPackages: ["@electric-sql/pglite"],
  // ẩn nút "N" của Next.js ở góc màn hình khi chạy dev (lỗi biên dịch/runtime vẫn hiện)
  devIndicators: false,
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
