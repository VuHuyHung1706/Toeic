"use client";
// Dữ liệu học phía trình duyệt.
// - Khách: lưu trong localStorage ("toeic:<tên>") như trước.
// - Đã đăng nhập: lưu ở vùng riêng của tài khoản ("toeic:u:<userId>:<tên>") để giao diện đọc tức thì,
//   mọi thay đổi được xếp hàng và đẩy lên /api/me/sync; khi mở trang/quay lại tab thì kéo dữ liệu mới nhất về.
import { useSyncExternalStore } from "react";
import type { Attempt } from "./types";
import {
  MAX_OPS_PER_REQUEST,
  coalesceOps,
  snapshotCounts,
  snapshotToOps,
  type DictationEvent,
  type Progress,
  type ReviewLog,
  type SyncOp,
  type UserSnapshot,
  type VocabCard,
} from "./sync-types";

export type { DictationEvent, Progress, ReviewEvent, ReviewLog, VocabCard } from "./sync-types";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* hết dung lượng / chế độ riêng tư */
  }
}
function safeKeys(): string[] {
  try {
    return Object.keys(localStorage);
  } catch {
    return [];
  }
}
function readJson<T>(key: string, empty: T): T {
  const raw = safeGet(key);
  if (!raw) return empty;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return empty;
  }
}

// ---------------- tài khoản hiện tại (vùng lưu) ----------------
const ACCOUNT_KEY = "toeic:account";
let account: string | null = typeof window === "undefined" ? null : safeGet(ACCOUNT_KEY);
const nsListeners = new Set<() => void>();

function prefixFor(acc: string | null) {
  return acc ? `toeic:u:${acc}:` : "toeic:";
}
const fullKey = (name: string) => prefixFor(account) + name;

/** Một giá trị JSON trong localStorage (theo vùng của tài khoản hiện tại), đọc bằng hook, đồng bộ giữa các tab. */
function createStore<T>(name: string, empty: T) {
  const listeners = new Set<() => void>();
  let cacheKey: string | undefined;
  let cacheRaw: string | null | undefined;
  let cacheParsed: T = empty;

  const read = (): T => {
    const key = fullKey(name);
    const raw = safeGet(key);
    if (key !== cacheKey || raw !== cacheRaw) {
      cacheKey = key;
      cacheRaw = raw;
      try {
        cacheParsed = raw ? (JSON.parse(raw) as T) : empty;
      } catch {
        cacheParsed = empty;
      }
    }
    return cacheParsed;
  };
  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    nsListeners.add(cb);
    const onStorage = (e: StorageEvent) => {
      if (e.key === fullKey(name)) cb();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(cb);
      nsListeners.delete(cb);
      window.removeEventListener("storage", onStorage);
    };
  };
  const write = (value: T) => {
    safeSet(fullKey(name), JSON.stringify(value));
    listeners.forEach((l) => l());
  };
  /** đọc trực tiếp vùng của một tài khoản bất kỳ (null = khách) */
  const readFor = (acc: string | null): T => readJson(prefixFor(acc) + name, empty);
  const useValue = () => useSyncExternalStore(subscribe, read, () => empty);
  return { read, write, readFor, useValue };
}

// ---- tuỳ chọn hiển thị của người xem (vd chế độ xem bài đọc: Anh / song ngữ / Việt) ----
const prefsStore = createStore<Record<string, string>>("prefs", {});
export function usePref<T extends string>(key: string, fallback: T): T {
  return (prefsStore.useValue()[key] as T | undefined) ?? fallback;
}
export function setPref(key: string, value: string) {
  prefsStore.write({ ...prefsStore.read(), [key]: value });
  enqueue({ t: "pref.put", key, value });
}

// ---- bài làm đã nộp ----
const MAX_ATTEMPTS = 300;
const attemptsStore = createStore<Attempt[]>("attempts", []);

/** Danh sách bài làm, mới nhất trước. Trả [] khi render phía server. */
export const useAttempts = attemptsStore.useValue;

export function saveAttempt(a: Attempt) {
  attemptsStore.write([a, ...attemptsStore.read().filter((x) => x.id !== a.id)].slice(0, MAX_ATTEMPTS));
  enqueue({ t: "attempt.put", a });
}

export function deleteAttempt(id: string) {
  attemptsStore.write(attemptsStore.read().filter((x) => x.id !== id));
  enqueue({ t: "attempt.del", id });
}

// ---- kết quả làm lại câu sai: "testId:số câu" → các lần làm lại ----
const reviewsStore = createStore<ReviewLog>("reviews", {});
export const useReviews = reviewsStore.useValue;

export function questionKey(testId: string, n: number) {
  return `${testId}:${n}`;
}

export function recordReview(key: string, ok: boolean) {
  const at = Date.now();
  const log = reviewsStore.read();
  reviewsStore.write({ ...log, [key]: [...(log[key] ?? []), { at, ok }].slice(-20) });
  enqueue({ t: "review.add", key, at, ok });
}

// ---- hoạt động luyện nghe điền từ (để tính vào lịch học) ----
const dictationStore = createStore<DictationEvent[]>("dictation", []);
export const useDictation = dictationStore.useValue;
export function recordDictation(e: Omit<DictationEvent, "at">) {
  const ev = { ...e, at: Date.now() };
  dictationStore.write([ev, ...dictationStore.read()].slice(0, 1000));
  enqueue({ t: "dictation.add", e: ev });
}

// ---- từ vựng: hộp Leitner cho từng từ + số thẻ ôn mỗi ngày ----
/** Khoảng cách ôn (ngày) theo hộp 1..5 */
export const VOCAB_INTERVALS = [1, 3, 7, 14, 30];
const DAY = 86_400_000;
const vocabStore = createStore<Record<string, VocabCard>>("vocab", {});
export const useVocabCards = vocabStore.useValue;
const vocabLogStore = createStore<Record<string, number>>("vocab-log", {});
export const useVocabLog = vocabLogStore.useValue;

export function dayKey(t: number) {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Ghi kết quả ôn một thẻ. remembered=false → về hộp 1, ôn lại sau 10 phút */
export function reviewVocab(word: string, remembered: boolean) {
  const now = Date.now();
  const cards = vocabStore.read();
  const cur = cards[word] ?? { box: 0, due: now, lastAt: now, reviews: 0, lapses: 0 };
  const box = remembered ? cur.box + 1 : 1;
  const due = remembered ? now + VOCAB_INTERVALS[Math.min(box, VOCAB_INTERVALS.length) - 1] * DAY : now + 10 * 60_000;
  const card = { box, due, lastAt: now, reviews: cur.reviews + 1, lapses: cur.lapses + (remembered ? 0 : 1) };
  vocabStore.write({ ...cards, [word]: card });
  const log = vocabLogStore.read();
  const k = dayKey(now);
  const count = (log[k] ?? 0) + 1;
  vocabLogStore.write({ ...log, [k]: count });
  enqueue({ t: "vocab.put", word, card });
  enqueue({ t: "vocabDay.put", day: k, count });
}

export function resetVocab(word: string) {
  const { [word]: _removed, ...rest } = vocabStore.read();
  void _removed;
  vocabStore.write(rest);
  enqueue({ t: "vocab.del", word });
}

// ---- tiến độ bài đang làm (tự lưu để reload không mất) ----
const PROGRESS = "progress:";

/** Khoá tiến độ của một lượt làm (testId:mode:parts) */
export function progressKey(testId: string, mode: string, parts: number[]) {
  return `${testId}:${mode}:${parts.join(",")}`;
}
export function loadProgress(key: string): Progress | null {
  return readJson<Progress | null>(fullKey(PROGRESS + key), null);
}
export function saveProgress(key: string, p: Progress) {
  safeSet(fullKey(PROGRESS + key), JSON.stringify(p));
  enqueue({ t: "progress.put", key, data: p });
}
export function clearProgress(key: string) {
  safeSet(fullKey(PROGRESS + key), null);
  enqueue({ t: "progress.del", key });
}
function progressFor(acc: string | null): Record<string, Progress> {
  const prefix = prefixFor(acc) + PROGRESS;
  const out: Record<string, Progress> = {};
  for (const k of safeKeys()) {
    if (!k.startsWith(prefix)) continue;
    const p = readJson<Progress | null>(k, null);
    if (p) out[k.slice(prefix.length)] = p;
  }
  return out;
}

/** Toàn bộ dữ liệu trong một vùng lưu (null = khách) */
function localSnapshot(acc: string | null): UserSnapshot {
  return {
    attempts: attemptsStore.readFor(acc),
    reviews: reviewsStore.readFor(acc),
    dictation: dictationStore.readFor(acc),
    vocab: vocabStore.readFor(acc),
    vocabLog: vocabLogStore.readFor(acc),
    prefs: prefsStore.readFor(acc),
    progress: progressFor(acc),
  };
}

/** Thay dữ liệu của tài khoản hiện tại bằng bản từ server */
function applySnapshot(s: UserSnapshot) {
  attemptsStore.write(s.attempts);
  reviewsStore.write(s.reviews);
  dictationStore.write(s.dictation);
  vocabStore.write(s.vocab);
  vocabLogStore.write(s.vocabLog);
  prefsStore.write(s.prefs);
  const prefix = fullKey(PROGRESS);
  for (const k of safeKeys()) if (k.startsWith(prefix) && !(k.slice(prefix.length) in s.progress)) safeSet(k, null);
  for (const [k, p] of Object.entries(s.progress)) safeSet(prefix + k, JSON.stringify(p));
}

// ================= đồng bộ với server =================
const API = "/api/me/sync";
export type SyncState = "guest" | "idle" | "syncing" | "offline" | "error";
interface SyncStatus {
  account: string | null;
  state: SyncState;
  pending: number;
  /** dữ liệu khách trên trình duyệt này chờ người dùng quyết định chuyển vào tài khoản */
  importOffer: ReturnType<typeof snapshotCounts> | null;
}
let status: SyncStatus = { account, state: account ? "idle" : "guest", pending: 0, importOffer: null };
const statusListeners = new Set<() => void>();
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  statusListeners.forEach((l) => l());
}
const GUEST_STATUS: SyncStatus = { account: null, state: "guest", pending: 0, importOffer: null };
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (cb) => {
      statusListeners.add(cb);
      return () => statusListeners.delete(cb);
    },
    () => status,
    () => GUEST_STATUS,
  );
}

// ---- hàng đợi thay đổi (lưu trong localStorage để tắt trình duyệt cũng không mất) ----
const queueKey = (acc: string) => `${prefixFor(acc)}queue`;
let queue: SyncOp[] = account ? readJson<SyncOp[]>(queueKey(account), []) : [];
let timer: ReturnType<typeof setTimeout> | null = null;
let timerAt = 0;
let inFlight: Promise<boolean> | null = null;
let retryDelay = 5_000;

function persistQueue() {
  if (!account) return;
  // đang gửi thì không gộp: phần đã gửi được cắt khỏi đầu hàng đợi theo số lượng
  if (!inFlight) queue = coalesceOps(queue);
  safeSet(queueKey(account), queue.length ? JSON.stringify(queue) : null);
  setStatus({ pending: queue.length });
}

function enqueue(op: SyncOp) {
  if (!account) return;
  queue.push(op);
  persistQueue();
  // tiến độ bài làm đổi mỗi giây → gom 20 s/lần; thay đổi khác gửi sau 1,5 s
  schedule(op.t.startsWith("progress.") ? 20_000 : 1_500);
}

function schedule(delay: number) {
  const at = Date.now() + delay;
  if (timer && timerAt <= at) return;
  if (timer) clearTimeout(timer);
  timerAt = at;
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, delay);
}

async function post(ops: SyncOp[], keepalive = false) {
  const body = JSON.stringify({ ops });
  return fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    credentials: "same-origin",
    keepalive: keepalive && body.length < 60_000,
  });
}

/** Đẩy hàng đợi lên server. Trả true khi hàng đợi đã rỗng. */
export function flush(keepalive = false): Promise<boolean> {
  if (!account) return Promise.resolve(true);
  if (inFlight) return inFlight;
  if (!queue.length) return Promise.resolve(true);
  const acc = account;
  const run = (async () => {
    try {
      while (account === acc && queue.length) {
        const batch = queue.slice(0, MAX_OPS_PER_REQUEST);
        setStatus({ state: "syncing" });
        const res = await post(coalesceOps(batch), keepalive);
        if (res.status === 401) {
          setStatus({ state: "error" }); // phiên hết hạn: giữ hàng đợi, đăng nhập lại sẽ gửi tiếp
          return false;
        }
        if (!res.ok) throw new Error(`sync ${res.status}`);
        if (account !== acc) return false;
        queue = queue.slice(batch.length);
        persistQueue();
      }
      retryDelay = 5_000;
      setStatus({ state: "idle" });
      return true;
    } catch {
      setStatus({ state: navigator.onLine ? "error" : "offline" });
      schedule(retryDelay);
      retryDelay = Math.min(retryDelay * 2, 5 * 60_000);
      return false;
    }
  })();
  // gỡ khoá khi xong — không dùng finally bên trong vì thân hàm async có thể chạy xong trước cả phép gán
  const p: Promise<boolean> = run.finally(() => {
    if (inFlight === p) inFlight = null;
  });
  inFlight = p;
  return p;
}

let lastPull = 0;
/** Gửi hết thay đổi rồi kéo toàn bộ dữ liệu của tài khoản về (server là bản chuẩn). */
export async function pull(): Promise<boolean> {
  const acc = account;
  if (!acc) return false;
  if (!(await flush())) return false;
  try {
    setStatus({ state: "syncing" });
    const res = await fetch(API, { credentials: "same-origin", cache: "no-store" });
    if (!res.ok) throw new Error(`pull ${res.status}`);
    const snap = (await res.json()) as UserSnapshot;
    // người dùng đổi tài khoản hoặc vừa sửa gì trong lúc tải → bỏ bản này, lần sau kéo lại
    if (account !== acc || queue.length) return false;
    applySnapshot(snap);
    lastPull = Date.now();
    nsListeners.forEach((l) => l());
    setStatus({ state: "idle" });
    return true;
  } catch {
    setStatus({ state: navigator.onLine ? "error" : "offline" });
    return false;
  }
}

function checkImportOffer() {
  if (!account || safeGet(`${prefixFor(account)}imported`)) return setStatus({ importOffer: null });
  const counts = snapshotCounts(localSnapshot(null));
  const any = Object.values(counts).some((n) => n > 0);
  setStatus({ importOffer: any ? counts : null });
}

/** Đưa dữ liệu khách trên trình duyệt này vào tài khoản (accept=false: bỏ qua, không hỏi lại). */
export async function resolveImport(accept: boolean): Promise<boolean> {
  const acc = account;
  if (!acc) return false;
  if (accept) {
    const ops = snapshotToOps(localSnapshot(null));
    setStatus({ state: "syncing" });
    try {
      for (let i = 0; i < ops.length; i += 100) {
        const res = await post(ops.slice(i, i + 100));
        if (!res.ok) throw new Error(`import ${res.status}`);
      }
    } catch {
      setStatus({ state: "error" });
      return false;
    }
  }
  safeSet(`${prefixFor(acc)}imported`, String(Date.now()));
  setStatus({ importOffer: null });
  if (accept) await pull();
  return true;
}

/** Gọi khi biết phiên đăng nhập (SyncProvider). null = khách / đã đăng xuất. */
export function setAccount(id: string | null) {
  if (id === account) {
    if (id && Date.now() - lastPull > 60_000) void pull().then(checkImportOffer);
    return;
  }
  account = id;
  safeSet(ACCOUNT_KEY, id);
  queue = id ? readJson<SyncOp[]>(queueKey(id), []) : [];
  lastPull = 0;
  setStatus({ account: id, state: id ? "idle" : "guest", pending: queue.length, importOffer: null });
  nsListeners.forEach((l) => l());
  if (id) void pull().then(checkImportOffer);
}

/** Đăng xuất: gửi nốt thay đổi rồi xoá bản sao dữ liệu của tài khoản khỏi trình duyệt này. */
export async function forgetAccount() {
  const acc = account;
  if (!acc) return;
  await flush();
  const prefix = prefixFor(acc);
  const keep = queue.length ? queueKey(acc) : null; // gửi chưa được thì giữ hàng đợi để lần sau gửi tiếp
  for (const k of safeKeys()) if (k.startsWith(prefix) && k !== keep && !k.endsWith(":imported")) safeSet(k, null);
  setAccount(null);
}

/** Tài khoản vừa bị xoá: bỏ luôn bản sao dữ liệu và hàng đợi chưa gửi (không gửi lên server nữa). */
export function discardAccount() {
  const acc = account;
  if (!acc) return;
  const prefix = prefixFor(acc);
  for (const k of safeKeys()) if (k.startsWith(prefix)) safeSet(k, null);
  queue = [];
  setAccount(null);
}

if (typeof window !== "undefined") {
  // rời trang / ẩn tab → gửi ngay phần còn lại; quay lại tab → kéo dữ liệu mới (vd vừa học trên điện thoại)
  document.addEventListener("visibilitychange", () => {
    if (!account) return;
    if (document.visibilityState === "hidden") void flush(true);
    else if (Date.now() - lastPull > 60_000) void pull();
  });
  window.addEventListener("online", () => {
    if (account) void flush();
  });
  // tab khác đổi tài khoản (đăng nhập/đăng xuất)
  window.addEventListener("storage", (e) => {
    if (e.key === ACCOUNT_KEY && e.newValue !== account) setAccount(e.newValue);
  });
}
