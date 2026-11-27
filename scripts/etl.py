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

from passage import SEPARATOR, copy_markers_to_vi, insert_markers, normalize_passage  # noqa: E402
from enrich import apply_evidence, apply_group_vocab, apply_option_notes, tag_question, write_extras

# Vị trí chèn câu [1]–[4] bị thiếu trong CSV gốc (Part 7, câu "positions marked"), xem scripts/passage_markers.json
_MARKERS_FILE = Path(__file__).resolve().parent / "passage_markers.json"
PASSAGE_MARKERS: dict[str, dict[str, list[str]]] = {
    k: v for k, v in json.loads(_MARKERS_FILE.read_text(encoding="utf-8")).items() if not k.startswith("_")
} if _MARKERS_FILE.exists() else {}


# Câu hỏi bị lỗi OCR trong CSV gốc (thiếu dấu phẩy/chấm, dính chữ…), đối chiếu với đề gốc — xem scripts/question_fixes.json
_QFIX_FILE = Path(__file__).resolve().parent / "question_fixes.json"
QUESTION_FIXES: dict[str, dict[str, dict[str, str]]] = {
    k: v for k, v in json.loads(_QFIX_FILE.read_text(encoding="utf-8")).items() if not k.startswith("_")
} if _QFIX_FILE.exists() else {}


def apply_row_fixes(row: dict, test_id: str, report: "Report") -> None:
    """Sửa tay theo question_fixes.json. Mỗi câu: {"from", "to"} (câu hỏi) và/hoặc
    "question": {from, to}, "options": {"C": {from, to}}, "answer": {from, to},
    "explanation": [{from, to}] (thay chuỗi con). Chỉ áp khi dữ liệu CSV còn đúng bằng "from"."""
    n, where = row["number"], row["where"]
    fix = QUESTION_FIXES.get(test_id, {}).get(str(n))
    if not fix:
        return

    def swap(cur: str, f: dict, what: str) -> str:
        if cur != f["from"]:
            report.add("warn", test_id, where, f"Câu {n}: {what} trong CSV đã khác 'from' (question_fixes.json) — chưa sửa")
            return cur
        return f["to"]

    q = fix.get("question") or ({"from": fix["from"], "to": fix["to"]} if "from" in fix else None)
    if q:
        row["question"] = swap(row["question"], q, "câu hỏi")
    for L, f in fix.get("options", {}).items():
        row["options"][L] = swap(row["options"].get(L, ""), f, f"phương án {L}")
    if "answer" in fix:
        row["answer"] = swap(row["answer"] or "", fix["answer"], "đáp án")
    for f in fix.get("explanation", []):
        if f["from"] in row["explanation"]:
            row["explanation"] = row["explanation"].replace(f["from"], f["to"])
        else:
            report.add("warn", test_id, where, f"Câu {n}: không thấy '{f['from'][:40]}' trong giải thích (question_fixes.json)")
    report.add("fixed", test_id, where, f"Câu {n}: sửa theo question_fixes.json")


# Chuẩn hoá chung câu hỏi / phương án Part 5–7 (lỗi OCR lặp lại nhiều đề)
_TIME = re.compile(r"(\d)\s?([AaPpΑΡ])\s?\.\s?[MmМмΜ]\b\.?")
_MARKED = re.compile(r"(positions?\s+marked)\s+.*?\s+(does\s+the\s+following)", re.I)


def normalize_question(part: int, s: str) -> str:
    if not s:
        return s
    s = _TIME.sub(lambda m: f"{m.group(1)} {'A' if m.group(2) in 'AaΑ' else 'P'}.M.", s)
    if part == 7:
        s = s.replace(";", ",")  # 2026 đề 6–10: dấu phẩy bị OCR thành chấm phẩy
        s = _MARKED.sub(r"\1 [1], [2], [3], and [4] \2", s)
        # ngoặc đơn → ngoặc kép như đề: the word 'x' / writes, 'x'? / best belong? 'x.'
        s = re.sub(r"((?:word|phrase)\s+)'([^']+)'", r'\1"\2"', s)
        s = re.sub(r"(writes,\s+)'(.+)'(\??)$", r'\1"\2"\3', s)
        s = re.sub(r"(belong\?\s+)'(.+)'$", r'\1"\2"', s)
        s = re.sub(r"(closest in meaning to)\s*[:?]\s*$", r"\1", s)
        s = re.sub(r"\s+\?$", "?", s)
    return s


_ABBR_END = re.compile(r"(?:[AP]\.M|Inc|Co|Ltd|Corp|Mr|Ms|Mrs|Dr|St|Ave|etc)\.$")


def complete_periods(options: dict[str, str]) -> dict[str, str]:
    """Phương án dạng câu: phần lớn có dấu chấm cuối mà vài cái thiếu (OCR rơi mất) → thêm cho đều."""
    full = [o for o in options.values() if o.endswith(".") and not _ABBR_END.search(o)]
    if len(full) < 2:
        return options
    return {L: (o + "." if o and re.search(r"[A-Za-z0-9)]$", o) else o) for L, o in options.items()}


def normalize_option(part: int, letter: str, s: str) -> str:
    if not s:
        return s
    s = re.sub(rf"^\({letter}\)\s*", "", s)  # "(A) [1]" → "[1]"
    s = re.sub(r"^(\d+)\.0$", r"\1", s)  # Excel: 102 → "102.0"
    s = re.sub(r"^£(\d+),00$", r"£\1", s)  # "£39,00" → "£39"
    s = _TIME.sub(lambda m: f"{m.group(1)} {'A' if m.group(2) in 'AaΑ' else 'P'}.M.", s)
    if part == 7:
        s = s.replace(";", ",")
    return s


# Bài đọc Part 6/7 sửa tay (chữ hỏng do OCR), đối chiếu ảnh scan đề — xem scripts/passage_fixes.json
_PFIX_FILE = Path(__file__).resolve().parent / "passage_fixes.json"
PASSAGE_FIXES: dict[str, dict[str, list[dict[str, str]]]] = {
    k: v for k, v in json.loads(_PFIX_FILE.read_text(encoding="utf-8")).items() if not k.startswith("_")
} if _PFIX_FILE.exists() else {}


def unescape_newlines(t: str) -> str:
    """CSV ghi nhầm ký tự xuống dòng thành chữ: "please?n\\Jing", "Junen\\Subject", "Renaldo,/nThank", "Town\\Đã"."""
    t = re.sub(r"n\\(?=\S)", "\n", t)
    t = re.sub(r"/n(?=[A-Z=Đ])", "\n", t)
    return re.sub(r"\\(?=[A-ZĐ])", "\n", t)


def apply_passage_fixes(group: dict, test_id: str, report: "Report", where: str) -> None:
    n = group["questionNumbers"]
    for f in PASSAGE_FIXES.get(test_id, {}).get(f"{n[0]}-{n[-1]}", []):
        lang = f.get("lang", "en")  # "vi": sửa bản dịch
        for p in group["passages"]:
            if f["from"] in p[lang]:
                p[lang] = p[lang].replace(f["from"], f["to"], 1)
                report.add("fixed", test_id, where, f"Sửa bài đọc: '{f['from'][:40]}' (passage_fixes.json)")
                break
        else:
            report.add("warn", test_id, where, f"Không thấy '{f['from'][:40]}' trong bài đọc (passage_fixes.json)")


# Part 6/7: loại văn bản theo dòng hướng dẫn của đề ("refer to the following e-mail and schedule"),
# {đề: {"131-134": "e-mail", "147-148": "notice"}} — đọc (OCR) từ ảnh scan đề, xem scripts/directions.json
_DIRECTIONS_FILE = Path(__file__).resolve().parent / "directions.json"
DIRECTIONS: dict[str, dict[str, str]] = {
    k: v for k, v in json.loads(_DIRECTIONS_FILE.read_text(encoding="utf-8")).items() if not k.startswith("_")
} if _DIRECTIONS_FILE.exists() else {}


# Một số CSV chép luôn dòng hướng dẫn vào bài đọc ("Questions 149-150 refer to the following advertisement." /
# "Câu hỏi 149-150 tham chiếu đến quảng cáo sau.") — có khi hai nhóm dính chung một ô.
_DIR_EN = re.compile(r"^\s*Questions?\s+(\d+)\s*[-–]\s*(\d+)\s+refers?\s+to\s+the\s+following\s+(.+?)\s*\.?\s*$", re.I | re.M)
_DIR_VI = re.compile(r"^\s*(?:Các\s+)?câu\s+hỏi\s+(\d+)\s*[-–]\s*(\d+)\b.*$", re.I | re.M)


def _split_by(text: str, pat: re.Pattern) -> list[tuple[int | None, str]]:
    """Tách văn bản tại các dòng hướng dẫn → [(số câu đầu hoặc None, phần chữ)], bỏ dòng hướng dẫn."""
    out: list[tuple[int | None, str]] = []
    last, start = 0, None
    for m in pat.finditer(text):
        if text[last:m.start()].strip() or start is not None:
            out.append((start, text[last:m.start()].strip()))
        start, last = int(m.group(1)), m.end()
    out.append((start, text[last:].strip()))
    return [(s, t) for s, t in out if t or s is not None]


def split_direction_lines(rows: list[dict], dirs: dict[str, str], report: "Report", test_id: str) -> None:
    """Part 6/7: bỏ dòng hướng dẫn khỏi bài đọc (ghi lại loại văn bản vào dirs), và nếu một ô chứa bài của
    nhiều nhóm thì chuyển phần sau sang câu đầu của nhóm đó (để gom nhóm đúng)."""
    by_n = {r["number"]: r for r in rows}
    for r in rows:
        if not _DIR_EN.search(r["text"] or ""):
            continue
        for m in _DIR_EN.finditer(r["text"]):
            dirs[f"{m.group(1)}-{m.group(2)}"] = m.group(3)
        en_by_start = dict(_split_by(r["text"], _DIR_EN))
        vi_by_start = dict(_split_by(r["transcript"] or "", _DIR_VI))
        # phần của chính nhóm này; chữ đứng trước dòng hướng dẫn đầu tiên ("PART 7 / Directions: …") thì bỏ
        own = r["number"] if r["number"] in en_by_start else None
        r["text"] = en_by_start.get(own, "")
        r["transcript"] = vi_by_start.get(own, vi_by_start.get(None, ""))
        for start, text in en_by_start.items():
            if start in (None, r["number"]):
                continue
            target = by_n.get(start)
            if target is None or target["text"]:
                report.add("error", test_id, r["where"], f"Không tách được bài đọc của nhóm bắt đầu ở câu {start}")
                continue
            target["text"], target["transcript"] = text, vi_by_start.get(start, "")
            report.add("fixed", test_id, r["where"], f"Tách bài đọc dính chung: nhóm từ câu {start} sang nhóm riêng")


# Dòng nhãn kiểu "*E-mail*", "[Web page]" ở đầu văn bản (OCR chép từ tab "E-mail" của đề) — khung đã có nhãn loại văn bản.
# Giữ tiêu đề thật như "MEMO", "NOTICE", "INVOICE".
_LABEL_LINE = re.compile(r"^\s*[\[*\"]?\s*(?:e-?mail(?:\s+message)?|web page|chat)\s*[\]*\"]?\s*:?\s*$", re.I)
_DOC_SEP = re.compile(r"^\s*={3,}\s*$", re.M)


def drop_label_lines(en: str, vi: str) -> tuple[str, str]:
    """Bỏ dòng nhãn ở đầu từng văn bản; bản dịch bỏ cùng dòng đó (nếu cũng là nhãn) để hai bản vẫn khớp dòng."""
    en_docs, vi_docs = _DOC_SEP.split(en), _DOC_SEP.split(vi) if vi else []
    if not any(_LABEL_LINE.match(d.strip("\n").split("\n")[0]) for d in en_docs):
        return en, vi
    for k, doc in enumerate(en_docs):
        lines = doc.strip("\n").split("\n")
        if not lines or not _LABEL_LINE.match(lines[0]):
            continue
        en_docs[k] = "\n".join(lines[1:])
        if k < len(vi_docs):
            vl = vi_docs[k].strip("\n").split("\n")
            # bản dịch cùng số dòng → dòng đầu là bản dịch của nhãn (hoặc chép nguyên nhãn) → bỏ theo
            if vl and (_LABEL_LINE.match(vl[0]) or len(vl) == len(lines)):
                vi_docs[k] = "\n".join(vl[1:])
    join = lambda docs: f"\n{SEPARATOR}\n".join(d.strip("\n") for d in docs)
    return join(en_docs), (join(vi_docs) if vi else vi)


# chỗ trống Part 5 trong CSV viết đủ kiểu ("----", "—---", "- - - -", "——--") → thống nhất "-------"
_P5_BLANK = re.compile(r"(?<![\w-])[-–—_](?:\s?[-–—_])+(?![\w-])|[-–—_]{3,}")


def normalize_p5_blank(text: str) -> str:
    text = _P5_BLANK.sub("-------", text)
    text = re.sub(r"-------(?=[A-Za-z])", "------- ", text)  # "-------in the" → "------- in the"
    text = re.sub(r"(?<=\S)-------", " -------", text)
    text = re.sub(r"------- ([.,;:?!])", r"-------\1", text)  # "------- ." → "-------."
    return re.sub(r"\s{2,}", " ", text).strip()


def apply_passage_markers(group: dict, test_id: str, report: "Report", where: str) -> None:
    """Chèn dấu [n] còn thiếu vào bài đọc tiếng Anh của nhóm theo passage_markers.json."""
    for q in group["questions"]:
        anchors = PASSAGE_MARKERS.get(test_id, {}).get(str(q["number"]))
        if not anchors:
            continue
        for n, anchor in enumerate(anchors, start=1):
            if any(f"[{n}]" in p["en"] for p in group["passages"]):
                continue
            for p in group["passages"]:
                new, missing = insert_markers(p["en"], [anchor if i == n else "" for i in range(1, 5)])
                if n not in missing:
                    p["en"] = new
                    break
            else:
                report.add("error", test_id, where, f"Câu {q['number']}: không tìm thấy chỗ chèn [{n}] (passage_markers.json)")
    # bản dịch: chép vị trí dấu từ bài tiếng Anh (chỉ nhóm có câu chèn câu)
    if any(re.search(r"positions? marked", q["question"] or "", re.I) for q in group["questions"]):
        for p in group["passages"]:
            if p["en"] and p["vi"] and "[" in p["en"]:
                p["vi"] = copy_markers_to_vi(p["en"], p["vi"])


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
# Đề bỏ khỏi kho: audio riêng của quá nhiều nhóm câu không khớp audio cả đề (18 và 11 / 54 nhóm),
# không đồng bộ được với audio full → thi thử không tự chuyển câu, luyện tập phát nhầm audio.
# Vẫn đọc để lấy nghĩa từ cho từ điển (bỏ đi thì các đề khác mất vài từ vựng), nhưng không xuất ra content/.
EXCLUDED_TESTS = {"2025/test7", "2025/test8"}
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
# OCR lẫn chữ Cyrillic / Hy Lạp trông giống chữ Latin ("То:", "Туре:", "P.м.", "10 А.М.-6 Р.м.") — đề và bản dịch
# đều không dùng hai bảng chữ này nên đổi hết về chữ Latin; "л.М." là chữ A bị đọc nhầm.
_HOMOGLYPHS = str.maketrans({
    "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H", "О": "O", "Р": "P", "С": "C", "Т": "T", "Х": "X",
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "м": "M", "к": "k",
    "Α": "A", "Β": "B", "Ε": "E", "Κ": "K", "Μ": "M", "Ν": "N", "Ο": "O", "Ρ": "P", "Τ": "T", "Χ": "X",
    "і": "i", "І": "I",
    "\ufeff": None,
})


def clean_text(v: str | None) -> str:
    if not v:
        return ""
    v = v.replace("л.М.", "A.M.").translate(_HOMOGLYPHS)
    v = re.sub(r"\b([AaPp])\.M\.", lambda m: m.group(1).upper() + ".M.", v)  # "p.M." → "P.M."
    v = v.replace("\r\n", "\n").replace("\r", "\n")
    v = v.replace("\\n", "\n")  # CSV lưu xuống dòng dạng literal "\n"
    # ô bị escape CSV hai lần: '"The word ""just"" in…"', '…unexpected.""', ',"Đáp án A…'
    if '""' in v:
        v = re.sub(r'^,?"(.*)"$', r"\1", v.strip(), flags=re.S) if re.match(r'^,?".*"$', v.strip(), re.S) else re.sub(r'^,"', "", v)
        v = v.replace('""', '"')
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
    embedded_dirs: dict[str, dict[str, str]] = {}  # dòng hướng dẫn Part 7 chép sẵn trong bài đọc (CSV)

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

            row = {
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
            }
            apply_row_fixes(row, test_id, report)
            if part >= 5:
                row["question"] = normalize_question(part, row["question"])
                row["options"] = {L: normalize_option(part, L, t) for L, t in row["options"].items()}
                if part >= 6:
                    row["options"] = complete_periods(row["options"])
            if part == 5:
                row["question"] = normalize_p5_blank(row["question"])
            rows.append(row)
        rows.sort(key=lambda r: r["number"])
        if part in (6, 7):
            split_direction_lines(rows, embedded_dirs.setdefault(test_id, {}), report, test_id)

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
                # file audio riêng bị gán nhầm/lẫn nhóm sau → bản cắt lại từ audio cả đề (scripts/fix_group_audio.mjs)
                fixed = test_dir / "audio" / "fixed" / f"{test_id}-p{part}-g{gi}.mp3"
                if fixed.is_file():
                    audio = {"src": media._rel(fixed), "remoteUrl": None}
                    report.add("fixed", test_id, gwhere, "Audio riêng cắt lại từ audio cả đề (file gốc sai)")

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
            if part in (6, 7):
                rng = f"{numbers[0]}-{numbers[-1]}"
                # dòng hướng dẫn "Questions 147-148 refer to the following notice." (scripts/directions.json)
                directions = DIRECTIONS.get(test_id, {}).get(rng) or embedded_dirs.get(test_id, {}).get(rng)
                if directions:
                    group["directions"] = directions
                # ảnh scan trang đề: Data/<năm>/<đề>/image/scan/p6-131-134.jpg, p7-147-148.jpg, p7-176-180-1.jpg, -2…
                scan_dir = test_dir / "image" / "scan"
                base = f"p{part}-{rng}"
                scans = sorted(
                    (p for p in scan_dir.glob(f"{base}*") if re.fullmatch(rf"{base}(?:-\d+)?\.(?:jpe?g|png)", p.name)),
                    key=lambda p: int(p.stem[len(f"{base}-"):] or 0),
                ) if scan_dir.is_dir() else []
                if scans:
                    group["scans"] = [{"src": media._rel(p), "remoteUrl": None} for p in scans]
            if part in GROUPED_PARTS:
                # Đoạn văn kép/ba (Part 7) có thể nằm rải ở nhiều dòng trong nhóm
                for r in g:
                    en = "" if PLACEHOLDER_TEXT_RE.match(r["text"]) else r["text"]
                    vi = r["transcript"]
                    if vi and any(p["vi"] == vi for p in group["passages"]):
                        vi = ""  # bản dịch bị chép lặp ở nhiều câu
                    if part in (6, 7):
                        en, vi = normalize_passage(unescape_newlines(en)), normalize_passage(unescape_newlines(vi))
                        en, vi = drop_label_lines(en, vi)
                    if en or vi:
                        group["passages"].append({"en": en, "vi": vi})
                if part in (6, 7):
                    apply_passage_fixes(group, test_id, report, gwhere)
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
                apply_option_notes(q)
                if part not in GROUPED_PARTS and r["transcript"]:
                    q["transcript"] = r["transcript"]
                group["questions"].append(q)
            if part in (3, 4):
                apply_group_vocab(group)
            if part == 7:
                apply_passage_markers(group, test_id, report, gwhere)
                apply_evidence(group)
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
def load_audio_timeline(path: Path) -> dict:
    """Mốc thời gian từng nhóm câu nghe trong audio cả đề (sinh bằng scripts/audio_timeline.mjs)."""
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def apply_audio_timeline(test: dict, tl: dict | None, report: "Report") -> None:
    """Gắn audioStart/audioEnd (giây trong audio cả đề) cho nhóm Part 1–4 → thi thật tự chuyển câu theo audio."""
    if not tl or tl.get("error") or tl.get("minScore", 0) < 0.8:
        if tl:
            report.add("warn", test["id"], "audio", "Mốc thời gian audio khớp kém — thi thật không tự chuyển câu")
        return
    for p in test["parts"]:
        if p["part"] > 4:
            continue
        for g in p["groups"]:
            m = tl["groups"].get(g["id"])
            if m:
                g["audioStart"], g["audioEnd"] = m["start"], m["end"]


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
    timeline = load_audio_timeline(args.out / "audio-timeline.json")
    dictionary_tests = []  # mọi đề theo thứ tự, kể cả đề bị loại: nguồn nghĩa cho từ điển từ vựng
    for d in test_dirs:
        if f"{d.parent.name}/{d.name}" in EXCLUDED_TESTS:
            dictionary_tests.append(build_test(data_root, d, Report()))
            continue
        t = build_test(data_root, d, report)
        apply_audio_timeline(t, timeline.get(t["id"]), report)
        tests.append(t)
        dictionary_tests.append(t)
        c = report.count(t["id"])
        print(f"{t['id']:<14} {t['questionCount']:>3} câu  lỗi={c['error']:<3} cảnh báo={c['warn']:<3} tự sửa={c['fixed']}")

    if not args.only:
        index = [
            {k: t[k] for k in ("id", "year", "collection", "number", "title", "durationMinutes", "questionCount", "availability")}
            for t in tests
        ]
        (out_tests / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
        # chạy trước khi ghi đề: bổ sung danh sách từ vựng cho các đoạn Part 3/4
        extras = write_extras(tests, args.out, dictionary_tests=dictionary_tests)
        print(f"Ngân hàng theo dạng: {len(extras['tags'])} nhóm | Từ vựng: {extras['vocab']} từ")
    for t in tests:
        (out_tests / f"{t['id']}.json").write_text(json.dumps(t, ensure_ascii=False, indent=1), encoding="utf-8")
    report_path = args.out / "etl-report.md"
    write_report(report_path, tests, report)

    total = report.count()
    print(f"\n{len(tests)} đề | lỗi={total['error']} cảnh báo={total['warn']} tự sửa={total['fixed']}")
    print(f"JSON: {out_tests}\nBáo cáo: {report_path}")
    return 1 if args.strict and total["error"] else 0


if __name__ == "__main__":
    sys.exit(main())
