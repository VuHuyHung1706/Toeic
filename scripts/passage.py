"""Chuẩn hoá văn bản bài đọc Part 6/7 (bản gốc và bản dịch) trước khi ghi ra content/.

- Ký hiệu vị trí chèn câu bị OCR lỗi nhiều kiểu ("— [1] —.", "- (3] -", "—|1|—", "- [l] -") → "[1]".
- Dòng phân cách giữa các văn bản của đoạn kép/ba ("=====", "============") → "==========".
- Bỏ dòng trống thừa, khoảng trắng cuối dòng (giữ khoảng trắng giữa dòng: bảng căn cột bằng dấu cách).
Giao diện (src/lib/passage.ts) dựa vào các quy ước này để dựng HTML.
"""
from __future__ import annotations

import re

SEPARATOR = "=========="
_SEP_LINE = re.compile(r"^\s*={3,}\s*$", re.M)
# gạch ngang hai bên + ngoặc lẫn lộn [ ( | { … ] ) | } + số 1–4 (OCR hay đọc "1" thành "l"/"I")
_DASH = "—–\\-一"  # "一" (chữ Hán) hay bị OCR nhầm với dấu gạch dài
_MARKER = re.compile(rf"[{_DASH}]\s*[\[(|{{]\s*([1-4lIi])\s*[\])|}}]\s*[{_DASH}]\s*[.，]?")
_DIGIT = {"l": "1", "I": "1", "i": "1"}


def _marker(m: re.Match) -> str:
    n = _DIGIT.get(m.group(1), m.group(1))
    return f"[{n}]"


def normalize_passage(text: str) -> str:
    if not text:
        return text
    # k\u00fd t\u1ef1 BOM l\u1ecdt gi\u1eefa c\u00e2u: n\u1eb1m gi\u1eefa hai ch\u1eef th\u00ec thay b\u1eb1ng d\u1ea5u c\u00e1ch ("137---\ufeffto" \u2192 "137--- to")
    text = re.sub(r"(?<=\S)\ufeff+(?=\S)", " ", text).replace("\ufeff", "").replace("\\N", " ")
    text = _SEP_LINE.sub(SEPARATOR, text)
    text = _MARKER.sub(_marker, text)
    # gạch ngang còn sót một bên ký hiệu, ký hiệu dính chữ ("out.[2]We")
    text = re.sub(rf"\[([1-4])\]\s*[{_DASH}](?=\s)", r"[\1]", text)
    text = re.sub(rf"(?<=\s)[{_DASH}]\s*\[([1-4])\]", r"[\1]", text)
    text = re.sub(r"(?<=\S)\[([1-4])\]", r" [\1]", text)
    text = re.sub(r"\[([1-4])\](?=[^\s\]])", r"[\1] ", text)
    # "câu. [1] Câu sau" — gộp dấu cách thừa quanh ký hiệu
    text = re.sub(r"[ \t]+\[([1-4])\][ \t]*", r" [\1] ", text)
    text = re.sub(r"\[([1-4])\] +$", r"[\1]", text, flags=re.M)
    lines = [ln.rstrip() for ln in text.split("\n")]
    out: list[str] = []
    for ln in lines:
        if not ln.strip():
            if out and out[-1] != "":
                out.append("")
            continue
        out.append(ln)
    return "\n".join(out).strip()


if __name__ == "__main__":  # thử nhanh
    s = "Delays. — [l] —. More text. - (3] - End —|2|—.\nLLC. 一[I]一， x out.[2]We \ufeff[4] — Thu\n\n\n=====\nNext doc"
    print(normalize_passage(s))
