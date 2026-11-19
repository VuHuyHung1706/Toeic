// Đọc dữ liệu đề (chỉ dùng phía server)
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheLife } from "next/cache";
import type { BankItem, BankTag, TestData, TestSummary, VocabEntry } from "./types";

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

// ---- ngân hàng câu theo dạng & từ vựng ----
const BANK_DIR = path.join(process.cwd(), "content", "bank");
const TAG_RE = /^[a-z-]{2,20}$/;

export async function getBankIndex(): Promise<BankTag[]> {
  "use cache";
  cacheLife("max");
  return JSON.parse(await readFile(path.join(BANK_DIR, "index.json"), "utf8")) as BankTag[];
}

export async function getBank(part: string, tag: string): Promise<BankItem[] | null> {
  "use cache";
  cacheLife("max");
  if (!/^[25]$/.test(part) || !TAG_RE.test(tag)) return null;
  try {
    return JSON.parse(await readFile(path.join(BANK_DIR, `p${part}-${tag}.json`), "utf8")) as BankItem[];
  } catch {
    return null;
  }
}

export async function getVocab(): Promise<VocabEntry[]> {
  "use cache";
  cacheLife("max");
  return JSON.parse(await readFile(path.join(process.cwd(), "content", "vocab.json"), "utf8")) as VocabEntry[];
}
