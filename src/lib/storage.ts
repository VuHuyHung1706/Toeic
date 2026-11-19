"use client";
// Lưu bài làm trong localStorage (giai đoạn chưa có tài khoản/CSDL)
import { useSyncExternalStore } from "react";
import type { Attempt } from "./types";

const ATTEMPTS_KEY = "toeic:attempts";
const MAX_ATTEMPTS = 300;
const listeners = new Set<() => void>();

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

let cacheRaw: string | null | undefined;
let cacheParsed: Attempt[] = [];
const EMPTY: Attempt[] = [];

function readAttempts(): Attempt[] {
  const raw = safeGet(ATTEMPTS_KEY);
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try {
      cacheParsed = raw ? (JSON.parse(raw) as Attempt[]) : [];
    } catch {
      cacheParsed = [];
    }
  }
  return cacheParsed;
}

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === ATTEMPTS_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Danh sách bài làm, mới nhất trước. Trả [] khi render phía server. */
export function useAttempts(): Attempt[] {
  return useSyncExternalStore(subscribe, readAttempts, () => EMPTY);
}

export function saveAttempt(a: Attempt) {
  const list = [a, ...readAttempts().filter((x) => x.id !== a.id)].slice(0, MAX_ATTEMPTS);
  safeSet(ATTEMPTS_KEY, JSON.stringify(list));
  emit();
}

export function deleteAttempt(id: string) {
  safeSet(ATTEMPTS_KEY, JSON.stringify(readAttempts().filter((x) => x.id !== id)));
  emit();
}

// ---- tiến độ bài đang làm (tự lưu để reload không mất) ----
export interface Progress {
  answers: Record<number, string>;
  flagged: number[];
  elapsedSec: number;
  groupIndex: number;
  audioTime?: number;
  startedAt: number;
}

export function progressKey(testId: string, mode: string, parts: number[]) {
  return `toeic:progress:${testId}:${mode}:${parts.join(",")}`;
}
export function loadProgress(key: string): Progress | null {
  const raw = safeGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Progress;
  } catch {
    return null;
  }
}
export function saveProgress(key: string, p: Progress) {
  safeSet(key, JSON.stringify(p));
}
export function clearProgress(key: string) {
  safeSet(key, null);
}
