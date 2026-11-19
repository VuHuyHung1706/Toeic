#!/usr/bin/env python3
"""ETL cho dữ liệu đề TOEIC.

Đọc   Data/<năm>/<testN>/{csv,audio,image}
Ghi   content/tests/<năm>-<testN>.json   (mỗi đề 1 file, đã chuẩn hoá)
      content/tests/index.json           (danh sách đề + trạng thái dữ liệu)
      content/etl-report.md              (báo cáo lỗi / cảnh báo)
      content/bank/*.json                (câu Part 2/5 theo dạng — xem scripts/enrich.py)
      content/vocab.json                 (từ vựng trích từ phần giải thích)

Chỉ dùng thư viện chuẩn của Python 3.9+.

    python3 scripts/etl.py                       # mặc định
    python3 scripts/etl.py --only 2025/test1     # chạy 1 đề
    python3 scripts/etl.py --strict              # exit 1 nếu còn lỗi
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import unquote, urlparse

from enrich import tag_question, write_extras

# ---------------------------------------------------------------------------
# Hằng số định dạng đề TOEIC
# ---------------------------------------------------------------------------
PART_RANGES = {
    1: range(1, 7),
    2: range(7, 32),
    3: range(32, 71),
    4: range(71, 101),
    5: range(101, 131),
    6: range(131, 147),
    7: range(147, 201),
}
PART_OPTIONS = {1: "ABCD", 2: "ABC", 3: "ABCD", 4: "ABCD", 5: "ABCD", 6: "ABCD", 7: "ABCD"}
GROUPED_PARTS = {3, 4, 6, 7}
LISTENING_PARTS = {1, 2, 3, 4}
EXPECTED_GROUP_SIZE = {3: 3, 4: 3, 6: 4}  # Part 7 có nhóm 2–5 câu

HEADER_ALIASES = {
    "question number": "number",
    "part number": "part",
    "audio": "audio",
    "image": "image",
    "text": "text",
    "question": "question",
    "a": "A",
    "b": "B",
    "c": "C",
    "d": "D",
    "answer": "answer",
    "explain": "explain",
    "explanation": "explain",
    "transcript": "transcript",
}

URL_RE = re.compile(r"https?://\S+?\.(?:mp3|jpe?g|png|gif|webp)", re.I)
PLACEHOLDER_IMAGE_RE = re.compile(r"^image\s*\d+$", re.I)
# Một số đề ghi "Hình ảnh 1"/"Image 2" vào cột Text ở câu "Look at the graphic"
PLACEHOLDER_TEXT_RE = re.compile(r"^(image|hình ảnh)\s*\d+$", re.I)


def fixed_group_start(part: int, n: int) -> int | None:
    """Số câu đầu nhóm nếu nhóm có ranh giới cố định theo format TOEIC, ngược lại None."""
    if part == 3 and 32 <= n <= 70:
        return 32 + (n - 32) // 3 * 3
    if part == 4 and 71 <= n <= 100:
        return 71 + (n - 71) // 3 * 3
    if part == 6 and 131 <= n <= 146:
        return 131 + (n - 131) // 4 * 4
    if part == 7 and 176 <= n <= 200:
        return 176 + (n - 176) // 5 * 5
    return None


# ---------------------------------------------------------------------------
# Báo cáo
# ---------------------------------------------------------------------------
@dataclass
class Issue:
    level: str  # "error" | "warn" | "fixed"
    test: str
    where: str
    msg: str


@dataclass
class Report:
    issues: list[Issue] = field(default_factory=list)

    def add(self, level: str, test: str, where: str, msg: str) -> None:
        self.issues.append(Issue(level, test, where, msg))

    def count(self, test: str | None = None) -> Counter:
        return Counter(i.level for i in self.issues if test is None or i.test == test)


# ---------------------------------------------------------------------------
# Tiện ích chuẩn hoá
# ---------------------------------------------------------------------------
def clean_text(v: str | None) -> str:
    if not v:
        return ""
    v = v.replace("\r\n", "\n").replace("\r", "\n")
    v = v.replace("\\n", "\n")  # CSV lưu xuống dòng dạng literal "\n"
    lines = [ln.rstrip() for ln in v.split("\n")]
    return "\n".join(lines).strip()


def drop_dash(v: str) -> str:
    """Một số đề điền '-' vào ô trống (vd Transcript Part 7 năm 2023–2024)."""
    return "" if re.fullmatch(r"[-–—.\s]*", v) else v


def parse_number(v: str) -> int | None:
    v = (v or "").strip()
    if not v:
        return None
    try:
        return int(float(v))
    except ValueError:
        m = re.search(r"\d+", v)
        return int(m.group()) if m else None


def parse_answer(v: str) -> tuple[str | None, bool]:
    """Trả về (đáp án, có_phải_sửa_không)."""
    raw = (v or "").strip()
    if raw in ("A", "B", "C", "D"):
        return raw, False
    m = re.fullmatch(r"\(?\s*([ABCD])\s*\)?\.?", raw, re.I)
    if m:
        return m.group(1).upper(), True
    return None, False


# ---------------------------------------------------------------------------
# Đọc CSV bền vững
# ---------------------------------------------------------------------------
def read_part_csv(path: Path, part: int, test_id: str, report: Report) -> list[dict]:
    where = path.name
    text = path.read_text(encoding="utf-8-sig")
    rows = list(csv.reader(io.StringIO(text), delimiter=";"))
    if not rows:
        report.add("error", test_id, where, "File CSV rỗng")
        return []

    raw_header = [c.strip() for c in rows[0]]
    header: list[str | None] = [HEADER_ALIASES.get(c.lower()) if c else None for c in raw_header]
    unknown = [c for c, h in zip(raw_header, header) if c and h is None]
    if unknown:
        report.add("warn", test_id, where, f"Bỏ qua cột không nhận diện được: {unknown}")
    named_idx = [i for i, h in enumerate(header) if h]
    if "number" not in header:
        report.add("error", test_id, where, f"Không có cột 'Question Number' (header={raw_header})")
        return []
    last_named = named_idx[-1]
    has_transcript = "transcript" in header

    records = []
    for line_no, row in enumerate(rows[1:], start=2):
        if not any(c.strip() for c in row):
            continue
        cells = list(row)
        while len(cells) > len(header) and not cells[-1].strip():
            cells.pop()
        rec = {h: cells[i] if i < len(cells) else "" for i, h in enumerate(header) if h}

        extra = cells[last_named + 1 :]
        extra = [c for c in extra if c.strip()]
        if extra:
            if part in GROUPED_PARTS and not has_transcript and len(extra) == 1:
                rec["transcript"] = extra[0]
                report.add("fixed", test_id, f"{where}:{line_no}", "Header thiếu cột Transcript — gán cột thừa làm Transcript")
            else:
                col = header[last_named]
                rec[col] = ";".join([rec.get(col, "")] + extra)
                report.add("fixed", test_id, f"{where}:{line_no}",
                           f"Dòng thừa {len(extra)} ô (dấu ';' trong nội dung) — nối lại vào cột '{col}'")
        rec["_line"] = line_no
        records.append(rec)
    return records


# ---------------------------------------------------------------------------
# Giải quyết đường dẫn media
# ---------------------------------------------------------------------------
class MediaResolver:
    def __init__(self, data_root: Path, test_dir: Path, test_slug: str, test_id: str, report: Report):
        self.data_root = data_root
        self.test_dir = test_dir
        self.slug = test_slug  # "test1"
        self.test_id = test_id
        self.report = report
        self.files = {
            "audio": {p.name.lower(): p for p in (test_dir / "audio").glob("*") if p.is_file()},
            "image": {p.name.lower(): p for p in (test_dir / "image").glob("*") if p.is_file()},
        }
        self.used: set[Path] = set()

    def _find_local(self, kind: str, name: str) -> Path | None:
        name = unquote(name).strip().lower()
        files = self.files[kind]
        if name in files:
            return files[name]
        stem, _, ext = name.rpartition(".")
        alts = {"jpg": ["png", "jpeg"], "png": ["jpg", "jpeg"], "jpeg": ["jpg", "png"]}.get(ext, [])
        for e in alts:
            if f"{stem}.{e}" in files:
                return files[f"{stem}.{e}"]
        # 2026: test1-audio-01.mp3 ↔ test1-audio-1.mp3
        unpadded = re.sub(r"-0+(\d)", r"-\1", name)
        if unpadded != name and unpadded in files:
            return files[unpadded]
        return None

    def _conventional(self, kind: str, part: int, numbers: list[int]) -> Path | None:
        s = self.slug
        cands: list[str] = []
        if kind == "audio":
            if len(numbers) > 1:
                a, b = numbers[0], numbers[-1]
                cands += [f"{s}-audio-{a}-{b}.mp3", f"{s}_question_{a}_{b}.mp3"]
            else:
                n = numbers[0]
                cands += [f"{s}-audio-{n}.mp3", f"{s}_question_{n}.mp3"]
        else:
            for n in numbers:
                if part == 1:
                    cands.append(f"{s}-image-{n}.jpg")
                cands.append(f"{s}-p{part}-image-{n}.jpg")
        for c in cands:
            p = self._find_local(kind, c)
            if p:
                return p
        return None

    def _rel(self, p: Path) -> str:
        self.used.add(p)
        return p.relative_to(self.data_root).as_posix()

    def resolve(self, kind: str, raw: str, part: int, numbers: list[int], where: str) -> dict | None:
        """raw: giá trị trong ô CSV (có thể rỗng / tên file / URL / 'Image 1')."""
        raw = (raw or "").strip()
        remote = None
        if raw:
            if raw.lower().startswith("http"):
                remote = raw
                name = os.path.basename(urlparse(raw).path)
            elif PLACEHOLDER_IMAGE_RE.match(raw):
                name = ""
            else:
                name = raw
            if name:
                p = self._find_local(kind, name)
                if p:
                    if remote:
                        self.report.add("fixed", self.test_id, where, f"URL {kind} → file local {p.name}")
                    return {"src": self._rel(p), "remoteUrl": remote}
        # Không tìm theo tên → thử theo quy ước đặt tên
        p = self._conventional(kind, part, numbers)
        if p:
            if raw:
                self.report.add("fixed", self.test_id, where, f"'{raw[:60]}' không có file → dùng {p.name} theo quy ước")
            return {"src": self._rel(p), "remoteUrl": remote}
        if raw:
            self.report.add("warn" if remote else "error", self.test_id, where,
                            f"Thiếu file {kind}: '{raw[:120]}'" + (" (chỉ có URL ngoài)" if remote else ""))
            return {"src": None, "remoteUrl": remote}
        return None

    def unused(self) -> list[str]:
        out = []
        for kind, files in self.files.items():
            for p in files.values():
                if p not in self.used and not p.name.startswith("."):
                    out.append(f"{kind}/{p.name}")
        return sorted(out)


# ---------------------------------------------------------------------------
# Xử lý 1 đề
# ---------------------------------------------------------------------------
def build_test(data_root: Path, test_dir: Path, report: Report) -> dict:
    year = test_dir.parent.name
    slug = test_dir.name  # "test1"
    num = int(re.sub(r"\D", "", slug) or 0)
    test_id = f"{year}-{slug}"
    media = MediaResolver(data_root, test_dir, slug, test_id, report)

    full_audio = media._find_local("audio", f"{year}-{slug}.mp3")
    if full_audio:
        full_audio_ref = {"src": media._rel(full_audio)}
    else:
        full_audio_ref = None
        report.add("error", test_id, "audio", f"Thiếu audio full đề {year}-{slug}.mp3")

    parts_out = []
    seen_numbers: dict[int, str] = {}
    for part in range(1, 8):
        csv_path = test_dir / "csv" / f"{slug}-part{part}.csv"
        if not csv_path.exists():
            report.add("error", test_id, csv_path.name, "Thiếu file CSV")
            parts_out.append({"part": part, "groups": []})
            continue
        records = read_part_csv(csv_path, part, test_id, report)

        # --- chuẩn hoá từng dòng thành câu hỏi
        rows = []
        for rec in records:
            where = f"{csv_path.name}:{rec['_line']}"
            n = parse_number(rec.get("number", ""))
            if n is None:
                report.add("error", test_id, where, "Dòng có dữ liệu nhưng không có số câu — bỏ qua")
                continue
            if n not in PART_RANGES[part]:
                report.add("error", test_id, where, f"Câu {n} nằm ngoài phạm vi Part {part}")
            if n in seen_numbers:
                prev_where, prev_key = seen_numbers[n]
                same = prev_key == (clean_text(rec.get("question", "")), (rec.get("answer") or "").strip())
                report.add("fixed" if same else "error", test_id, where,
                           f"Trùng số câu {n} (đã có ở {prev_where})"
                           + (" — cùng câu hỏi & đáp án, bỏ dòng lặp" if same else " — nội dung KHÁC, đang giữ dòng đầu"))
                continue
            seen_numbers[n] = (where, (clean_text(rec.get("question", "")), (rec.get("answer") or "").strip()))

            ans, fixed = parse_answer(rec.get("answer", ""))
            if fixed:
                report.add("fixed", test_id, where, f"Đáp án '{rec.get('answer')}' → '{ans}'")
            if ans is None:
                report.add("error", test_id, where, f"Câu {n}: đáp án không hợp lệ '{rec.get('answer', '')[:30]}'")

            letters = PART_OPTIONS[part]
            options = {L: clean_text(rec.get(L, "")) for L in letters}
            if part == 2 and clean_text(rec.get("D", "")):
                report.add("warn", test_id, where, f"Câu {n}: Part 2 có đáp án D — bỏ qua")
            if ans and ans not in letters:
                report.add("error", test_id, where, f"Câu {n}: đáp án {ans} không thuộc {letters}")
            empty = [L for L, t in options.items() if not t]
            # Part 1–2: đáp án nằm trong audio, ô trống là bình thường với một số đề
            if empty and part not in (1, 2):
                report.add("warn", test_id, where, f"Câu {n}: thiếu nội dung đáp án {''.join(empty)}")
            explain = clean_text(rec.get("explain", ""))
            if not explain:
                report.add("warn", test_id, where, f"Câu {n}: thiếu giải thích")

            rows.append({
                "number": n,
                "where": where,
                "question": clean_text(rec.get("question", "")),
                "options": options,
                "answer": ans,
                "explanation": explain,
                "text": drop_dash(clean_text(rec.get("text", ""))),
                "transcript": drop_dash(clean_text(rec.get("transcript", ""))),
                "audio": (rec.get("audio") or "").strip(),
                "image": (rec.get("image") or "").strip(),
            })
        rows.sort(key=lambda r: r["number"])

        # --- gom nhóm
        # Part 3/4/6 và Part 7 (176–200) có ranh giới nhóm cố định theo format đề;
        # chỉ Part 7 câu 147–175 phải dò ranh giới từ dữ liệu.
        groups_rows: list[list[dict]] = []
        for r in rows:
            fixed = fixed_group_start(part, r["number"])
            if fixed is not None:
                if groups_rows and fixed_group_start(part, groups_rows[-1][0]["number"]) == fixed:
                    groups_rows[-1].append(r)
                else:
                    groups_rows.append([r])
                continue
            if part not in GROUPED_PARTS:
                groups_rows.append([r])
                continue
            # Part 7 câu đơn: nhóm mới khi có đoạn văn / bản dịch / ảnh mới
            cur = groups_rows[-1] if groups_rows and groups_rows[-1][0]["number"] < 176 else None
            img = "" if PLACEHOLDER_IMAGE_RE.match(r["image"]) else r["image"]
            new_group = (
                cur is None
                or (r["text"] and not PLACEHOLDER_TEXT_RE.match(r["text"]))
                # bản dịch lặp lại y hệt của câu trước trong nhóm thì không phải nhóm mới
                or (r["transcript"] and r["transcript"] not in {x["transcript"] for x in cur})
                or (img and img not in {x["image"] for x in cur})
            )
            if new_group:
                groups_rows.append([r])
            else:
                cur.append(r)

        # --- dựng group + media
        groups = []
        for gi, g in enumerate(groups_rows, start=1):
            numbers = [r["number"] for r in g]
            gwhere = f"{csv_path.name} câu {numbers[0]}" + (f"–{numbers[-1]}" if len(numbers) > 1 else "")
            exp = EXPECTED_GROUP_SIZE.get(part)
            if exp and len(g) != exp:
                report.add("warn", test_id, gwhere, f"Nhóm có {len(g)} câu (thường là {exp})")
            if part == 7 and not 2 <= len(g) <= 5:
                report.add("warn", test_id, gwhere, f"Nhóm Part 7 có {len(g)} câu (thường 2–5)")
            if numbers != list(range(numbers[0], numbers[-1] + 1)):
                report.add("warn", test_id, gwhere, f"Số câu trong nhóm không liên tục: {numbers}")

            audio = None
            if part in LISTENING_PARTS:
                raw_audio = next((r["audio"] for r in g if r["audio"]), "")
                audio = media.resolve("audio", raw_audio, part, numbers, gwhere)
                if audio is None:
                    report.add("warn", test_id, gwhere, "Không có audio riêng cho câu/nhóm này")

            images: list[dict] = []
            seen_raw: set[str] = set()
            has_placeholder = False
            for r in g:
                for raw in re.split(r"\s*[|\n]\s*", r["image"]) if r["image"] else []:
                    if not raw or raw in seen_raw:
                        continue
                    seen_raw.add(raw)
                    if PLACEHOLDER_IMAGE_RE.match(raw):
                        has_placeholder = True
                        continue
                    ref = media.resolve("image", raw, part, numbers, gwhere)
                    if ref and (ref["src"] is None or ref["src"] not in {i["src"] for i in images}):
                        images.append(ref)
            if not any(i.get("src") for i in images) and (part == 1 or has_placeholder):
                ref = media.resolve("image", "", part, numbers, gwhere)
                if ref:
                    images.append(ref)
                elif not images:  # có URL ngoài thì đã được cảnh báo ở resolve()
                    report.add("error", test_id, gwhere, "Thiếu ảnh" + (" (ô Image chỉ ghi placeholder)" if has_placeholder else ""))

            group = {
                "id": f"{test_id}-p{part}-g{gi}",
                "part": part,
                "questionNumbers": numbers,
                "audio": audio,
                "images": images,
                "passages": [],
                "questions": [],
            }
            if part in GROUPED_PARTS:
                # Đoạn văn kép/ba (Part 7) có thể nằm rải ở nhiều dòng trong nhóm
                for r in g:
                    en = "" if PLACEHOLDER_TEXT_RE.match(r["text"]) else r["text"]
                    vi = r["transcript"]
                    if vi and any(p["vi"] == vi for p in group["passages"]):
                        vi = ""  # bản dịch bị chép lặp ở nhiều câu
                    if en or vi:
                        group["passages"].append({"en": en, "vi": vi})
                if not any(p["en"] for p in group["passages"]) and not images:
                    report.add("warn", test_id, gwhere, "Nhóm không có đoạn văn/script và cũng không có ảnh")
            for r in g:
                q = {
                    "number": r["number"],
                    "part": part,
                    "question": r["question"],
                    "options": r["options"],
                    "answer": r["answer"],
                    "explanation": r["explanation"],
                }
                q["tags"] = tag_question(q)
                if part not in GROUPED_PARTS and r["transcript"]:
                    q["transcript"] = r["transcript"]
                group["questions"].append(q)
            groups.append(group)

        # --- kiểm tra số lượng câu
        got = {r["number"] for r in rows}
        missing = sorted(set(PART_RANGES[part]) - got)
        if missing:
            report.add("error", test_id, csv_path.name, f"Thiếu câu: {missing}")
        parts_out.append({"part": part, "groups": groups})

    total = sum(len(g["questions"]) for p in parts_out for g in p["groups"])
    if total != 200:
        report.add("error", test_id, "test", f"Tổng số câu = {total} (cần 200)")

    listening_groups = [g for p in parts_out if p["part"] in LISTENING_PARTS for g in p["groups"]]
    audio_missing = sum(1 for g in listening_groups if not (g["audio"] and g["audio"].get("src")))
    image_missing = sum(1 for p in parts_out for g in p["groups"] for i in g["images"] if not i.get("src"))

    for u in media.unused():
        if not u.endswith(f"{year}-{slug}.mp3"):
            report.add("warn", test_id, "media", f"File không được câu nào dùng: {u}")

    return {
        "id": test_id,
        "year": int(year) if year.isdigit() else year,
        "collection": year,
        "number": num,
        "title": f"{year} – Test {num}",
        "durationMinutes": 120,
        "questionCount": total,
        "fullAudio": full_audio_ref,
        "availability": {
            "fullTest": full_audio_ref is not None and total == 200,
            "practiceListening": audio_missing == 0,
            "listeningGroupsMissingAudio": audio_missing,
            "imagesMissing": image_missing,
        },
        "parts": parts_out,
    }


# ---------------------------------------------------------------------------
# Báo cáo markdown
# ---------------------------------------------------------------------------
def write_report(path: Path, tests: list[dict], report: Report) -> None:
    lines = ["# Báo cáo ETL dữ liệu TOEIC", ""]
    total = report.count()
    lines += [
        f"- Số đề: **{len(tests)}**",
        f"- Lỗi (cần sửa tay): **{total['error']}**",
        f"- Cảnh báo: **{total['warn']}**",
        f"- Đã tự sửa: **{total['fixed']}**",
        "",
        "## Tổng quan theo đề",
        "",
        "| Đề | Câu | Audio full | Nhóm nghe thiếu audio | Ảnh thiếu | Lỗi | Cảnh báo | Tự sửa |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for t in tests:
        c = report.count(t["id"])
        a = t["availability"]
        lines.append(
            f"| {t['id']} | {t['questionCount']} | {'✅' if t['fullAudio'] else '❌'} | "
            f"{a['listeningGroupsMissingAudio']} | {a['imagesMissing']} | {c['error']} | {c['warn']} | {c['fixed']} |"
        )

    for level, title in (("error", "Lỗi cần sửa tay"), ("warn", "Cảnh báo"), ("fixed", "Đã tự sửa")):
        items = [i for i in report.issues if i.level == level]
        lines += ["", f"## {title} ({len(items)})", ""]
        if level == "fixed":
            summary = Counter(re.sub(r"'[^']*'|\d+", "…", i.msg) for i in items)
            lines += ["| Loại sửa | Số lần |", "|---|---|"]
            lines += [f"| {k} | {v} |" for k, v in summary.most_common()]
            continue
        by_test = defaultdict(list)
        for i in items:
            by_test[i.test].append(i)
        for tid in sorted(by_test):
            lines += [f"<details><summary><b>{tid}</b> — {len(by_test[tid])}</summary>", ""]
            lines += [f"- `{i.where}` {i.msg}" for i in by_test[tid]]
            lines += ["", "</details>"]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


# ---------------------------------------------------------------------------
def main() -> int:
    root = Path(__file__).resolve().parent.parent
    ap = argparse.ArgumentParser(description="ETL dữ liệu đề TOEIC → JSON")
    ap.add_argument("--data", type=Path, default=root / "Data")
    ap.add_argument("--out", type=Path, default=root / "content")
    ap.add_argument("--only", action="append", help="Chỉ chạy đề, vd 2025/test1 (lặp lại được)")
    ap.add_argument("--strict", action="store_true", help="Exit 1 nếu còn lỗi")
    args = ap.parse_args()

    data_root: Path = args.data.resolve()
    test_dirs = sorted(
        (p for p in data_root.glob("*/test*") if p.is_dir() and (p / "csv").is_dir()),
        key=lambda p: (p.parent.name, int(re.sub(r"\D", "", p.name) or 0)),
    )
    if args.only:
        wanted = {o.strip("/") for o in args.only}
        test_dirs = [p for p in test_dirs if f"{p.parent.name}/{p.name}" in wanted]
    if not test_dirs:
        print(f"Không tìm thấy đề nào trong {data_root}", file=sys.stderr)
        return 1

    out_tests = args.out / "tests"
    out_tests.mkdir(parents=True, exist_ok=True)
    report = Report()
    tests = []
    for d in test_dirs:
        t = build_test(data_root, d, report)
        tests.append(t)
        (out_tests / f"{t['id']}.json").write_text(json.dumps(t, ensure_ascii=False, indent=1), encoding="utf-8")
        c = report.count(t["id"])
        print(f"{t['id']:<14} {t['questionCount']:>3} câu  lỗi={c['error']:<3} cảnh báo={c['warn']:<3} tự sửa={c['fixed']}")

    if not args.only:
        index = [
            {k: t[k] for k in ("id", "year", "collection", "number", "title", "durationMinutes", "questionCount", "availability")}
            for t in tests
        ]
        (out_tests / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
        extras = write_extras(tests, args.out)
        print(f"Ngân hàng theo dạng: {len(extras['tags'])} nhóm | Từ vựng: {extras['vocab']} từ")
    report_path = args.out / "etl-report.md"
    write_report(report_path, tests, report)

    total = report.count()
    print(f"\n{len(tests)} đề | lỗi={total['error']} cảnh báo={total['warn']} tự sửa={total['fixed']}")
    print(f"JSON: {out_tests}\nBáo cáo: {report_path}")
    return 1 if args.strict and total["error"] else 0


if __name__ == "__main__":
    sys.exit(main())
