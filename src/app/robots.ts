import type { MetadataRoute } from "next";

// Nội dung đề ETS có bản quyền → tạm chặn công cụ tìm kiếm (xem PLAN.md 11.5)
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
