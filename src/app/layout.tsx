import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import Link from "next/link";
import AccountMenu, { ImportBanner } from "@/components/AccountMenu";
import ThemeToggle from "@/components/ThemeToggle";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";
import Logo from "@/components/Logo";
import SiteNav from "@/components/SiteNav";

const font = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "ĐMToeic — Luyện thi TOEIC", template: "%s | ĐMToeic" },
  description: "Luyện đề TOEIC Listening & Reading: thi thử 200 câu, luyện từng part, giải thích tiếng Việt.",
  robots: { index: false, follow: false }, // tạm không cho index (bản quyền nội dung đề)
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: THEME_SCRIPT đặt data-theme trước khi React hydrate
    <html lang="vi" className={`${font.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        {/* site-header: ẩn khi đang làm bài trong phòng thi (html[data-exam], xem ExamRoom) */}
        <header className="site-header z-30 border-b border-line bg-surface/90 backdrop-blur sm:sticky sm:top-0">
          {/* điện thoại: menu xuống dòng thứ hai, cuộn ngang được; máy tính: cùng hàng với logo */}
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:h-14 sm:flex-nowrap sm:py-0">
            <Link href="/" aria-label="ĐMToeic — trang chủ" className="shrink-0">
              <Logo />
            </Link>
            <div className="ml-auto flex items-center gap-1 sm:order-3">
              <ThemeToggle />
              <AccountMenu />
            </div>
            <SiteNav />
          </nav>
        </header>
        <ImportBanner />
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
