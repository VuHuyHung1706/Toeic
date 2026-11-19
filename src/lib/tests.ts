// Đọc dữ liệu đề (chỉ dùng phía server)
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheLife } from "next/cache";
import type { TestData, TestSummary } from "./types";

const CONTENT_DIR = path.join(process.cwd(), "content", "tests");
const ID_RE = /^\d{4}-test\d{1,2}$/;

export async function getTestIndex(): Promise<TestSummary[]> {
  "use cache";
  cacheLife("max");
  const raw = await readFile(path.join(CONTENT_DIR, "index.json"), "utf8");
  return JSON.parse(raw) as TestSummary[];
}

export async function getTest(id: string): Promise<TestData | null> {
  "use cache";
  cacheLife("max");
  if (!ID_RE.test(id)) return null;
  try {
    const raw = await readFile(path.join(CONTENT_DIR, `${id}.json`), "utf8");
    return JSON.parse(raw) as TestData;
  } catch {
    return null;
  }
}
