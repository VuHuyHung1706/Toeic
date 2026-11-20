// Tìm mốc thời gian của từng nhóm câu Part 1–4 trong audio cả đề (để chế độ thi thật tự chuyển câu theo audio).
// Mỗi file audio nhóm câu là một đoạn cắt từ audio cả đề → so khớp "đường bao âm lượng" (100 mẫu/giây)
// của vài giây đầu file nhóm với audio cả đề, tìm lần lượt theo thứ tự câu.
//
//   node scripts/audio_timeline.mjs            # tất cả đề → content/audio-timeline.json
//   node scripts/audio_timeline.mjs 2025-test4 # một đề
//
// Cần Data/ và afconvert (có sẵn trên macOS). Chạy xong thì chạy lại `python3 scripts/etl.py`
// để gắn audioStart/audioEnd vào từng nhóm câu.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.resolve(process.env.TOEIC_DATA_DIR ?? path.join(ROOT, "Data"));
const OUT = path.join(ROOT, "content", "audio-timeline.json");
const RATE = 8000; // Hz khi giải mã
const WIN = 80; // 80 mẫu = 10 ms → đường bao 100 điểm/giây
const PATTERN_SEC = 6; // độ dài đoạn đầu file nhóm dùng để so khớp
const MIN_SCORE = 0.8;
const GOOD = 0.9; // khớp tốt trong cửa sổ tuần tự

const tmp = mkdtempSync(path.join(tmpdir(), "toeic-align-"));
let seq = 0;

function decode(mp3) {
  const wav = path.join(tmp, `${seq++}.wav`);
  execFileSync("afconvert", ["-f", "WAVE", "-d", `LEI16@${RATE}`, "-c", "1", mp3, wav]);
  const b = readFileSync(wav);
  rmSync(wav);
  let p = 12;
  while (p < b.length) {
    const id = b.toString("ascii", p, p + 4);
    const size = b.readUInt32LE(p + 4);
    if (id === "data") return new Int16Array(b.buffer.slice(b.byteOffset + p + 8, b.byteOffset + p + 8 + size));
    p += 8 + size + (size & 1);
  }
  throw new Error(`WAV không có dữ liệu: ${mp3}`);
}

function envelope(s) {
  const n = Math.floor(s.length / WIN);
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let a = 0;
    for (let k = 0; k < WIN; k++) a += Math.abs(s[i * WIN + k]);
    e[i] = a / WIN;
  }
  return e;
}

/** Tương quan chuẩn hoá lớn nhất của pat trong full[from, to) */
function bestMatch(full, pat, from, to) {
  const m = pat.length;
  let pm = 0;
  for (const v of pat) pm += v;
  pm /= m;
  let ps = 0;
  for (const v of pat) ps += (v - pm) ** 2;
  ps = Math.sqrt(ps);
  let bi = -1;
  let bs = -2;
  const end = Math.min(to, full.length - m);
  for (let i = Math.max(0, from); i <= end; i++) {
    let fm = 0;
    for (let k = 0; k < m; k++) fm += full[i + k];
    fm /= m;
    let num = 0;
    let fs = 0;
    for (let k = 0; k < m; k++) {
      const d = full[i + k] - fm;
      num += d * (pat[k] - pm);
      fs += d * d;
    }
    const sc = num / (Math.sqrt(fs) * ps + 1e-9);
    if (sc > bs) {
      bs = sc;
      bi = i;
    }
  }
  return { index: bi, score: bs };
}

function alignTest(testId) {
  const test = JSON.parse(readFileSync(path.join(ROOT, "content", "tests", `${testId}.json`), "utf8"));
  if (!test.fullAudio?.src) return null;
  const fullPath = path.join(DATA, test.fullAudio.src);
  if (!existsSync(fullPath)) return null;
  const full = envelope(decode(fullPath));
  const groups = test.parts.filter((p) => p.part <= 4).flatMap((p) => p.groups);
  const out = { duration: +(full.length / 100).toFixed(2), minScore: 1, groups: {} };
  let cursor = 0; // vị trí (điểm đường bao) kết thúc nhóm trước
  for (const g of groups) {
    if (!g.audio?.src) return { ...out, error: `thiếu audio ${g.id}` };
    const e = envelope(decode(path.join(DATA, g.audio.src)));
    const pat = e.slice(0, Math.min(e.length, PATTERN_SEC * 100));
    // nhóm kế tiếp nằm ngay sau nhóm trước, có thể cách bởi lời hướng dẫn của part mới (≤ ~3 phút);
    // khớp kém (vd file audio của câu bị gán nhầm) → tìm trên cả file
    let m = bestMatch(full, pat, cursor - 1000, cursor + 20000);
    if (m.score < GOOD) m = bestMatch(full, pat, 0, full.length);
    const { index, score } = m;
    out.groups[g.id] = { start: +(index / 100).toFixed(2), end: +((index + e.length) / 100).toFixed(2), score: +score.toFixed(3) };
    out.minScore = Math.min(out.minScore, score);
    if (score >= GOOD) cursor = Math.max(cursor, index + e.length);
  }
  out.minScore = +out.minScore.toFixed(3);
  // Mốc phải tăng dần theo thứ tự câu. Nhóm mâu thuẫn với nhiều nhóm khác (file audio bị gán nhầm trong dữ liệu)
  // hoặc khớp kém → bỏ dần nhóm mâu thuẫn nhất, rồi suy ra vị trí của nó từ khoảng trống giữa hai nhóm kề.
  const ids = Object.keys(out.groups);
  const G = out.groups;
  const bad = new Set(ids.filter((id) => G[id].score < GOOD));
  const conflicts = (id) => {
    const k = ids.indexOf(id);
    let c = 0;
    ids.forEach((other, j) => {
      if (other === id || bad.has(other)) return;
      if ((j < k && G[id].start < G[other].end - 1) || (j > k && G[id].end > G[other].start + 1)) c++;
    });
    return c;
  };
  for (;;) {
    let worst = null;
    let most = 0;
    for (const id of ids) {
      if (bad.has(id)) continue;
      const c = conflicts(id);
      if (c > most) [worst, most] = [id, c];
    }
    if (!worst) break;
    bad.add(worst);
  }
  // các nhóm hỏng liền nhau chia nhau khoảng trống giữa hai nhóm tốt, theo độ dài file audio của từng nhóm
  out.inferred = [];
  for (let k = 0; k < ids.length; k++) {
    if (!bad.has(ids[k])) continue;
    let j = k;
    while (j + 1 < ids.length && bad.has(ids[j + 1])) j++;
    const run = ids.slice(k, j + 1);
    const prev = k > 0 ? ids[k - 1] : null;
    const next = j + 1 < ids.length ? ids[j + 1] : null;
    const from = prev ? G[prev].end + 1 : 0;
    const to = next ? G[next].start - 1 : out.duration;
    const lens = run.map((id) => Math.max(1, G[id].end - G[id].start));
    const scale = Math.max(0, to - from) / lens.reduce((a, b) => a + b, 0);
    let t = from;
    run.forEach((id, r) => {
      const end = r === run.length - 1 ? to : t + lens[r] * scale;
      G[id] = { start: +t.toFixed(2), end: +Math.max(t + 0.5, end).toFixed(2), score: G[id].score, inferred: true };
      t = end;
    });
    out.inferred.push(...run);
    k = j;
  }
  if (bad.size > 5) out.error = `quá nhiều nhóm không khớp (${bad.size})`;
  out.minScore = +Math.min(...ids.filter((id) => !bad.has(id)).map((id) => G[id].score)).toFixed(3);
  return out;
}

const index = JSON.parse(readFileSync(path.join(ROOT, "content", "tests", "index.json"), "utf8"));
const only = process.argv.slice(2);
const result = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
try {
  for (const { id } of index) {
    if (only.length && !only.includes(id)) continue;
    const t0 = Date.now();
    const r = alignTest(id);
    if (!r) {
      console.log(`${id}: bỏ qua (không có audio cả đề)`);
      continue;
    }
    result[id] = r;
    const flag = r.error
      ? `LỖI ${r.error}`
      : r.minScore < MIN_SCORE
        ? "⚠ khớp kém"
        : r.inferred?.length
          ? `ok, suy ra ${r.inferred.join(", ")} (file audio không khớp câu)`
          : "ok";
    console.log(`${id}: ${Object.keys(r.groups).length} nhóm · khớp thấp nhất ${r.minScore} · ${flag} · ${Date.now() - t0} ms`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
writeFileSync(OUT, JSON.stringify(result, null, 1) + "\n");
console.log(`→ ${path.relative(ROOT, OUT)}`);
