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
_MARKER = re.compile(rf"[{_DASH}]\s*[\[(|{{［]\s*([1-4lIi])\s*[\])|}}］]\s*[{_DASH}]\s*[.，]?")
_DIGIT = {"l": "1", "I": "1", "i": "1"}
# OCR mất một/cả hai dấu ngoặc: "— 3] —.", "— 1 —", "-4-.", "— 2--.", "— 1—" (đứng sau khoảng trắng / đầu dòng)
# "— [4J—,", "- [41 -" (OCR đọc "]" thành "J"/"1"), "一2」一." (ngoặc góc)
_MARKER_LOOSE = re.compile(
    rf"(?:(?<=\s)|^)[{_DASH}][ \t]*[\[(|{{「［]?[ \t]*([1-4])[ \t]*[\])|}}」］J1]?[ \t]*[{_DASH}]+[ \t]*[.,，]?(?=\s|$)", re.M
)


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
    text = _MARKER_LOOSE.sub(lambda m: f"[{m.group(1)}]", text)
    # ngoặc toàn khổ thiếu gạch một bên ("—［3］", "一［4］—."), "[l-." (OCR đọc "1]" thành "l-")
    text = re.sub(rf"[{_DASH}]?[ \t]*［[ \t]*([1-4lIi])[ \t]*］[ \t]*[{_DASH}]?[ \t]*[.，]?", lambda m: f" [{_DIGIT.get(m.group(1), m.group(1))}] ", text)
    text = re.sub(r"\[([1-4lI])-\.?(?=\s)", lambda m: f"[{_DIGIT.get(m.group(1), m.group(1))}]", text)
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


def _anchor_regex(anchor: str) -> re.Pattern[str] | None:
    """Đoạn chữ đứng trước một dấu (lấy từ đề đối chiếu) → biểu thức tìm trong bài, bỏ qua khác biệt khoảng trắng / kiểu ngoặc kép."""
    # bỏ phần dư của dấu khác lẫn trong đoạn ("— [1] —. But being…"), chỉ giữ phần sau cùng
    tail = re.split(r"\[[1-4]\]\s*[—–\-]*\.?", anchor)[-1].strip()
    tail = tail[-45:].lstrip()
    if len(tail) < 12:
        return None
    parts = []
    for ch in tail:
        if ch.isspace():
            if not parts or parts[-1] != r"\s+":
                parts.append(r"\s+")
        elif ch in "\"“”":
            parts.append("[\"“”]")
        elif ch in "'’‘":
            parts.append("['’‘]")
        else:
            parts.append(re.escape(ch))
    return re.compile("".join(parts))


def insert_markers(text: str, anchors: list[str]) -> tuple[str, list[int]]:
    """Chèn các dấu [n] còn thiếu ngay sau đoạn chữ anchors[n-1]. Trả về (văn bản mới, các số không tìm được chỗ)."""
    missing: list[int] = []
    for n, anchor in enumerate(anchors, start=1):
        if f"[{n}]" in text:
            continue
        rx = _anchor_regex(anchor)
        m = rx.search(text) if rx else None
        if not m:
            missing.append(n)
            continue
        text = f"{text[: m.end()]} [{n}]{text[m.end():]}"
    text = re.sub(r"[ \t]+\[([1-4])\][ \t]*", r" [\1] ", text)
    text = re.sub(r"\[([1-4])\] +$", r"[\1]", text, flags=re.M)
    return text, missing


# ranh giới câu: sau . ! ? … (có thể kèm ngoặc kép/đóng ngoặc), trước chữ hoa / số / ngoặc mở
_SENT_END = re.compile(r"(?<=[.!?…])([\"”’)]?)([ \t]+)(?=(?:\[[1-4]\][ \t]*)?[\"“(]?[A-ZÀ-ỸĐ0-9])")
_MK = re.compile(r"[ \t]*\[([1-4])\][ \t]*")


def _sentences(line: str) -> int:
    line = _MK.sub(" ", line).strip()
    return len(_SENT_END.findall(line)) + 1 if line else 0


def copy_markers_to_vi(en: str, vi: str) -> str:
    """Chép dấu [n] của bài tiếng Anh sang bản dịch khi hai bản khớp từng dòng.
    Chỉ đặt khi chắc chắn: dấu ở đầu/cuối dòng, hoặc dòng tiếng Việt có cùng số câu (đặt sau câu tương ứng).
    Dấu đã có trong bản dịch thì giữ nguyên."""
    en_lines, vi_lines = en.split("\n"), vi.split("\n")
    if [bool(x.strip()) for x in en_lines] != [bool(x.strip()) for x in vi_lines]:
        return vi
    out = []
    for el, vl in zip(en_lines, vi_lines):
        for m in re.finditer(r"\[([1-4])\]", el):
            n = m.group(1)
            if f"[{n}]" in vi:
                continue
            before = _MK.sub(" ", el[: m.start()]).strip()
            after = _MK.sub(" ", el[m.end():]).strip()
            if not after:
                vl = f"{vl.rstrip()} [{n}]"
            elif not before:
                vl = f"[{n}] {vl.lstrip()}"
            elif _sentences(el) == _sentences(vl):
                k = _sentences(before)  # dấu đứng sau câu thứ k
                ends = list(_SENT_END.finditer(vl))
                if 1 <= k <= len(ends):
                    cut = ends[k - 1].start() + len(ends[k - 1].group(1))
                    vl = f"{vl[:cut]} [{n}]{vl[cut:]}"
            else:
                continue
            vi = "\n".join(out + [vl] + vi_lines[len(out) + 1 :])
        out.append(vl)
    return "\n".join(out)


if __name__ == "__main__":  # thử nhanh
    s = "Delays. — [l] —. More text. - (3] - End —|2|—.\nLLC. 一[I]一， x out.[2]We \ufeff[4] — Thu\n\n\n=====\nNext doc"
    print(normalize_passage(s))
