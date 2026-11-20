import Link from "next/link";

// Trang 404 (đường dẫn sai, mã đề / dạng câu không tồn tại)
export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-20 text-center">
      <p className="text-6xl font-bold text-primary">404</p>
      <h1 className="mt-4 text-2xl font-bold">Không tìm thấy trang</h1>
      <p className="mt-2 text-muted">Đường dẫn không đúng, hoặc đề / dạng câu này không có trong kho.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/tests" className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-on-primary">
          Vào kho đề
        </Link>
        <Link href="/" className="rounded-lg border border-line px-5 py-2.5 font-semibold hover:bg-surface-2">
          Về trang chủ
        </Link>
      </div>
    </main>
  );
}
