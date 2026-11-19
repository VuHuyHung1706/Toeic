"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const noop = () => () => {};

/** Chỉ render children ở trình duyệt (cần localStorage / audio), tránh lệch hydration. */
export default function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  return mounted ? children : fallback;
}
