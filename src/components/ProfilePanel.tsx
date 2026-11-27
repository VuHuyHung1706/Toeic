"use client";
// Bảng "Trang cá nhân" (mở từ menu tài khoản): tổng quan, hồ sơ (tên, màu ảnh đại diện), thiết bị đang đăng nhập, xoá tài khoản.
// Đổi mật khẩu nằm riêng trong menu (ChangePasswordForm). Gọi API của better-auth qua authClient.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { authClient, useSession } from "@/lib/auth-client";
import { discardAccount, useAttempts, useReviews, useSyncStatus, useVocabCards } from "@/lib/storage";
import Avatar, { AVATAR_COLOR_NAMES, AVATAR_COLORS, avatarColorOf, type AvatarColor } from "./Avatar";
import { ghostBtn, input, Notice, primaryBtn, viError, type Msg } from "./AccountUi";
import ConfirmDialog from "./ConfirmDialog";
import { TextSkeleton } from "./Skeleton";

/** Một mục trong bảng (ngăn cách bằng đường kẻ) */
function Card({ title, desc, children, tone }: { title: string; desc?: string; children: ReactNode; tone?: "danger" }) {
  return (
    <section className="border-t border-line pt-5">
      <h3 className={`font-semibold ${tone === "danger" ? "text-danger" : ""}`}>{title}</h3>
      {desc && <p className="mt-0.5 text-sm text-muted">{desc}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function ProfilePanel({ onClose }: { onClose: () => void }) {
  const { data: session, isPending, refetch } = useSession();
  if (isPending || !session) return <TextSkeleton label="Đang tải trang cá nhân" lines={5} />;
  const { user } = session;

  return (
    <div className="space-y-5">
      <Overview user={user} onNavigate={onClose} />
      <ProfileForm name={user.name} image={user.image ?? null} onSaved={refetch} />
      {/* key theo phiên: đổi mật khẩu cấp phiên mới → danh sách thiết bị tải lại và nhận đúng "Thiết bị này" */}
      <Sessions key={session.session.id} currentToken={session.session.token} />
      <DangerZone email={user.email} onDeleted={onClose} />
    </div>
  );
}

function Overview({
  user,
  onNavigate,
}: {
  user: { name: string; email: string; image?: string | null; createdAt: Date };
  onNavigate: () => void;
}) {
  const attempts = useAttempts();
  const cards = useVocabCards();
  const reviews = useReviews();
  const sync = useSyncStatus();
  const stats = [
    { label: "bài đã làm", value: attempts.length, href: "/history" },
    {
      label: "thẻ từ vựng",
      value: Object.keys(cards).length,
      href: "/vocabulary",
    },
    {
      label: "câu đã ôn",
      value: Object.keys(reviews).length,
      href: "/mistakes",
    },
  ];
  return (
    <section>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={user.name || user.email} image={user.image} className="size-16 text-2xl" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-bold">{user.name}</div>
          <div className="truncate text-sm text-muted">{user.email}</div>
          <div className="mt-1 text-xs text-muted">
            Tham gia từ {new Date(user.createdAt).toLocaleDateString("vi-VN")}
            {sync.state !== "guest" && (
              <>
                {" "}
                · {sync.state === "idle" ? "đã đồng bộ" : sync.state === "syncing" ? "đang đồng bộ…" : "chưa đồng bộ"}
              </>
            )}
          </div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            onClick={onNavigate}
            className="rounded-xl bg-surface-2 px-3 py-2.5 transition hover:bg-line"
          >
            <div className="text-xl font-bold tabular-nums">{s.value.toLocaleString("vi-VN")}</div>
            <div className="text-xs text-muted">{s.label}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ProfileForm({
  name: initialName,
  image,
  onSaved,
}: {
  name: string;
  image: string | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<AvatarColor | null>(avatarColorOf(image));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const changed = name.trim() !== initialName || color !== avatarColorOf(image);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setMsg({ ok: false, text: "Tên không được để trống" });
    setBusy(true);
    setMsg(null);
    const { error } = await authClient.updateUser({
      name: n.slice(0, 60),
      image: color ? `color:${color}` : null,
    });
    setBusy(false);
    if (error)
      return setMsg({
        ok: false,
        text: viError(error, "Chưa lưu được, thử lại sau"),
      });
    setMsg({ ok: true, text: "Đã lưu hồ sơ" });
    onSaved();
  };

  return (
    <Card title="Hồ sơ" desc="Tên và màu ảnh đại diện hiện ở góc phải thanh menu.">
      <form onSubmit={save}>
        <label className="block text-sm">
          Tên hiển thị
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoComplete="name"
            className={input}
          />
        </label>
        <div className="mt-4 text-sm">Màu ảnh đại diện</div>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Màu ảnh đại diện">
          <button
            type="button"
            role="radio"
            aria-checked={color === null}
            aria-label="Mặc định"
            onClick={() => setColor(null)}
            className={`grid size-9 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary ring-offset-2 ring-offset-surface transition ${
              color === null ? "ring-2 ring-primary" : "hover:scale-105"
            }`}
          >
            {(name.trim().charAt(0) || "?").toUpperCase()}
          </button>
          {(Object.keys(AVATAR_COLORS) as AvatarColor[]).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={`Màu ${AVATAR_COLOR_NAMES[c]}`}
              title={AVATAR_COLOR_NAMES[c]}
              onClick={() => setColor(c)}
              className={`size-9 rounded-full bg-linear-to-br ring-offset-2 ring-offset-surface transition ${AVATAR_COLORS[c]} ${
                color === c ? "ring-2 ring-primary" : "hover:scale-105"
              }`}
            />
          ))}
        </div>
        <div className="mt-5 flex items-center gap-2">
          <button type="submit" disabled={busy || !changed} className={primaryBtn}>
            {busy ? "Đang lưu…" : "Lưu hồ sơ"}
          </button>
          {changed && !busy && (
            <button
              type="button"
              onClick={() => {
                setName(initialName);
                setColor(avatarColorOf(image));
                setMsg(null);
              }}
              className={ghostBtn}
            >
              Huỷ
            </button>
          )}
        </div>
        <Notice msg={msg} />
      </form>
    </Card>
  );
}

type SessionRow = {
  id: string;
  token: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  updatedAt: Date;
  createdAt: Date;
};

/** "Chrome · macOS" từ User-Agent */
export function deviceLabel(ua: string | null | undefined): string {
  if (!ua) return "Thiết bị không rõ";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /coc_coc|CocCoc/i.test(ua)
      ? "Cốc Cốc"
      : /OPR\/|Opera/.test(ua)
        ? "Opera"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Trình duyệt";
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} · ${os}` : browser;
}

/** IP nội bộ (máy mình: ::1, 127.x, toàn số 0) thì không hiện */
const publicIp = (ip: string | null | undefined) =>
  !!ip && !/^(::1|::|127\.|0\.0\.0\.0|::ffff:127\.)/.test(ip) && !/^[0:]+$/.test(ip);

function Sessions({ currentToken }: { currentToken: string }) {
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  const load = useCallback(
    () =>
      authClient.listSessions().then(({ data }) => {
        setRows(((data ?? []) as SessionRow[]).sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)));
      }),
    [],
  );
  useEffect(() => {
    let alive = true;
    authClient.listSessions().then(({ data }) => {
      if (alive)
        setRows(((data ?? []) as SessionRow[]).sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)));
    });
    return () => {
      alive = false;
    };
  }, []);

  const revoke = async (token: string) => {
    setBusy(token);
    const { error } = await authClient.revokeSession({ token });
    setBusy(null);
    setMsg(
      error ? { ok: false, text: "Chưa đăng xuất được thiết bị này" } : { ok: true, text: "Đã đăng xuất thiết bị" },
    );
    void load();
  };
  const revokeOthers = async () => {
    setBusy("others");
    const { error } = await authClient.revokeOtherSessions();
    setBusy(null);
    setMsg(
      error
        ? { ok: false, text: "Chưa đăng xuất được các thiết bị khác" }
        : { ok: true, text: "Đã đăng xuất mọi thiết bị khác" },
    );
    void load();
  };

  const others = rows?.filter((r) => r.token !== currentToken).length ?? 0;
  return (
    <Card title="Thiết bị đang đăng nhập" desc="Thấy thiết bị lạ thì đăng xuất nó và đổi mật khẩu.">
      {!rows ? (
        <TextSkeleton label="Đang tải danh sách thiết bị" lines={2} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {rows.map((r) => {
            const current = r.token === currentToken;
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    {deviceLabel(r.userAgent)}
                    {current && (
                      <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
                        Thiết bị này
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted">
                    Hoạt động{" "}
                    {new Date(r.updatedAt).toLocaleString("vi-VN", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                    {publicIp(r.ipAddress) && <> · IP {r.ipAddress}</>}
                  </div>
                </div>
                {!current && (
                  <button
                    type="button"
                    onClick={() => revoke(r.token)}
                    disabled={busy !== null}
                    className={`${ghostBtn} px-3 py-1.5 text-sm`}
                  >
                    {busy === r.token ? "Đang đăng xuất…" : "Đăng xuất"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {others > 1 && (
        <button type="button" onClick={revokeOthers} disabled={busy !== null} className={`${ghostBtn} mt-3 text-sm`}>
          {busy === "others" ? "Đang đăng xuất…" : `Đăng xuất ${others} thiết bị khác`}
        </button>
      )}
      <Notice msg={msg} />
    </Card>
  );
}

function DangerZone({ email, onDeleted }: { email: string; onDeleted: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const remove = async () => {
    if (!password) return setErr("Nhập mật khẩu để xác nhận");
    setBusy(true);
    setErr(null);
    const { error } = await authClient.deleteUser({ password });
    setBusy(false);
    if (error) return setErr(viError(error, "Chưa xoá được tài khoản, thử lại sau"));
    discardAccount();
    setOpen(false);
    onDeleted();
    router.replace("/");
    router.refresh();
  };

  return (
    <Card
      tone="danger"
      title="Xoá tài khoản"
      desc="Xoá vĩnh viễn tài khoản và toàn bộ dữ liệu học đã đồng bộ (bài làm, sổ câu sai, thẻ từ vựng…). Không thể khôi phục."
    >
      <button
        type="button"
        onClick={() => {
          setPassword("");
          setErr(null);
          setOpen(true);
        }}
        className="rounded-xl border border-danger/50 px-4 py-2 font-semibold text-danger transition hover:bg-danger-soft"
      >
        Xoá tài khoản…
      </button>
      <ConfirmDialog
        open={open}
        tone="danger"
        title="Xoá tài khoản?"
        confirmLabel={busy ? "Đang xoá…" : "Xoá vĩnh viễn"}
        cancelLabel="Huỷ"
        onCancel={() => !busy && setOpen(false)}
        onConfirm={remove}
      >
        <p>
          Tài khoản <b>{email}</b> và mọi dữ liệu học trên server sẽ bị xoá vĩnh viễn.
        </p>
        <label className="mt-3 block text-left text-sm">
          Nhập mật khẩu để xác nhận
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void remove()}
            autoComplete="current-password"
            className={input}
          />
        </label>
        {err && (
          <p role="alert" className="mt-2 text-left text-sm text-danger">
            {err}
          </p>
        )}
      </ConfirmDialog>
    </Card>
  );
}
