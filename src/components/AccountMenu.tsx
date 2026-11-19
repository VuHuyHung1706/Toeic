"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "@/lib/auth-client";
import { forgetAccount, resolveImport, setAccount, useSyncStatus, type SyncState } from "@/lib/storage";

const STATE_LABEL: Record<SyncState, string> = {
  guest: "",
  idle: "Đã đồng bộ",
  syncing: "Đang đồng bộ…",
  offline: "Mất mạng — sẽ gửi khi có mạng",
  error: "Chưa đồng bộ được",
};
const STATE_DOT: Record<SyncState, string> = {
  guest: "",
  idle: "bg-success",
  syncing: "bg-warn animate-pulse",
  offline: "bg-muted",
  error: "bg-danger",
};

/** Nút đăng nhập / ảnh đại diện trên thanh menu; đồng thời báo phiên đăng nhập cho tầng lưu trữ. */
export default function AccountMenu() {
  const { data: session, isPending, error } = useSession();
  const sync = useSyncStatus();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const userId = session?.user.id ?? null;

  // lỗi mạng khi hỏi phiên → giữ nguyên (không coi là đăng xuất)
  useEffect(() => {
    if (!isPending && !error) setAccount(userId);
  }, [isPending, error, userId]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (isPending) return <div className="size-8 shrink-0 animate-pulse rounded-full bg-surface-2" aria-hidden />;

  if (!session) {
    const next = pathname && pathname !== "/login" ? `?next=${encodeURIComponent(pathname)}` : "";
    return (
      <Link
        href={`/login${next}`}
        className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-surface-2"
      >
        Đăng nhập
      </Link>
    );
  }

  const { user } = session;
  const initial = (user.name || user.email).trim().charAt(0).toUpperCase();
  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Tài khoản"
        title={STATE_LABEL[sync.state]}
        className="relative flex size-8 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-sm font-bold text-primary"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- ảnh đại diện (nếu có), không cần tối ưu
          <img src={user.image} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
        ) : (
          initial
        )}
      </button>
      {sync.state !== "guest" && (
        <span className={`pointer-events-none absolute right-0 bottom-0 size-2.5 rounded-full ring-2 ring-surface ${STATE_DOT[sync.state]}`} />
      )}
      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-line bg-surface p-3 text-sm shadow-lg">
          <p className="truncate font-semibold">{user.name}</p>
          <p className="truncate text-muted">{user.email}</p>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted">
            <span className={`size-2 rounded-full ${STATE_DOT[sync.state]}`} />
            {STATE_LABEL[sync.state]}
            {sync.pending > 0 && ` · ${sync.pending} thay đổi chờ gửi`}
          </p>
          <button
            type="button"
            onClick={async () => {
              setOpen(false);
              await forgetAccount();
              await signOut();
            }}
            className="mt-3 w-full rounded-lg border border-line px-3 py-1.5 text-left hover:bg-surface-2"
          >
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

/** Hỏi một lần sau khi đăng nhập: chuyển dữ liệu học của khách trên trình duyệt này vào tài khoản? */
export function ImportBanner() {
  const { importOffer } = useSyncStatus();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!importOffer) return null;
  const parts = [
    importOffer.attempts && `${importOffer.attempts} bài làm`,
    importOffer.reviews && `${importOffer.reviews} lần ôn câu sai`,
    importOffer.vocab && `${importOffer.vocab} thẻ từ vựng`,
    importOffer.dictation && `${importOffer.dictation} lần luyện nghe`,
    importOffer.progress && `${importOffer.progress} bài đang làm dở`,
  ].filter(Boolean);

  const act = async (accept: boolean) => {
    setBusy(true);
    setFailed(false);
    const ok = await resolveImport(accept);
    setBusy(false);
    if (!ok) setFailed(true);
  };

  return (
    <div className="border-b border-line bg-primary-soft">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-sm">
        <p className="min-w-0 flex-1">
          Trình duyệt này có dữ liệu học khi chưa đăng nhập ({parts.join(", ")}). Chuyển vào tài khoản để học tiếp trên
          mọi thiết bị?
          {failed && <span className="ml-2 text-danger">Chưa chuyển được, thử lại sau.</span>}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => act(true)}
            className="rounded-lg bg-primary px-3 py-1.5 font-semibold text-on-primary disabled:opacity-60"
          >
            {busy ? "Đang chuyển…" : "Chuyển vào tài khoản"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => act(false)}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 hover:bg-surface-2 disabled:opacity-60"
          >
            Bỏ qua
          </button>
        </div>
      </div>
    </div>
  );
}

/** Dòng ghi chú "dữ liệu đang lưu ở đâu" */
export function StorageNote() {
  const { state } = useSyncStatus();
  return (
    <p className="mt-2 text-sm text-muted">
      {state === "guest" ? (
        <>
          Dữ liệu đang được lưu trên trình duyệt này.{" "}
          <Link href="/login?next=/history" className="text-primary hover:underline">
            Đăng nhập
          </Link>{" "}
          để lưu vào tài khoản.
        </>
      ) : (
        "Dữ liệu được đồng bộ với tài khoản của bạn."
      )}
    </p>
  );
}
