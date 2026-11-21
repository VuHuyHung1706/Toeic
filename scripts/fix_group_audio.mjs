// Sửa audio riêng của các nhóm câu nghe mà scripts/audio_timeline.mjs phải suy ra vị trí ("inferred").
// Với mỗi nhóm đó, so khớp CẢ file gốc với audio cả đề:
//   - khớp tốt và không dài quá vị trí của nhóm → file gốc đúng, giữ nguyên;
//   - khớp kém (file của câu khác) hoặc dài quá (lẫn cả nhóm sau) → cắt đúng đoạn từ audio cả đề
//     → Data/<năm>/<testN>/audio/fixed/<id nhóm>.mp3; ETL sẽ dùng file này thay file gốc.
// Cắt theo khung MP3 (không giải mã/mã hoá lại) → giữ nguyên chất lượng, không cần ffmpeg.
//
//   node scripts/fix_group_audio.mjs              # mọi đề có nhóm "inferred"
//   node scripts/fix_group_audio.mjs 2025-test2   # một đề
//
// Chạy sau audio_timeline.mjs; chạy xong thì chạy lại `python3 scripts/etl.py` rồi `npm run media:upload`.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const readdirSafe = (d) => (existsSync(d) ? readdirSync(d) : []);

const ROOT = process.cwd();
const DATA = path.resolve(process.env.TOEIC_DATA_DIR ?? path.join(ROOT, "Data"));
const TIMELINE = JSON.parse(readFileSync(path.join(ROOT, "content", "audio-timeline.json"), "utf8"));
// đề có quá nhiều nhóm lệch → không dùng (đã bỏ khỏi kho đề, xem EXCLUDED trong scripts/etl.py)
const SKIP = new Set(["2025-test7", "2025-test8"]);
const tmp = mkdtempSync(path.join(tmpdir(), "toeic-fix-"));

// ---- MP3: liệt kê khung (vị trí byte, thời lượng) ----
const BITRATES = {
  // [MPEG1, MPEG2/2.5] cho Layer III, kbit/s
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

function mp3Frames(buf) {
  let p = 0;
  if (buf.toString("latin1", 0, 3) === "ID3") {
    const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    p = 10 + size + (buf[5] & 0x10 ? 10 : 0);
  }
  const frames = [];
  let t = 0;
  while (p + 4 <= buf.length) {
    const h = buf.readUInt32BE(p);
    const ver = (h >>> 19) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
    const layer = (h >>> 17) & 3; // 1 = Layer III
    const bri = (h >>> 12) & 15;
    const sri = (h >>> 10) & 3;
    if ((h & 0xffe00000) >>> 0 !== 0xffe00000 || ver === 1 || layer !== 1 || bri === 0 || bri === 15 || sri === 3) {
      p++; // không phải đầu khung (rác/tag) → dò tiếp
      continue;
    }
    const pad = (h >>> 9) & 1;
    const rate = RATES[ver][sri];
    const kbps = BITRATES[ver === 3 ? 1 : 2][bri];
    const samples = ver === 3 ? 1152 : 576;
    const len = Math.floor(((samples / 8) * kbps * 1000) / rate) + pad;
    if (p + len > buf.length) break;
    frames.push({ pos: p, len, t });
    t += samples / rate;
    p += len;
  }
  return frames;
}

// ---- đường bao âm lượng 100 điểm/giây (để đặt ranh giới vào chỗ lặng) ----
function envelope(mp3) {
  const wav = path.join(tmp, "env.wav");
  execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@8000", "-c", "1", mp3, wav]);
  const b = readFileSync(wav);
  rmSync(wav);
  let p = 12;
  let s = null;
  while (p < b.length) {
    const id = b.toString("ascii", p, p + 4);
    const size = b.readUInt32LE(p + 4);
    if (id === "data") {
      s = new Int16Array(b.buffer.slice(b.byteOffset + p + 8, b.byteOffset + p + 8 + size));
      break;
    }
    p += 8 + size + (size & 1);
  }
  const e = new Float32Array(Math.floor(s.length / 80));
  for (let i = 0; i < e.length; i++) {
    let a = 0;
    for (let k = 0; k < 80; k++) a += Math.abs(s[i * 80 + k]);
    e[i] = a / 80;
  }
  return e;
}

/** Giữa đoạn lặng dài nhất trong [from, to] (giây) — dùng làm ranh giới giữa hai nhóm câu liền nhau */
function quietestPoint(env, from, to) {
  const lo = Math.max(0, Math.round(from * 100));
  const hi = Math.min(env.length - 1, Math.round(to * 100));
  const sorted = [...env.slice(lo, hi)].sort((a, b) => a - b);
  const thr = sorted[Math.floor(sorted.length * 0.3)] * 1.5 + 1;
  let best = { len: 0, mid: (from + to) / 2 };
  let run = -1;
  for (let i = lo; i <= hi + 1; i++) {
    const quiet = i <= hi && env[i] <= thr;
    if (quiet && run < 0) run = i;
    if (!quiet && run >= 0) {
      if (i - run > best.len) best = { len: i - run, mid: (run + i) / 200 };
      run = -1;
    }
  }
  return best.mid;
}

/** Đường bao 10 điểm/giây (so khớp cả file cho nhanh) */
function coarse(e) {
  const c = new Float32Array(Math.floor(e.length / 10));
  for (let i = 0; i < c.length; i++) {
    let a = 0;
    for (let k = 0; k < 10; k++) a += e[i * 10 + k];
    c[i] = a / 10;
  }
  return c;
}

/** Vị trí (giây) và độ khớp tốt nhất của cả file pat trong full, chỉ xét điểm bắt đầu trong [from, to] giây */
function wholeMatch(full, pat, from, to) {
  const m = pat.length;
  let pm = 0;
  for (const v of pat) pm += v;
  pm /= m;
  let best = { at: from, score: -2 };
  for (let i = Math.max(0, Math.round(from * 10)); i <= Math.min(full.length - m, Math.round(to * 10)); i++) {
    let fm = 0;
    for (let k = 0; k < m; k++) fm += full[i + k];
    fm /= m;
    let n = 0;
    let a = 0;
    let b = 0;
    for (let k = 0; k < m; k++) {
      const x = full[i + k] - fm;
      const y = pat[k] - pm;
      n += x * y;
      a += x * x;
      b += y * y;
    }
    const sc = n / (Math.sqrt(a * b) + 1e-9);
    if (sc > best.score) best = { at: i / 10, score: sc };
  }
  return best;
}

const GOOD = 0.85; // khớp cả file từ mức này trở lên → đúng là audio của nhóm đó
let made = 0;
let kept = 0;
for (const [testId, tl] of Object.entries(TIMELINE)) {
  if (process.argv[2] && testId !== process.argv[2]) continue;
  if (SKIP.has(testId) || !tl.inferred?.length) continue;
  const test = JSON.parse(readFileSync(path.join(ROOT, "content", "tests", `${testId}.json`), "utf8"));
  const groups = Object.fromEntries(test.parts.flatMap((p) => p.groups).map((g) => [g.id, g]));
  const fullPath = path.join(DATA, test.fullAudio.src);
  const outDir = path.join(DATA, path.dirname(test.fullAudio.src), "fixed");
  const buf = readFileSync(fullPath);
  const frames = mp3Frames(buf);
  const env = envelope(fullPath);
  const full10 = coarse(env);
  const ids = Object.keys(tl.groups);
  const inferred = new Set(tl.inferred);

  // 1) nhóm "inferred" nào có file gốc thật ra đúng → dùng làm mốc như nhóm khớp chắc
  const span = {}; // id → [bắt đầu, kết thúc] (giây) của các nhóm đã chắc chắn
  for (const id of ids) if (!inferred.has(id)) span[id] = [tl.groups[id].start, tl.groups[id].end];
  const verdict = {};
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (!inferred.has(id)) continue;
    const prev = ids.slice(0, i).reverse().find((x) => !inferred.has(x));
    const next = ids.slice(i + 1).find((x) => !inferred.has(x));
    const from = prev ? tl.groups[prev].end : 0;
    const to = next ? tl.groups[next].start : tl.duration;
    const orig = coarse(envelope(path.join(DATA, groups[id].audio.src)));
    const len = orig.length / 10;
    const m = wholeMatch(full10, orig, from - 5, to);
    const fits = m.at + len <= to + 2; // không lấn sang nhóm sau
    verdict[id] = { score: m.score, at: m.at, len, fits };
    if (m.score >= GOOD && fits) span[id] = [m.at, m.at + len];
  }

  // 2) cắt lại các nhóm còn lại từ khoảng trống giữa hai mốc kề
  for (let i = 0; i < ids.length; i++) {
    if (span[ids[i]]) continue;
    const run = [];
    while (i < ids.length && !span[ids[i]]) run.push(ids[i++]);
    const prev = ids[i - run.length - 1];
    const next = ids[i];
    const v0 = verdict[run[0]];
    // file gốc đúng chỗ nhưng dài quá → bắt đầu ở chỗ nó khớp
    let from = prev ? span[prev][1] : 0;
    if (run.length === 1 && v0.score >= GOOD) from = Math.max(from, v0.at);
    const to = next ? span[next][0] : tl.duration;
    const cuts = [from];
    for (let k = 1; k < run.length; k++) {
      const guess = from + ((to - from) * k) / run.length;
      cuts.push(quietestPoint(env, guess - 5, guess + 5));
    }
    cuts.push(to);
    run.forEach((gid, k) => {
      const [a, b] = [cuts[k], cuts[k + 1]];
      const part = frames.filter((f) => f.t >= a && f.t < b);
      mkdirSync(outDir, { recursive: true });
      writeFileSync(path.join(outDir, `${gid}.mp3`), Buffer.concat(part.map((f) => buf.subarray(f.pos, f.pos + f.len))));
      made++;
      const v = verdict[gid];
      const why = v.score < GOOD ? `file gốc khớp kém (${v.score.toFixed(2)})` : `file gốc dài quá (${v.len.toFixed(0)}s)`;
      console.log(`cắt  ${gid.padEnd(20)} ${a.toFixed(2)}s → ${b.toFixed(2)}s (${(b - a).toFixed(1)}s) — ${why}`);
    });
  }
  // file gốc đúng → xoá bản cắt cũ (nếu có) để ETL dùng lại file gốc
  for (const id of tl.inferred) {
    if (!span[id]) continue;
    kept++;
    rmSync(path.join(outDir, `${id}.mp3`), { force: true });
    console.log(`giữ ${id.padEnd(20)} file gốc khớp ${verdict[id].score.toFixed(2)} tại ${verdict[id].at.toFixed(1)}s`);
  }
  if (!readdirSafe(outDir).length) rmSync(outDir, { recursive: true, force: true });
}
rmSync(tmp, { recursive: true, force: true });
console.log(`\nCắt lại ${made} file, giữ nguyên ${kept} file gốc.`);
