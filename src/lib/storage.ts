"use client";
// Lưu dữ liệu học trong localStorage (giai đoạn chưa có tài khoản/CSDL)
import { useSyncExternalStore } from "react";
import type { Attempt } from "./types";

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

/** Một giá trị JSON trong localStorage, đọc được bằng hook và đồng bộ giữa các tab. */
function createStore<T>(key: string, empty: T) {
  const listeners = new Set<() => void>();
  let cacheRaw: string | null | undefined;
  let cacheParsed: T = empty;

  const read = (): T => {
    const raw = safeGet(key);
    if (raw !== cacheRaw) {
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
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) cb();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("storage", onStorage);
    };
  };
  const write = (value: T) => {
    safeSet(key, JSON.stringify(value));
    listeners.forEach((l) => l());
  };
  const useValue = () => useSyncExternalStore(subscribe, read, () => empty);
  return { read, write, useValue };
}

// ---- bài làm đã nộp ----
const MAX_ATTEMPTS = 300;
const attemptsStore = createStore<Attempt[]>("toeic:attempts", []);

/** Danh sách bài làm, mới nhất trước. Trả [] khi render phía server. */
export const useAttempts = attemptsStore.useValue;

export function saveAttempt(a: Attempt) {
  attemptsStore.write([a, ...attemptsStore.read().filter((x) => x.id !== a.id)].slice(0, MAX_ATTEMPTS));
}

export function deleteAttempt(id: string) {
  attemptsStore.write(attemptsStore.read().filter((x) => x.id !== id));
}

// ---- kết quả làm lại câu sai: "testId:số câu" → các lần làm lại ----
export interface ReviewEvent {
  at: number;
  ok: boolean;
}
export type ReviewLog = Record<string, ReviewEvent[]>;
const reviewsStore = createStore<ReviewLog>("toeic:reviews", {});
export const useReviews = reviewsStore.useValue;

export function questionKey(testId: string, n: number) {
  return `${testId}:${n}`;
}

export function recordReview(key: string, ok: boolean) {
  const log = reviewsStore.read();
  reviewsStore.write({ ...log, [key]: [...(log[key] ?? []), { at: Date.now(), ok }].slice(-20) });
}

// ---- hoạt động luyện nghe điền từ (để tính vào lịch học) ----
export interface DictationEvent {
  at: number;
  testId: string;
  groupId: string;
  correct: number;
  total: number;
}
const dictationStore = createStore<DictationEvent[]>("toeic:dictation", []);
export const useDictation = dictationStore.useValue;
export function recordDictation(e: DictationEvent) {
  dictationStore.write([e, ...dictationStore.read()].slice(0, 1000));
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
