// Nút quay lại dạng viên thuốc (icon mũi tên + chữ) — dùng cho mọi chỗ "quay về trang trước / thoát".
// Truyền href để là link, hoặc onClick để là nút.
import Link from "next/link";
import type { ReactNode } from "react";
import UiIcon from "./UiIcon";

export const backLinkClass =
  "inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-fg";

export default function BackLink({
  href,
  onClick,
  children,
  className = "",
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  const body = (
    <>
      <UiIcon name="arrowLeft" className="size-4" />
      <span className="truncate">{children}</span>
    </>
  );
  return href ? (
    <Link href={href} className={`${backLinkClass} ${className}`}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={`${backLinkClass} ${className}`}>
      {body}
    </button>
  );
}
