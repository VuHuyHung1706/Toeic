#!/usr/bin/env python3
"""Nhập danh sách cụm từ đi với giới từ (file JSON do người dùng cung cấp) → content/phrases.json.

Chỉ giữ cụm, nghĩa, ví dụ và nhóm (bỏ nguồn / số lần xuất hiện).

    python3 scripts/import_phrases.py ~/Downloads/465_cum_gioi_tu_ETS_2018_2026.json

Định dạng vào: {"categories": [{"category_key", "category_name", "items": [{"phrase", "meaning", "example"}]}]}
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "content" / "phrases.json"

# khoá nhóm trong file gốc → khoá ngắn dùng trong web
GROUP_KEYS = {
    "noun_preposition": "noun",
    "verb_preposition": "verb",
    "adjective_preposition": "adj",
    "preposition_noun": "prep",
}


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 1
    src = json.loads(Path(sys.argv[1]).expanduser().read_text(encoding="utf-8"))
    groups = []
    for cat in src["categories"]:
        key = GROUP_KEYS.get(cat["category_key"])
        if not key:
            print(f"Bỏ qua nhóm lạ: {cat['category_key']}", file=sys.stderr)
            continue
        items = []
        for it in cat["items"]:
            phrase = " ".join(str(it.get("phrase", "")).split())
            meaning = " ".join(str(it.get("meaning", "")).split())
            example = " ".join(str(it.get("example", "")).split())
            if phrase and meaning:
                items.append({"phrase": phrase, "meaning": meaning, "example": example})
        groups.append({"key": key, "label": cat["category_name"], "items": items})
    OUT.write_text(json.dumps({"groups": groups}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{sum(len(g['items']) for g in groups)} cụm, {len(groups)} nhóm → {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
