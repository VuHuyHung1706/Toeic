"use client";
// Tải JSON đề ở phía client (có cache trong bộ nhớ, dùng chung giữa các component)
import { useEffect, useState } from "react";
import type { TestData } from "./types";

const cache = new Map<string, Promise<TestData>>();

export function fetchTest(id: string): Promise<TestData> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(`/api/tests/${encodeURIComponent(id)}`).then((r) => {
      if (!r.ok) throw Object.assign(new Error(`Không tải được đề ${id}`), { status: r.status });
      return r.json() as Promise<TestData>;
    });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

/** Tải nhiều đề; trả về map id → đề (chỉ những đề đã tải xong) */
export function useTests(ids: string[]) {
  const key = [...new Set(ids)].sort().join("|");
  const [state, setState] = useState<{ key: string; tests: Record<string, TestData>; error: string | null }>({
    key: "",
    tests: {},
    error: null,
  });

  useEffect(() => {
    let alive = true;
    const list = key ? key.split("|") : [];
    // đề đã bị gỡ khỏi kho (404) → bỏ qua, các đề khác vẫn hiện; lỗi khác (mạng…) → báo lỗi
    const load = (id: string) =>
      fetchTest(id).catch((e: Error & { status?: number }) => (e.status === 404 ? null : Promise.reject(e)));
    Promise.all(list.map(load)).then(
      (arr) =>
        alive &&
        setState({ key, tests: Object.fromEntries(arr.filter((t) => t !== null).map((t) => [t.id, t])), error: null }),
      (e: Error) => alive && setState({ key, tests: {}, error: e.message }),
    );
    return () => {
      alive = false;
    };
  }, [key]);

  const ready = state.key === key;
  return { tests: ready ? state.tests : {}, loading: !ready, error: ready ? state.error : null };
}
