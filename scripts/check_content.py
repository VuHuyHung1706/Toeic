#!/usr/bin/env python3
"""Kiểm tra toàn vẹn dữ liệu đã sinh trong content/ (chạy sau scripts/etl.py).

    python3 scripts/check_content.py        # in lỗi, exit 1 nếu có lỗi
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
DATA = ROOT / "Data"
PART_COUNTS = {1: 6, 2: 25, 3: 39, 4: 30, 5: 30, 6: 16, 7: 54}
SECTION_RE = re.compile(r"^\s*(Từ vựng|Ngữ pháp|Bối cảnh|Ngữ cảnh)[^:\n]{0,30}:", re.M)

errors: list[str] = []
warns: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


index = json.loads((CONTENT / "tests" / "index.json").read_text(encoding="utf-8"))
if len(index) != 50:
    err(f"index.json có {len(index)} đề (cần 50)")

all_keys: dict[str, str] = {}  # "testId:n" → đáp án
media_checked = 0
for entry in index:
    tid = entry["id"]
    t = json.loads((CONTENT / "tests" / f"{tid}.json").read_text(encoding="utf-8"))
    nums = []
    for p in t["parts"]:
        part = p["part"]
        count = sum(len(g["questions"]) for g in p["groups"])
        if count != PART_COUNTS[part]:
            err(f"{tid} Part {part}: {count} câu (cần {PART_COUNTS[part]})")
        for g in p["groups"]:
            if g["questionNumbers"] != [q["number"] for q in g["questions"]]:
                err(f"{tid} {g['id']}: questionNumbers lệch với questions")
            if part in (3, 4) and len(g["questions"]) != 3:
                err(f"{tid} {g['id']}: Part {part} nhóm {len(g['questions'])} câu")
            if part == 6 and len(g["questions"]) != 4:
                err(f"{tid} {g['id']}: Part 6 nhóm {len(g['questions'])} câu")
            if part <= 4 and not (g.get("audio") and g["audio"].get("src")):
                err(f"{tid} {g['id']}: thiếu audio")
            if part == 1 and not any(i.get("src") for i in g["images"]):
                err(f"{tid} {g['id']}: Part 1 thiếu ảnh")
            if part in (3, 4, 6) and not any(ps.get("en") for ps in g["passages"]):
                err(f"{tid} {g['id']}: thiếu script/đoạn văn")
            if part == 7 and not any(ps.get("en") for ps in g["passages"]) and not g["images"]:
                err(f"{tid} {g['id']}: Part 7 không có đoạn văn hay ảnh")
            for ref in ([g["audio"]] if g.get("audio") else []) + g["images"]:
                if ref.get("src"):
                    media_checked += 1
                    if not (DATA / ref["src"]).is_file():
                        err(f"{tid} {g['id']}: file không tồn tại {ref['src']}")
            if part in (3, 4) and not g.get("vocab"):
                err(f"{tid} {g['id']}: Part {part} thiếu danh sách từ vựng")
            for q in g["questions"]:
                nums.append(q["number"])
                if part in (3, 4) and SECTION_RE.search(q["explanation"]):
                    err(f"{tid} câu {q['number']}: giải thích còn mục Từ vựng/Ngữ pháp/Bối cảnh")
                letters = "ABC" if part == 2 else "ABCD"
                if q["answer"] not in letters:
                    err(f"{tid} câu {q['number']}: đáp án '{q['answer']}' không hợp lệ")
                if part >= 3 and any(not q["options"].get(L) for L in letters):
                    warns.append(f"{tid} câu {q['number']}: thiếu nội dung phương án")
                if not q["explanation"]:
                    warns.append(f"{tid} câu {q['number']}: thiếu giải thích")
                if part in (2, 5) and len(q.get("tags", [])) != 1:
                    err(f"{tid} câu {q['number']}: Part {part} thiếu nhãn dạng câu")
                all_keys[f"{tid}:{q['number']}"] = q["answer"]
    if sorted(nums) != list(range(1, 201)):
        err(f"{tid}: số câu không phải 1–200 liên tục")
    if not (t.get("fullAudio") and (DATA / t["fullAudio"]["src"]).is_file()):
        err(f"{tid}: thiếu audio full đề")

# ngân hàng câu theo dạng
bank_index = json.loads((CONTENT / "bank" / "index.json").read_text(encoding="utf-8"))
tagged = Counter()
for b in bank_index:
    items = json.loads((CONTENT / "bank" / f"p{b['part']}-{b['tag']}.json").read_text(encoding="utf-8"))
    if len(items) != b["count"] or len(b["keys"]) != b["count"]:
        err(f"bank p{b['part']}-{b['tag']}: count/keys/items lệch nhau")
    for k in b["keys"]:
        tid, n, ans = k.rsplit(":", 2)
        if all_keys.get(f"{tid}:{n}") != ans:
            err(f"bank p{b['part']}-{b['tag']}: khoá {k} không khớp đáp án")
        tagged[b["part"]] += 1
if tagged[2] != 50 * 25 or tagged[5] != 50 * 30:
    err(f"bank: Part 2 có {tagged[2]} câu, Part 5 có {tagged[5]} câu (cần 1250 / 1500)")

# từ vựng
vocab = json.loads((CONTENT / "vocab.json").read_text(encoding="utf-8"))
words = [v["w"] for v in vocab]
if len(set(words)) != len(words):
    err("vocab: trùng từ gốc")
per_test = Counter()
for v in vocab:
    if not v["meanings"]:
        err(f"vocab {v['w']}: không có nghĩa")
    if v["w"] in v.get("inflections", []):
        err(f"vocab {v['w']}: tự là biến thể của chính nó")
    for r in v["related"]:
        if r["w"] == v["w"] or not r["meanings"]:
            err(f"vocab {v['w']}: dạng khác '{r['w']}' không hợp lệ")
    for tid, src in v["tests"].items():
        if tid not in {e['id'] for e in index}:
            err(f"vocab {v['w']}: đề lạ {tid}")
        if not (src.get("r") or src.get("l")):
            err(f"vocab {v['w']}: đề {tid} không có số câu")
        if not v["basic"]:
            per_test[tid] += 1
if len(per_test) != 50 or min(per_test.values()) < 30:
    err(f"vocab: {len(per_test)} đề có từ, ít nhất {min(per_test.values(), default=0)} từ/đề")

print(f"Đề: {len(index)} · câu: {len(all_keys)} · file media kiểm tra: {media_checked}")
print(f"Ngân hàng dạng câu: {len(bank_index)} nhóm · Từ vựng: {len(vocab)} từ, "
      f"{min(per_test.values())}–{max(per_test.values())} từ/đề")
print(f"Cảnh báo: {len(warns)}")
for w in warns[:10]:
    print("  ~", w)
print(f"Lỗi: {len(errors)}")
for e in errors[:50]:
    print("  ✗", e)
sys.exit(1 if errors else 0)
