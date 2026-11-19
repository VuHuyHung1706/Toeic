import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const font = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "ToeicLab — Luyện thi TOEIC", template: "%s | ToeicLab" },
  description: "Luyện đề TOEIC Listening & Reading: thi thử 200 câu, luyện từng part, giải thích tiếng Việt.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${font.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
          <nav className="mx-auto flex h-14 max-w-6xl items-center gap-5 px-4">
            <Link href="/" className="shrink-0 text-lg font-bold tracking-tight">
              Toeic<span className="text-primary">Lab</span>
            </Link>
            <div className="flex min-w-0 items-center gap-4 overflow-x-auto text-sm whitespace-nowrap text-muted">
              {[
                ["/tests", "Đề thi"],
                ["/listening", "Luyện nghe"],
                ["/mistakes", "Sổ câu sai"],
                ["/history", "Tiến độ"],
              ].map(([href, label]) => (
                <Link key={href} href={href} className="hover:text-fg">
                  {label}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
