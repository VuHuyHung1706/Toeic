"use client";
// Thẻ gắn sao (từ / cụm khó) — dùng chung cho bộ thẻ ghi nhớ và danh sách từ.
// Chỉ lưu trên trình duyệt này: danh sách có thể dài, không gửi lên server.

import { useMemo, useSyncExternalStore } from "react";

const STAR_KEY = "toeic:fc-stars";
const listeners = new Set<() => void>();

function read(): string {
  try {
    return localStorage.getItem(STAR_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribe(f: () => void) {
  listeners.add(f);
  const onStorage = (e: StorageEvent) => e.key === STAR_KEY && f();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(f);
    window.removeEventListener("storage", onStorage);
  };
}

function parse(raw: string): Set<string> {
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function useStars(): Set<string> {
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  return useMemo(() => parse(raw), [raw]);
}

export function toggleStar(id: string) {
  const next = parse(read());
  if (next.has(id)) next.delete(id);
  else next.add(id);
  try {
    localStorage.setItem(STAR_KEY, JSON.stringify([...next]));
  } catch {
    /* chế độ riêng tư / bị chặn lưu trữ */
  }
  listeners.forEach((f) => f());
}
