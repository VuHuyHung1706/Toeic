import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import Link from "next/link";
import AccountMenu, { ImportBanner } from "@/components/AccountMenu";
import "./globals.css";

const font = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "ToeicLab — Luyện thi TOEIC", template: "%s | ToeicLab" },
  description: "Luyện đề TOEIC Listening & Reading: thi thử 200 câu, luyện từng part, giải thích tiếng Việt.",
  robots: { index: false, follow: false }, // tạm không cho index (bản quyền nội dung đề)
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${font.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {/* site-header: ẩn khi đang làm bài trong phòng thi (html[data-exam], xem ExamRoom) */}
        <header className="site-header z-30 border-b border-line bg-surface/90 backdrop-blur sm:sticky sm:top-0">
          {/* điện thoại: menu xuống dòng thứ hai, cuộn ngang được; máy tính: cùng hàng với logo */}
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2 sm:h-14 sm:flex-nowrap sm:py-0">
            <Link href="/" className="shrink-0 text-lg font-bold tracking-tight">
              Toeic<span className="text-primary">Lab</span>
            </Link>
            <div className="ml-auto sm:order-3">
              <AccountMenu />
            </div>
            <div className="-mx-4 flex w-[calc(100%+2rem)] min-w-0 items-center gap-3 overflow-x-auto px-4 pb-1 text-[13px] whitespace-nowrap text-muted sm:mx-0 sm:w-auto sm:gap-4 sm:px-0 sm:pb-0 sm:text-sm">
              {[
                ["/tests", "Đề thi", "Đề thi"],
                ["/practice", "Luyện dạng", "Dạng câu"],
                ["/listening", "Luyện nghe", "Nghe"],
                ["/vocabulary", "Từ vựng", "Từ vựng"],
                ["/mistakes", "Sổ câu sai", "Câu sai"],
                ["/history", "Tiến độ", "Tiến độ"],
              ].map(([href, label, short]) => (
                <Link key={href} href={href} className="hover:text-fg">
                  <span className="sm:hidden">{short}</span>
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              ))}
            </div>
          </nav>
        </header>
        <ImportBanner />
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
