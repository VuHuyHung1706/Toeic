"""Làm giàu dữ liệu sau ETL: gắn nhãn dạng câu (Part 2, Part 5) và trích từ vựng.

Được gọi từ scripts/etl.py; có thể chạy riêng để xem thống kê:
    python3 scripts/enrich.py
"""
from __future__ import annotations

import json
import re
from difflib import SequenceMatcher
from collections import Counter, defaultdict
from pathlib import Path

# ---------------------------------------------------------------------------
# Nhãn dạng câu
# ---------------------------------------------------------------------------
TAG_LABELS = {
    2: {
        "who": "Câu hỏi Who",
        "what": "Câu hỏi What / Which",
        "when": "Câu hỏi When",
        "where": "Câu hỏi Where",
        "why": "Câu hỏi Why",
        "how": "Câu hỏi How",
        "yes-no": "Câu hỏi Yes/No",
        "negative-tag": "Câu hỏi phủ định & câu hỏi đuôi",
        "choice": "Câu hỏi lựa chọn (or)",
        "request": "Yêu cầu, đề nghị, gợi ý",
        "statement": "Câu trần thuật",
    },
    5: {
        "word-form": "Từ loại",
        "verb": "Thì & dạng động từ",
        "pronoun": "Đại từ",
        "relative": "Đại từ quan hệ",
        "prep-conj": "Giới từ & liên từ",
        "comparison": "So sánh",
        "vocabulary": "Từ vựng",
    },
}

AUX = {"do", "does", "did", "is", "are", "was", "were", "am", "have", "has", "had", "can", "could", "will",
       "would", "should", "may", "might", "shall", "must"}
NEG_AUX_RE = re.compile(r"^(don't|doesn't|didn't|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't|can't|couldn't|"
                        r"won't|wouldn't|shouldn't)\b", re.I)
TAG_Q_RE = re.compile(r",\s*(?:\w+n't\s+\w+|right|correct|isn't it|don't you|haven't you)\s*\??\s*$", re.I)
REQUEST_RE = re.compile(r"^(could you|would you|can you|will you|would you like|do you want me to|why don't|why not|"
                        r"how about|what about|shall we|let's|please|would you mind|could i|can i|may i|should we)\b", re.I)


def tag_part2(text: str) -> str:
    s = re.sub(r"\s+", " ", text.strip())
    low = s.lower()
    if REQUEST_RE.match(low) and s.endswith("?"):
        return "request"
    if NEG_AUX_RE.match(low) or TAG_Q_RE.search(s):
        return "negative-tag"
    first = re.split(r"[\s',]", low, maxsplit=1)[0]
    first = {"who's": "who", "what's": "what", "where's": "where", "when's": "when", "how's": "how"}.get(first, first)
    if first in ("who", "whose", "whom"):
        return "who"
    if first in ("what", "which"):
        return "what"
    if first in ("when", "where", "why", "how"):
        return first
    if not s.endswith("?"):
        return "request" if REQUEST_RE.match(low) else "statement"
    if " or " in low:
        return "choice"
    if first in AUX:
        return "yes-no"
    return "statement"


PRONOUNS = {"i", "me", "my", "mine", "myself", "you", "your", "yours", "yourself", "yourselves", "he", "him", "his",
            "himself", "she", "her", "hers", "herself", "it", "its", "itself", "we", "us", "our", "ours", "ourselves",
            "they", "them", "their", "theirs", "themselves", "one", "oneself", "each other", "one another"}
RELATIVES = {"who", "whom", "whose", "which", "that", "whoever", "whomever", "whichever", "whatever", "where",
             "when", "what", "wherever", "whenever", "why", "how"}
PREP_CONJ = {"about", "above", "across", "after", "against", "along", "among", "around", "as", "at", "before",
             "behind", "below", "beneath", "beside", "besides", "between", "beyond", "by", "despite", "during",
             "except", "for", "from", "in", "inside", "into", "like", "near", "of", "off", "on", "onto", "out",
             "outside", "over", "past", "since", "through", "throughout", "to", "toward", "towards", "under", "until",
             "till", "upon", "with", "within", "without", "although", "though", "even though", "because", "because of",
             "due to", "if", "unless", "whereas", "while", "whether", "so that", "in order to", "provided that",
             "as soon as", "as long as", "once", "and", "but", "or", "nor", "so", "yet", "both", "either", "neither",
             "not only", "however", "therefore", "moreover", "furthermore", "nevertheless", "consequently",
             "otherwise", "meanwhile", "instead", "instead of", "rather than", "in addition to", "according to",
             "regarding", "concerning", "following", "prior to", "owing to", "in spite of", "thus", "hence",
             "only if", "even if", "as if", "now that", "in case", "whenever", "wherever", "along with", "apart from",
             "as well as", "aside from", "up to", "next to", "in front of", "because", "then", "also", "still"}
# hậu tố tạo danh từ / tính từ / trạng từ — có mặt trong đáp án nghĩa là câu hỏi về từ loại
DERIV_RE = re.compile(r"(tion|sion|ment|ness|ity|ance|ence|ancy|ency|ist|ism|al|ial|ive|ous|ful|less|able|ible|ly|ic|"
                      r"ical|ure|ship|ant|ent|ee|ery|or|er|ness)s?$")


def _norm(o: str) -> str:
    return re.sub(r"\s+", " ", o.strip().lower().rstrip("."))


def _common_prefix(words: list[str]) -> int:
    if not words:
        return 0
    a, b = min(words), max(words)
    i = 0
    while i < min(len(a), len(b)) and a[i] == b[i]:
        i += 1
    return i


def tag_part5(question: dict) -> str:
    opts = [_norm(v) for v in question["options"].values() if v and v.strip()]
    if len(opts) < 2:
        return "vocabulary"
    if all(o in PRONOUNS for o in opts):
        return "pronoun"
    if sum(o in RELATIVES for o in opts) >= 3:
        return "relative"
    if any(o.startswith(("more ", "most ", "less ", "least ")) for o in opts) or (
        sum(bool(re.search(r"(er|est)$", o)) for o in opts) >= 2 and _common_prefix(opts) >= 3
    ):
        return "comparison"
    if sum(o in PREP_CONJ for o in opts) >= 3:
        return "prep-conj"
    # các đáp án cùng gốc từ → từ loại (khác loại từ) hoặc dạng động từ (cùng là động từ)
    heads = [o.split()[-1] for o in opts]
    multi_aux = any(len(o.split()) > 1 and o.split()[0] in AUX | {"be", "been", "being", "to", "having"} for o in opts)
    same_root = _common_prefix(heads) >= 3
    if same_root:
        stem = min(heads, key=len)
        derived = [h for h in heads if h != stem and DERIV_RE.search(h) and not h.endswith(("ing", "ed"))]
        if derived:
            return "word-form"
    if multi_aux or (same_root and _common_prefix(heads) >= 4):
        return "verb"
    return "vocabulary"


def tag_question(q: dict) -> list[str]:
    if q["part"] == 2:
        return [tag_part2(q.get("question", ""))]
    if q["part"] == 5:
        return [tag_part5(q)]
    return []


# ---------------------------------------------------------------------------
# Part 3/4: tách mục "Từ vựng" khỏi giải thích thành danh sách từ của cả đoạn hội thoại,
# và bỏ các mục "Ngữ pháp", "Bối cảnh/Ngữ cảnh" khỏi giải thích
# ---------------------------------------------------------------------------
REMOVED_SECTION_RE = re.compile(r"^(Từ vựng|Ngữ pháp|Bối cảnh|Ngữ cảnh)[^:\n]{0,30}:\s*(.*)$", re.I)
OTHER_SECTION_RE = re.compile(r"^(?:[^\s\-•*+\d\"“'][^:\n]{1,45}:\s*$|(?:Mẹo|Đáp án|Giải thích|Lưu ý|Chú ý|Dịch|Câu hỏi|Paraphrase|Phân tích)\b)")
BULLET_RE = re.compile(r"^\s*(?:[-•*+]|\d+[.)])\s*")
VOCAB_ITEM_RE = re.compile(r"^[\"“']?([A-Za-z][A-Za-z'’ .,/=&-]{0,60}?)[\"”']?\s*(?:\(([^()]{1,40})\))?\s*[:\-–]\s+(.+)$")
POS_ABBR = {"n": "n", "noun": "n", "v": "v", "verb": "v", "adj": "adj", "adv": "adv", "prep": "prep", "conj": "conj",
            "pron": "pron", "phr": "", "phrase": "", "phr v": "v", "phrasal verb": "v", "idiom": ""}


def _parse_vocab_item(text: str) -> dict | None:
    m = VOCAB_ITEM_RE.match(text.strip())
    if not m:
        return None
    term, pos_raw, meaning = m.groups()
    term = re.sub(r"\s+", " ", term).strip(" .,")
    pos: list[str] = []
    if pos_raw:
        parts = [x.strip().lower() for x in re.split(r"[/,]", pos_raw)]
        if all(x in POS_ABBR for x in parts):
            pos = sorted({POS_ABBR[x] for x in parts if POS_ABBR[x]})
        else:
            pos = _pos_of(pos_raw)  # "danh từ", "động từ"… ; còn lại là ghi chú như "(trong ngữ cảnh này)"
    meaning = meaning.strip().strip("\"'“”").strip()
    if not term or len(term) > 60 or not meaning or not VI_CHARS_RE.search(meaning):
        return None
    return {"term": term, "pos": pos, "meaning": meaning[:120]}


def split_explanation(text: str) -> tuple[str, list[dict]]:
    """Bỏ các mục Từ vựng / Ngữ pháp / Bối cảnh khỏi giải thích; trả về (giải thích mới, các mục từ vựng)."""
    lines = text.split("\n")
    out: list[str] = []
    vocab: list[dict] = []
    i = 0
    while i < len(lines):
        m = REMOVED_SECTION_RE.match(lines[i].strip())
        if not m:
            out.append(lines[i])
            i += 1
            continue
        is_vocab = m.group(1).lower().startswith("từ vựng")
        if is_vocab and m.group(2):
            for piece in re.split(r";\s*", m.group(2)):
                item = _parse_vocab_item(piece)
                if item:
                    vocab.append(item)
        i += 1
        while i < len(lines):  # thân của mục: tới dòng trống hoặc mục khác
            b = lines[i].strip()
            if not b or OTHER_SECTION_RE.match(b) and not BULLET_RE.match(lines[i]):
                break
            if is_vocab:
                item = _parse_vocab_item(BULLET_RE.sub("", b))
                if item:
                    vocab.append(item)
            i += 1
    cleaned = re.sub(r"\n{3,}", "\n\n", "\n".join(out)).strip()
    return cleaned, vocab


def apply_group_vocab(group: dict) -> None:
    """Part 3/4: gom từ vựng của cả nhóm câu vào group["vocab"], làm gọn giải thích từng câu."""
    seen: set[str] = set()
    items: list[dict] = []
    for q in group["questions"]:
        q["explanation"], vocab = split_explanation(q["explanation"])
        for v in vocab:
            key = v["term"].lower()
            if key not in seen:
                seen.add(key)
                items.append(v)
    group["vocab"] = items


# ---------------------------------------------------------------------------
# Part 7: dẫn chứng — câu/đoạn trong bài đọc mà phần giải thích trích dẫn (để tô màu theo câu hỏi)
# ---------------------------------------------------------------------------
EVIDENCE_QUOTE_RE = re.compile(r'["“]([^"“”]{8,400})["”]|(?<![A-Za-z])\'([^\']{12,300})\'(?![A-Za-z])')
PASSAGE_SENT_RE = re.compile(r"[^.!?\n]+[.!?]?")
SENT_BOUNDARY_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"“(])")


def _flex_pattern(span: str) -> re.Pattern | None:
    words = re.findall(r"\S+", span.strip(" .,;:"))
    if len(words) < 3:
        return None
    # một lượt thay duy nhất (thay hai lượt sẽ thay luôn dấu ’ vừa chèn → hỏng mẫu)
    parts = [re.sub(r"['’]", lambda _: "['’]", re.escape(w)) for w in words]
    return re.compile(r"\s+".join(parts), re.I)


def _tok(s: str) -> list[str]:
    return [w for w in (x.lower().strip(".,;:!?()\"'’") for x in re.findall(r"\S+", s)) if w]


def find_evidence(question: dict, passage: str) -> list[str]:
    """Các đoạn nguyên văn trong bài đọc được phần giải thích trích dẫn (khớp chính xác, hoặc khớp ≥75% từ của một câu)."""
    sents = [m.group(0).strip() for m in PASSAGE_SENT_RE.finditer(passage) if len(m.group(0).split()) >= 3]
    found: list[str] = []
    for a, b in EVIDENCE_QUOTE_RE.findall(question.get("explanation", "")):
        for piece in re.split(r"\s*(?:\.\.\.|…)\s*", a or b):
            pat = _flex_pattern(piece)
            if not pat:
                continue
            m = pat.search(passage)
            if m:
                hit = m.group(0)
            else:
                q = set(_tok(piece))
                if len(q) < 4:
                    continue
                best = max(sents, key=lambda st: len(q & set(_tok(st))), default=None)
                if not best or len(q & set(_tok(best))) / len(q) < 0.75:
                    continue
                hit = best
            # tách theo câu để tô được cả ở chế độ song ngữ (mỗi dòng là một câu)
            for sub in SENT_BOUNDARY_RE.split(hit):
                sub = sub.strip()
                if len(sub.split()) >= 3 and sub not in found:
                    found.append(sub)
    return found[:6]


def apply_evidence(group: dict) -> None:
    passage = "\n".join(ps["en"] for ps in group["passages"] if ps.get("en"))
    if not passage:
        return
    for q in group["questions"]:
        ev = find_evidence(q, passage)
        if ev:
            q["evidence"] = ev


# ---------------------------------------------------------------------------
# Từ vựng: trích từ các dòng giải thích dạng "A. modifications (danh từ số nhiều: những sự thay đổi)"
# ---------------------------------------------------------------------------
VOCAB_LINE_RE = re.compile(
    r"^\s*(?:[-•]\s*)?\(?([A-D])\)?\s*[.:)]\s*[\"'“]?([A-Za-z][A-Za-z'’ -]{0,40}?)[\"'”]?\s*\(([^()]{2,90})\)\s*\.?$"
)
POS_MAP = [
    ("danh từ", "n"),
    ("động từ", "v"),
    ("tính từ", "adj"),
    ("trạng từ", "adv"),
    ("giới từ", "prep"),
    ("liên từ", "conj"),
    ("đại từ", "pron"),
    ("phân từ", "v"),
    ("danh động từ", "n"),
]
SKIP_WORDS = PRONOUNS | {"a", "an", "the", "to", "of", "and", "or", "but", "this", "that", "these", "those", "there",
                         "here", "be", "is", "are", "was", "were", "do", "does", "did", "have", "has", "had"}
BLANK_RE = re.compile(r"[-—–_]{2,}(?:\s?[-—–_]+)*|\.{4,}")


def _parse_meaning(raw: str) -> tuple[list[str], str]:
    raw = raw.strip().strip(".")
    pos: list[str] = []
    meaning = raw
    head, sep, tail = raw.partition(":")
    head_l = head.lower()
    found = [tag for label, tag in POS_MAP if label in head_l]
    if found and (sep or len(head_l) <= 25):
        pos = sorted(set(found))
        meaning = tail.strip() if sep else ""
    return pos, meaning


# Các kiểu dòng giải thích phương án khác (mỗi bộ đề viết một kiểu):
#   "A. khu vực (tính từ)"                      — nghĩa trước, loại từ trong ngoặc (2022)
#   "(A) plan (động từ): lên kế hoạch (đúng)"    — (2024)
#   "A. raised (động từ quá khứ): đã gây quỹ"    — (2023)
#   "- (A) across (qua, ngang qua) - không …"    — (2026)
#   "Đáp án A: cuối cùng (tính từ)"              — (2026)
OPTION_LINE_RE = re.compile(r"^\s*(?:[-•*]\s*)?(?:Đáp án\s*)?\(?([A-D])\)?\s*[.:)\-]?\s+(.+?)\s*$")
PAREN_RE = re.compile(r"\(([^()]{1,80})\)")
NOT_MEANING_RE = re.compile(r"đáp án|phù hợp|không đúng|chính xác|ngữ pháp|cấu trúc|câu này|vị trí|cần một|bổ nghĩa|"
                            r"lý do|là đúng|đúng vì|^cụm từ$|^(?:đúng|sai)$|^không\b|ngữ cảnh|chủ ngữ|tân ngữ|chia thì|chia ở|không đứng|đứng trước|đứng sau|dạng (?:số|quá|hiện|bị)|"
                            r"^(?:động từ|danh từ|tính từ|trạng từ)\b|^cụm động từ$|^thành ngữ$|"
                            r"\b(?:the|and|is|are|to|of)\b", re.I)
# nhãn ngữ pháp đứng đầu nghĩa: "quá khứ: đã đánh giá", "hiện tại phân từ: đang …"
GRAMMAR_PREFIX_RE = re.compile(r"^(?:(?:động từ|danh từ|tính từ|trạng từ)\s*)?(?:quá khứ|hiện tại|tương lai|phân từ|"
                               r"nguyên mẫu|nguyên thể|bị động|số nhiều|số ít|V-ing|V-ed|to-V)[^:]{0,25}:\s*", re.I)
AUX_START = {"to", "is", "are", "was", "were", "be", "been", "being", "has", "have", "had", "will", "would", "can",
             "could", "may", "might", "should", "must", "shall", "do", "does", "did", "having"}
VI_CHARS_RE = re.compile(r"[ăâđêôơưàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ]", re.I)


def _pos_of(text: str) -> list[str]:
    t = text.lower()
    return sorted({tag for label, tag in POS_MAP if label in t})


def _clean_meaning(m: str) -> str:
    m = re.sub(r"\((?:đúng|sai|đáp án đúng)\)", "", m, flags=re.I)
    m = re.split(r"\s+[-–—]\s+|\s*\.\s+|;\s*(?:không|sai)", m)[0]
    m = GRAMMAR_PREFIX_RE.sub("", m.strip())
    m = re.sub(r"^có nghĩa(?: là)?\s*", "", m, flags=re.I)
    m = re.sub(r"^(?:cụm (?:từ|động từ|danh từ|giới từ|liên từ)|thành ngữ)\s*:\s*", "", m, flags=re.I)
    m = re.sub(r"^(?:danh từ|động từ|tính từ|trạng từ|giới từ|liên từ|đại từ)[^,:]{0,15}[,:]\s*", "", m, flags=re.I)
    m = re.sub(r"\s*\([^)]*$", "", m)  # ngoặc mở không đóng ở cuối
    m = m.strip(" .,:;\"'“”(")
    return m[:1].lower() + m[1:] if m[:1].isupper() and not m[1:2].isupper() else m


def _valid_meaning(m: str) -> bool:
    return bool(m) and len(m) <= 60 and bool(VI_CHARS_RE.search(m)) and not NOT_MEANING_RE.search(m)


def _valid_loose(m: str, word: str) -> bool:
    """Nghĩa ngắn không dấu ("qua", "sau", "trong") vẫn hợp lệ khi nằm trên dòng dịch phương án."""
    return bool(m) and len(m) <= 60 and not NOT_MEANING_RE.search(m) and m.lower() != word.lower()


def parse_option_line(line: str, options: dict, relaxed: bool = False) -> tuple[str, list[str], str] | None:
    """Trả về (chữ cái, loại từ, nghĩa tiếng Việt) nếu dòng là phần giải nghĩa một phương án."""
    m = OPTION_LINE_RE.match(line)
    if not m:
        return None
    letter, rest = m.groups()
    word = (options.get(letter) or "").strip()
    if not word or len(word.split()) > 3:
        return None
    rest = rest.strip().strip("\"'“”")
    low = rest.lower()
    if low.startswith(word.lower()):
        after = rest[len(word):].strip().strip("\"'“”").strip()
        pos: list[str] = []
        meaning = ""
        quoted = re.search(r"nghĩa(?: là)?\s*[\"“']([^\"”']{1,40})[\"”']", after)
        after0 = re.sub(r"^[:\-–—=]\s*", "", after)
        # chỉ xét các ngoặc đứng ngay sau từ, không lấy ngoặc nằm trong câu bình luận phía sau
        lead = re.match(r"^((?:\([^()]*\)\s*)+)", after0)
        tail_text = after0
        if lead:
            tail_text = after0[lead.end():]
            for inner in PAREN_RE.findall(lead.group(1)):
                p = _pos_of(inner)
                _, sep, tail = inner.partition(":")
                if p and (sep or len(inner) <= 25):
                    pos += p
                    if sep and tail.strip():
                        meaning = meaning or tail.strip()
                elif not meaning and not POS_ONLY_RE.fullmatch(inner.strip()):  # "(cụm từ chỉ sự sở hữu)" chỉ là nhãn
                    meaning = inner
        elif re.match(r"^(?:danh từ|động từ|tính từ|trạng từ|giới từ|liên từ|đại từ)", after0, re.I):
            # "- tính từ có nghĩa …" / "trạng từ (xa, rất)": loại từ đứng đầu phần mô tả
            pos = _pos_of(after0[:12])
            inner = [x for x in PAREN_RE.findall(after0) if not _pos_of(x)]
            if inner:
                meaning = inner[0]
        if not meaning and quoted:
            meaning = quoted.group(1)
        if not meaning:
            first = re.split(r"\s+[-–—]\s+", re.sub(r"^[:\-–—=]\s*", "", tail_text.strip()), maxsplit=1)[0]
            meaning = PAREN_RE.sub("", first).strip()
        meaning = _clean_meaning(meaning)
    else:
        # nghĩa tiếng Việt đứng trước, loại từ trong ngoặc
        pos = []
        for inner in PAREN_RE.findall(rest):
            pos += _pos_of(inner)
        meaning = _clean_meaning(PAREN_RE.sub("", rest))
    if not (_valid_meaning(meaning) or (relaxed and _valid_loose(meaning, word))):
        return None
    return letter, sorted(set(pos)), meaning


def gloss_of_line(line: str, options: dict, relaxed: bool = False) -> tuple[str, list[str], str] | None:
    """Nếu dòng là phần dịch một phương án → (chữ cái, loại từ, nghĩa)."""
    m = VOCAB_LINE_RE.match(line)
    if m:
        letter, word, raw = m.groups()
        word = re.sub(r"\s+", " ", word.strip())
        if _norm(options.get(letter, "")) != word.lower():
            return None
        pos, meaning = _parse_meaning(raw)
        meaning = _clean_meaning(meaning)
        ok = _valid_meaning(meaning) or (relaxed and _valid_loose(meaning, word))
        return letter, pos, meaning if ok else ""
    return parse_option_line(line, options, relaxed=relaxed)


# dấu hiệu dòng có kèm lập luận (giữ lại trong giải thích), không chỉ là bản dịch phương án
COMMENT_RE = re.compile(r"\s[-–—]\s+\S|phù hợp|\bvì\b|\bkhông\b|nhưng|cấu trúc|dùng để|là đúng|chính xác|ngữ cảnh", re.I)
OPTION_HEADER_RE = re.compile(r"^\s*(?:dịch\s+)?(?:câu hỏi\s+và\s+)?(?:các\s+)?(?:đáp án|phương án|lựa chọn)[^:\n]{0,40}:\s*$", re.I)


# --- dịch phương án dạng câu (Part 1–4, 6, 7): "A. Anh ấy đang …", "A: To repair (Để sửa …)" ---
SENT_OPTION_RE = re.compile(r"^\s*(?:[-•*]\s*)?(Đáp án\s*)?\(?([A-D])\)?([.:)\-]\s*|\s+)(.+?)\s*$")
# nhận xét dính sau bản dịch: "… là mô tả đúng nhất.", "… không phù hợp.", "… không phải là hình ảnh đúng."
VERDICT_TAIL_RE = re.compile(r"\s*[,;-]?\s*(?:là\s+)?(?:mô tả|câu trả lời|đáp án|lựa chọn)?\s*(?:đúng nhất|chính xác nhất|chính xác|"
                             r"không phù hợp|không đúng|không chính xác|không phải là (?:hình ảnh|mô tả|đáp án) đúng|sai)\.?$", re.I)
NOT_SENT_MEANING_RE = re.compile(
    r"^(?:sai|đúng|không đúng|đáp án|là\b|chính xác)|(?:đúng|sai|là) vì\b|là đúng|là chính xác|không phù hợp|phù hợp (?:nhất|với|vì)|"
    r"được nhắc|không được (?:nhắc|đề cập|nói)|"
    r"đề cập đến trong|giải thích|lý do|^đây\b|không phải|nghĩa là|tức là|ngụ ý|gián tiếp|trả lời câu hỏi|người hỏi|"
    r"người nói(?! chuyện)|câu hỏi|được đề cập|xác nhận rằng|^[\"“]", re.I)
RESIDUAL_OK_RE = re.compile(r"^(?:câu|cụm từ|cụm|đúng|sai|correct|incorrect|đáp án đúng)?$", re.I)


def _simplify(t: str) -> str:
    return re.sub(r"[^\w\s]", "", t.lower().replace("’", "'")).strip()


def _similar(a: str, b: str) -> bool:
    a, b = _simplify(a), _simplify(b)
    return bool(a) and bool(b) and (a == b or SequenceMatcher(None, a, b).ratio() >= 0.85)


def sentence_gloss(line: str, options: dict) -> tuple[str, str, bool] | None:
    """Dòng dịch một phương án dạng câu → (chữ cái, bản dịch, dòng chỉ có bản dịch hay không)."""
    m = SENT_OPTION_RE.match(line)
    if not m:
        return None
    prefix, letter, sep, content = m.groups()
    opt = (options.get(letter) or "").replace("\ufeff", "").strip()
    if not opt:
        return None
    c = content.strip()
    lead = re.match(r"^\(([^()]{1,120})\)\s*[:\-–]\s*\S", c)
    if prefix and not sep.strip() and not lead:
        return None  # "Đáp án C gián tiếp trả lời…": câu nhận xét, không phải bản dịch
    pure = not c.endswith(":")  # "D. has evolved (đã tiến hóa):" → lập luận ở các dòng sau
    tail = VERDICT_TAIL_RE.search(c)
    if tail and not lead and len(c) - len(tail.group(0)) > 3:
        c = c[: tail.start()].rstrip(" ,;-")
        pure = False  # dòng có kèm nhận xét đúng/sai → giữ lại trong giải thích
    if lead:  # "Đáp án A (Kẹo): Sai - Không được nhắc đến." → bản dịch trong ngoặc, giữ dòng (có lập luận)
        meaning, pure = lead.group(1), False
    else:
        cq = c.strip("\"“”'")
        pos = _simplify(cq).find(_simplify(opt)) if _simplify(opt) else -1
        idx = cq.lower().find(opt.lower().rstrip(".?!"))
        if idx >= 0:  # bản gốc nằm trong dòng → phần còn lại (thường trong ngoặc) là bản dịch
            rest = (cq[:idx] + " " + cq[idx + len(opt.rstrip(".?!")):]).strip()
            rest = re.sub(r"^[\"“”'.?!]+|[\"“”']+$", "", rest).strip()
            inner = [x for x in PAREN_RE.findall(rest) if VI_CHARS_RE.search(x)]
            meaning = inner[0] if inner else re.sub(r"^[:\-–=]\s*", "", PAREN_RE.sub("", rest)).strip()
        else:
            parens = PAREN_RE.findall(cq)
            same = [x for x in parens if _similar(x, opt)]
            meaning = PAREN_RE.sub("", cq).strip() if same else cq
        del pos
    meaning = re.sub(r"\((?:đúng|sai|đáp án đúng)\)", "", meaning, flags=re.I).strip().strip("\"“”'").strip()
    meaning = re.sub(r"\s*[-–]\s*(?:câu|cụm từ)$", "", meaning).strip()
    # "Nó mở cửa mỗi ngày: Không đúng, …" → bản dịch là phần trước nhận xét
    parts = re.split(r"\s*:\s*(?=(?:Không|Đúng|Sai|Đây|Chính xác)\b)", meaning, maxsplit=1)
    if len(parts) > 1:
        meaning, pure = parts[0].strip(), False
    if (not meaning or len(meaning) > 220 or not VI_CHARS_RE.search(meaning)
            or NOT_SENT_MEANING_RE.search(meaning) or _similar(meaning, opt)):
        return None
    if pure:  # còn lại gì ngoài chữ cái, bản gốc, bản dịch?
        residual = _simplify(line.replace(meaning, " ").replace(opt.rstrip(".?!"), " "))
        residual = re.sub(r"^\s*(?:đáp án\s*)?[a-d]\b", "", residual).strip()
        pure = bool(RESIDUAL_OK_RE.match(residual))
    return letter, meaning, pure


POS_ONLY_RE = re.compile(r"(?:(?:danh|động|tính|trạng|giới|liên|đại) từ|cụm từ|danh động từ|phân từ)[^,;:]{0,30}", re.I)
WORD_BAD_RE = re.compile(r"không phải|^đây là|đề cập|được nhắc|câu hỏi|người nói(?! chuyện)|người gửi|^là\b", re.I)


def option_line_note(line: str, options: dict) -> tuple[str, list[str], str, bool] | None:
    """Nếu dòng là phần dịch một phương án → (chữ cái, loại từ, nghĩa, dòng chỉ có bản dịch)."""
    m = SENT_OPTION_RE.match(line)
    if m and re.fullmatch(r"\[\d\]", (options.get(m.group(2)) or "").strip()):
        return None  # Part 7 chèn câu: phương án là vị trí [1]–[4], dòng đi kèm là lập luận
    g = gloss_of_line(line, options, relaxed=True)
    if g and g[2] and len((options.get(g[0]) or "").split()) <= 3:
        letter, pos, meaning = g
        # "vào ngày 28 tháng 9: Không phải ngày …" → chỉ lấy phần trước nhận xét
        parts = re.split(r"\s*:\s*(?=(?:Không|Đúng|Sai|Đây)\b)", meaning, maxsplit=1)
        verdict = len(parts) > 1
        meaning = parts[0].strip()
        # "tính từ: không hoạt động" → loại từ + nghĩa
        mp = re.match(r"^((?:danh|động|tính|trạng|giới|liên|đại) từ[^:]{0,15}|cụm từ)\s*:\s*(.+)$", meaning, re.I)
        if mp:
            pos = sorted(set(pos) | set(_pos_of(mp.group(1))))
            meaning = mp.group(2).strip()
        if not meaning or WORD_BAD_RE.search(meaning):
            return None  # thực chất là lập luận ("đây là sức chứa …, không phải …")
        if POS_ONLY_RE.fullmatch(meaning):  # "động từ quá khứ đơn": chỉ có loại từ, không có nghĩa
            pos = sorted(set(pos) | set(_pos_of(meaning)))
            meaning = ""
        rest = re.sub(r"\((?:đúng|sai|đáp án đúng)\)", "", line, flags=re.I)
        rest = rest.replace(meaning, "") if meaning else rest
        rest = PAREN_RE.sub("", rest)  # ghi chú loại từ trong ngoặc: "(đại từ không xác định)"
        pure = not verdict and not COMMENT_RE.search(rest) and not line.rstrip().endswith(":")
        return letter, pos, meaning, pure
    sg = sentence_gloss(line, options)
    if sg:
        letter, meaning, pure = sg
        pos = g[1] if g else []
        if POS_ONLY_RE.fullmatch(meaning):  # "modify (động từ nguyên thể)" → chỉ có loại từ
            pos, meaning = sorted(set(pos) | set(_pos_of(meaning))), ""
        mp = re.match(r"^((?:danh|động|tính|trạng|giới|liên|đại) từ[^:]{0,15}|cụm từ)\s*:\s*(.+)$", meaning, re.I)
        if mp:  # "tính từ: không hoạt động" → loại từ + nghĩa
            pos = sorted(set(pos) | set(_pos_of(mp.group(1))))
            meaning = mp.group(2).strip()
        tail = re.search(r"\s*\(([^()]*\b(?:danh|động|tính|trạng|giới|liên|đại) từ[^()]*)\)\s*$", meaning)
        if tail:  # "Một món đồ quần áo (danh từ chỉ vật dụng)" → nhãn loại từ tách ra
            pos = sorted(set(pos) | set(_pos_of(tail.group(1))))
            meaning = meaning[: tail.start()].strip()
        return letter, pos, meaning, pure
    return None


QUESTION_LINE_RE = re.compile(r"^\s*(?:[-•*]\s*)?(?:\[Dịch\]\s*)?(?:Dịch\s+)?(?:câu hỏi|question)\s*:\s*(.+?)\s*$", re.I)
QUESTION_VI_PARTS = (2, 3, 4, 7)


def question_line_vi(line: str, question: str) -> tuple[str, bool] | None:
    """Dòng dịch câu hỏi → (bản dịch, dòng chỉ có bản dịch hay không)."""
    m = QUESTION_LINE_RE.match(line)
    if not m:
        return None
    c = m.group(1).strip()
    if not VI_CHARS_RE.search(c):
        return None
    en = question.strip()
    if en and _simplify(en) and _simplify(en) in _simplify(c):
        # "Question: Why did …? (Tại sao …?)" → bản dịch trong ngoặc
        inner = [x for x in PAREN_RE.findall(c) if VI_CHARS_RE.search(x)]
        vi = inner[-1] if inner else c.replace(en, "")
    else:
        parens = [x for x in PAREN_RE.findall(c) if _similar(x, en)]
        vi = PAREN_RE.sub("", c) if parens else c
    vi = vi.strip().strip("\"“”'").strip()
    if not vi or len(vi) > 250 or not VI_CHARS_RE.search(vi) or re.search(r"đáp án|giải thích", vi, re.I):
        return None
    residual = _simplify(c.replace(vi, " ").replace(en, " "))
    return vi, residual == ""


def apply_option_notes(q: dict) -> None:
    """Nghĩa (+ loại từ nếu là từ/cụm ngắn) của từng phương án → q["optionNotes"];
    bỏ khỏi giải thích các dòng chỉ để dịch phương án."""
    lines = q["explanation"].split("\n")
    notes: dict[str, dict] = {}
    drop: set[int] = set()
    for i, line in enumerate(lines):
        # bản dịch câu hỏi (Part 2, 3, 4, 7) → q["questionVi"]
        if q.get("part") in QUESTION_VI_PARTS:
            qv = question_line_vi(line, q.get("question", ""))
            if qv:
                if "questionVi" not in q:
                    q["questionVi"] = qv[0]
                if qv[1]:
                    drop.add(i)
                continue
        n = option_line_note(line, q["options"])
        if not n:
            continue
        letter, pos, meaning, pure = n
        if not meaning and not pos:
            continue
        if letter not in notes:
            notes[letter] = {"pos": pos, "meaning": meaning}
        else:  # bổ sung phần còn thiếu từ dòng sau ("Đáp án A: qua (giới từ)")
            if not notes[letter]["pos"] and pos:
                notes[letter]["pos"] = pos
            if not notes[letter]["meaning"] and meaning:
                notes[letter]["meaning"] = meaning
        if pure:
            drop.add(i)
    # tiêu đề "Dịch đáp án:" / "Đáp án:" mà cả mục bên dưới đã bị bỏ
    for i, line in enumerate(lines):
        if i in drop or not OPTION_HEADER_RE.match(line):
            continue
        j = i + 1
        body = []
        while j < len(lines) and lines[j].strip():
            body.append(j)
            j += 1
        if body and all(k in drop for k in body):
            drop.add(i)
    kept = [l for i, l in enumerate(lines) if i not in drop]
    q["explanation"] = re.sub(r"\n{3,}", "\n\n", "\n".join(kept)).strip()
    q["optionNotes"] = notes


def _option_glosses(q: dict, part: int):
    """(chữ cái, từ, loại từ, nghĩa) của các phương án: Part 5 lấy từ optionNotes, Part 6 đọc dòng giải thích."""
    if part in (5, 6) and "optionNotes" in q:
        for letter, n in q["optionNotes"].items():
            word = re.sub(r"\s+", " ", (q["options"].get(letter) or "").strip())
            if word and n["meaning"]:
                yield letter, word, n["pos"], n["meaning"]
        return
    for line in q.get("explanation", "").split("\n"):
        g = gloss_of_line(line, q["options"])
        if g and g[2]:
            yield g[0], re.sub(r"\s+", " ", q["options"][g[0]].strip()), g[1], g[2]


def _collect_forms(tests: list[dict], source_only: frozenset[str] = frozenset()) -> list[dict]:
    """Từng dạng từ (chưa gộp) kèm nghĩa, lấy từ dòng giải thích phương án Part 5–6.
    source_only: đề chỉ góp nghĩa, không lấy câu ví dụ (đề không xuất ra)."""
    entries: dict[str, dict] = {}
    for t in tests:
        for p in t["parts"]:
            if p["part"] not in (5, 6):
                continue
            for g in p["groups"]:
                for q in g["questions"]:
                    tags = q.get("tags") or tag_question(q)
                    vocab_q = p["part"] == 5 and "vocabulary" in tags
                    for letter, word, pos, meaning in _option_glosses(q, p["part"]):
                        if len(word.split()) > 3:
                            continue
                        key = word.lower().replace("’", "'")
                        if key in SKIP_WORDS or len(key) < 2:
                            continue
                        # bỏ các dạng chia động từ nhiều từ ("is being hired", "to run") — không phải mục từ vựng
                        if len(key.split()) > 1 and key.split()[0] in AUX_START:
                            continue
                        meaning = _clean_meaning(meaning)
                        if meaning and not _valid_meaning(meaning):
                            meaning = ""
                        e = entries.setdefault(key, {"w": word.lower() if not word.isupper() else word, "pos": set(),
                                                     "meanings": [], "freq": 0, "examples": [], "_seen": set(),
                                                     "_occ": set(), "_vq": set()})
                        e["pos"].update(pos)
                        if meaning and meaning.lower() not in (m_.lower() for m_ in e["meanings"]) and len(e["meanings"]) < 3:
                            e["meanings"].append(meaning)
                        # từ được đưa vào bộ thẻ của đề: cả 4 phương án câu hỏi từ vựng Part 5 (chính là từ ETS kiểm tra);
                        # câu từ loại / liên từ–giới từ Part 5 và câu Part 6: chỉ đáp án đúng;
                        # câu đại từ, chia động từ, so sánh…: không lấy (là bài ngữ pháp, không phải từ cần học).
                        # Mọi phương án vẫn góp nghĩa cho từ điển.
                        if (t["id"], q["number"]) not in e["_occ"]:
                            e["_occ"].add((t["id"], q["number"]))
                            e["freq"] += 1
                        if vocab_q:
                            e["_vq"].add(t["id"])
                        is_answer = letter == q.get("answer")
                        if vocab_q or (is_answer and (p["part"] == 6 or {"word-form", "prep-conj"} & set(tags))):
                            e["_seen"].add((t["id"], q["number"]))
                        # câu ví dụ: chỉ lấy Part 5 khi từ này là đáp án đúng → điền vào chỗ trống
                        if (p["part"] == 5 and q.get("answer") == letter and len(e["examples"]) < 2
                                and t["id"] not in source_only
                                and BLANK_RE.search(q.get("question", ""))):
                            sent = BLANK_RE.sub(q["options"][letter], q["question"], count=1)
                            sent = re.sub(r"\s+([,.;:?!])", r"\1", re.sub(r"\s+", " ", sent)).strip()
                            e["examples"].append({"text": sent, "testId": t["id"], "number": q["number"]})
    out = []
    for e in entries.values():
        if not e["meanings"]:
            continue
        # các đề / câu có từ này (để chia từ vựng theo đề): {"testId": [số câu, ...]}
        by_test: dict[str, list[int]] = defaultdict(list)
        for tid, num in sorted(e.pop("_seen")):
            by_test[tid].append(num)
        e["tests"] = dict(by_test)
        e["vq"] = sorted(e.pop("_vq"))  # các đề có từ này làm phương án câu hỏi từ vựng
        del e["_occ"]
        e["pos"] = sorted(e["pos"])
        out.append(e)
    out.sort(key=lambda e: (-e["freq"], e["w"]))
    return out


# ---------------------------------------------------------------------------
# Gộp biến thể về từ gốc, họ từ, từ cơ bản, từ trong phần nghe
# ---------------------------------------------------------------------------
BASIC_WORDS = {
    w.lower()
    for line in (Path(__file__).with_name("basic_words.txt")).read_text(encoding="utf-8").splitlines()
    if not line.lstrip().startswith("#")
    for w in line.split()
}
try:  # danh sách từ tiếng Anh của hệ thống (macOS/Linux) — chỉ dùng để xác nhận từ gốc có thật
    DICT_WORDS = {w.strip().lower() for w in open("/usr/share/dict/words", encoding="utf-8")}
except OSError:
    DICT_WORDS = set()

# danh từ đuôi -ing / -s mang nghĩa riêng: không gộp về động từ gốc
KEEP_SEPARATE = {
    "news", "goods", "savings", "earnings", "belongings", "proceeds", "headquarters", "series", "means", "species",
    "clothes", "glasses", "premises", "customs", "sales", "arms", "outskirts", "surroundings", "findings", "proceedings",
    "holdings", "building", "meeting", "marketing", "advertising", "accounting", "housing", "funding", "training",
    "opening", "setting", "booking", "listing", "shipping", "parking", "seating", "catering", "clothing", "offering",
    "warning", "painting", "recording", "beginning", "morning", "evening", "ceiling", "feeling", "understanding",
    "gathering", "wedding", "timing", "pricing", "staffing", "outing", "heading", "filing", "spending", "planning",
    "landscaping", "engineering", "manufacturing", "programming", "banking", "lighting", "flooring", "plumbing",
    "packaging", "boarding", "lodging", "dining", "cleaning", "printing", "fitting", "hearing", "being", "thing",
    "nothing", "something", "anything", "everything", "during", "including", "regarding", "following", "according",
    "pending", "interesting", "amazing", "exciting", "outstanding", "leading", "missing", "remaining", "existing",
    "upcoming", "ongoing", "willing", "detailed", "limited", "qualified", "experienced", "interested", "advanced",
    "skilled", "used", "united", "related", "dedicated", "complicated", "sophisticated", "assorted", "authorized",
}
TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z'’-]*[A-Za-z]")
SENT_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z\"“])")


IRREGULAR = {
    "going": "go", "went": "go", "gone": "go", "being": "be", "been": "be", "was": "be", "were": "be",
    "having": "have", "had": "have", "doing": "do", "did": "do", "done": "do", "made": "make", "found": "find",
    "sent": "send", "thought": "think", "taken": "take", "took": "take", "given": "give", "gave": "give",
    "bought": "buy", "sold": "sell", "seen": "see", "saw": "see", "heard": "hear", "held": "hold",
    "brought": "bring", "left": "leave", "came": "come", "said": "say", "told": "tell", "knew": "know",
    "known": "know", "wrote": "write", "written": "write", "spoke": "speak", "spoken": "speak", "began": "begin",
    "begun": "begin", "chose": "choose", "chosen": "choose", "built": "build", "kept": "keep", "paid": "pay",
    "met": "meet", "ran": "run", "felt": "feel", "led": "lead", "lost": "lose", "won": "win", "spent": "spend",
    "taught": "teach", "caught": "catch", "understood": "understand", "stood": "stand", "drove": "drive",
    "driven": "drive", "rose": "rise", "risen": "rise", "fell": "fall", "fallen": "fall", "broke": "break",
    "broken": "break", "grew": "grow", "grown": "grow", "threw": "throw", "thrown": "throw", "wore": "wear",
    "worn": "wear", "ate": "eat", "eaten": "eat", "drew": "draw", "drawn": "draw", "forgot": "forget",
    "forgotten": "forget", "hung": "hang", "laid": "lay", "lent": "lend", "sought": "seek", "shown": "show",
    "flew": "fly", "flown": "fly", "sat": "sit", "slept": "sleep", "sang": "sing", "sung": "sing", "swam": "swim",
    "dealt": "deal", "meant": "mean", "overseen": "oversee", "oversaw": "oversee", "undertook": "undertake",
    "undertaken": "undertake", "withdrew": "withdraw", "withdrawn": "withdraw", "forecast": "forecast",
    "children": "child", "men": "man", "women": "woman", "people": "person", "better": "good", "best": "good",
}


def _bases(w: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    if len(w) <= 4:  # need, seed, red… không phải dạng chia
        return out
    if w.endswith("ies"):
        out.append((w[:-3] + "y", "s"))
    if w.endswith("es"):
        out.append((w[:-2], "s"))
    if w.endswith("s") and not w.endswith("ss"):
        out.append((w[:-1], "s"))
    if w.endswith("ied"):
        out.append((w[:-3] + "y", "ed"))
    if w.endswith("ed"):
        out += [(w[:-2], "ed"), (w[:-1], "ed")]
        if len(w) > 4 and w[-3] == w[-4]:
            out.append((w[:-3], "ed"))
    if w.endswith("ing"):
        out += [(w[:-3], "ing"), (w[:-3] + "e", "ing")]
        if len(w) > 5 and w[-4] == w[-5]:
            out.append((w[:-4], "ing"))
    if w.endswith("ier") or w.endswith("iest"):
        out.append((re.sub(r"i(?:er|est)$", "y", w), "er"))
    for suf in ("er", "est"):
        if w.endswith(suf):
            out += [(w[: -len(suf)], "er"), (w[: -len(suf)] + "e", "er")]
    return [(b, k) for b, k in out if len(b) >= 3 and b != w]


def _compatible(kind: str, wpos: set[str], bpos: set[str]) -> bool:
    if kind == "s":
        return not bpos or bool(bpos & {"n", "v"})
    if kind in ("ed", "ing"):
        return not bpos or "v" in bpos
    return not bpos or "adj" in bpos or "adv" in bpos  # so sánh hơn / nhất


def lemma_of(word: str, known: dict[str, set[str]]) -> str:
    """Từ gốc của một dạng từ. known: dạng từ đã có trong từ điển → loại từ."""
    if " " in word or word in KEEP_SEPARATE:
        return word
    if word in IRREGULAR:
        return IRREGULAR[word]
    wpos = known.get(word, set())
    for base, kind in _bases(word):
        if base in known and _compatible(kind, wpos, known[base]):
            return base
    for base, kind in _bases(word):
        if base in BASIC_WORDS and kind != "er":  # asked → ask, using → use, carrying → carry
            return base
    for base, kind in _bases(word):
        if len(base) >= 4 and base in DICT_WORDS and (
            (kind == "s" and (not wpos or wpos & {"n", "v"})) or (kind in ("ed", "ing") and "v" in wpos)
        ):
            return base
    return word


# hậu tố tạo từ → cách khôi phục từ gốc (thử lần lượt)
_DERIV_RULES: list[tuple[str, list[str]]] = [
    ("ically", ["ic", "ical"]), ("ility", ["le", "ile"]), ("iness", ["y"]), ("ily", ["y"]), ("ication", ["y", "ify"]),
    ("ation", ["e", "", "ate"]), ("ition", ["", "e"]), ("tion", ["te", "e", "", "t"]), ("sion", ["d", "de", "t", "se", "s"]),
    ("ment", [""]), ("ness", [""]), ("ity", ["", "e"]), ("ful", [""]), ("less", [""]), ("able", ["", "e", "ate"]),
    ("ible", ["", "e"]), ("ial", ["", "y"]), ("al", ["", "e"]), ("ive", ["e", "", "ion"]), ("ance", ["", "e"]),
    ("ence", ["", "e", "ent"]), ("ancy", ["ant"]), ("ency", ["ent"]), ("ant", ["", "e"]), ("ent", ["", "e"]),
    ("ize", ["", "e"]), ("ise", ["", "e"]), ("ist", ["", "y"]), ("er", ["", "e"]), ("or", ["", "e"]), ("ee", ["", "e"]),
    ("ure", ["", "e"]), ("ous", ["", "e", "y"]), ("ary", [""]), ("ship", [""]), ("ly", ["", "le", "e"]),
]


def _derivation_stems(w: str) -> list[str]:
    out = []
    for suf, repls in _DERIV_RULES:
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            base = w[: -len(suf)]
            out += [base + r for r in repls]
            if len(base) > 2 and base[-1] == base[-2]:  # chữ cái nhân đôi: forgettable → forget
                out.append(base[:-1])
    return out


def build_vocab(
    tests: list[dict], source_only: frozenset[str] = frozenset(), group_words: dict | None = None
) -> list[dict]:
    """group_words (nếu truyền vào) nhận từ của từng đoạn Part 3/4: {(id đề, câu đầu): [{term, pos, meaning}, …]}
    — dùng cho tab "Từ vựng" khi xem lại câu hỏi, rộng hơn bộ thẻ học."""
    forms = _collect_forms(tests, source_only)
    known = {f["w"]: set(f["pos"]) for f in forms}
    lemma_map = {f["w"]: lemma_of(f["w"], known) for f in forms}
    # lemma của lemma (vd lasted → last → last)
    for k, v in lemma_map.items():
        while lemma_map.get(v, v) != v:
            v = lemma_map[v]
        lemma_map[k] = v

    entries: dict[str, dict] = {}
    for f in forms:
        lemma = lemma_map[f["w"]]
        e = entries.setdefault(lemma, {"w": lemma, "pos": [], "meanings": [], "forms": [], "family": [],
                                       "basic": False, "freq": 0, "examples": [], "tests": {}, "_vq": set()})
        e["_vq"].update(f["vq"])
        if f["w"] == lemma:
            e["pos"], e["meanings"] = f["pos"], f["meanings"]
        else:
            e["forms"].append({"w": f["w"], "pos": f["pos"], "meanings": f["meanings"]})
        for ex in f["examples"]:
            if len(e["examples"]) < 3:
                e["examples"].append(ex)
        for tid, nums in f["tests"].items():
            r = e["tests"].setdefault(tid, {}).setdefault("r", [])
            r.extend(n for n in nums if n not in r)
    for e in entries.values():
        if not e["meanings"] and e["forms"]:  # từ gốc không xuất hiện trực tiếp trong đề → mượn nghĩa của biến thể đầu
            e["pos"], e["meanings"] = e["forms"][0]["pos"], e["forms"][0]["meanings"]
        e["forms"].sort(key=lambda x: x["w"])
        e["basic"] = e["w"] in BASIC_WORDS or IRREGULAR.get(e["w"]) in BASIC_WORDS

    # họ từ: các phương án cùng gốc trong một câu hỏi "từ loại" Part 5
    parent: dict[str, str] = {}

    def find(x: str) -> str:
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for t in tests:
        for p in t["parts"]:
            if p["part"] != 5:
                continue
            for g in p["groups"]:
                for q in g["questions"]:
                    if "word-form" not in q.get("tags", []):
                        continue
                    lem = [lemma_map.get(_norm(o), lemma_of(_norm(o), known)) for o in q["options"].values() if o]
                    lem = [x for x in lem if x in entries and " " not in x]
                    for a in lem[1:]:
                        if _common_prefix([a, lem[0]]) >= 4:
                            parent[find(a)] = find(lem[0])
    # họ từ theo quy tắc tạo từ: decide → decision, decisive, decisively …
    single = {w for w in entries if " " not in w}
    for w in single:
        for stem in _derivation_stems(w):
            if stem in single and stem != w and len(stem) >= 4:
                parent[find(w)] = find(stem)
                break
    groups: dict[str, list[str]] = defaultdict(list)
    for w in entries:
        if w in parent:
            groups[find(w)].append(w)
    for members in groups.values():
        if len(members) > 12:  # nhóm quá lớn thường là ghép nhầm → bỏ
            continue
        for w in members:
            entries[w]["family"] = sorted(m for m in members if m != w)

    # "dạng khác của từ": các từ cùng họ + dạng -ing/-ed dùng như tính từ / danh từ (lasting, qualified …)
    POS_ORDER = {"n": 0, "v": 1, "adj": 2, "adv": 3, "prep": 4, "conj": 5, "pron": 6}
    for e in entries.values():
        related = [{"w": m, "pos": entries[m]["pos"], "meanings": entries[m]["meanings"][:2]} for m in e["family"]]
        for f in e["forms"]:
            if f["w"].endswith(("ing", "ed")) and set(f["pos"]) & {"adj", "n"} and f["meanings"]:
                pos = [x for x in f["pos"] if x in ("adj", "n")]
                if f["w"] not in e["family"]:
                    related.append({"w": f["w"], "pos": pos, "meanings": f["meanings"][:2]})
        related = [r for r in related if r["meanings"]]
        related.sort(key=lambda r: (min((POS_ORDER.get(x, 9) for x in r["pos"]), default=9), r["w"]))
        e["related"] = related
        # biến thể chỉ giữ lại tên để tô đậm trong câu ví dụ, không hiển thị
        e["inflections"] = [f["w"] for f in e["forms"]]
        del e["forms"]
        del e["family"]

    # từ trong phần nghe (Part 1–4): chỉ lấy "từ TOEIC hay hỏi" — từng là phương án câu hỏi từ vựng Part 5
    # ở ít nhất CORE_MIN_TESTS đề, không phải từ cơ bản. Lấy mọi từ có trong từ điển thì mỗi đề có vài trăm từ,
    # đa phần là từ dễ (order, recently, however…) không cần học.
    core = {w for w, e in entries.items() if len(e["_vq"]) >= CORE_MIN_TESTS and not e["basic"]}
    token_lemma: dict[str, str | None] = {}

    def to_entry(tok: str) -> str | None:
        """từ gốc có trong từ điển (không cơ bản) — chưa xét có thuộc "từ hay hỏi" không"""
        if tok not in token_lemma:
            lem = lemma_map.get(tok) or lemma_of(tok, known)
            lem = lemma_map.get(lem, lem)
            ok = lem in entries and not entries[lem]["basic"] and lem not in BASIC_WORDS and tok not in BASIC_WORDS
            token_lemma[tok] = lem if ok else None
        return token_lemma[tok]

    hits: dict[tuple[str, int], list[str]] = {}  # từ (có trong từ điển) của từng đoạn Part 3/4, theo thứ tự xuất hiện

    listen_example: dict[str, dict] = {}
    for t in tests:
        for p in t["parts"]:
            if p["part"] > 4:
                continue
            for g in p["groups"]:
                n0 = g["questionNumbers"][0]
                texts = [ps["en"] for ps in g["passages"] if ps.get("en")]
                for q in g["questions"]:
                    texts.append(q.get("question", "") if p["part"] == 2 else "")
                    if p["part"] <= 2:
                        texts += [o for o in q["options"].values() if o]
                for text in texts:
                    for sent in SENT_SPLIT_RE.split(re.sub(r"\s+", " ", text.replace("**", ""))):
                        for tok in TOKEN_RE.findall(sent):
                            lem = to_entry(tok.lower().replace("’", "'"))
                            if not lem:
                                continue
                            if p["part"] in (3, 4):
                                h = hits.setdefault((t["id"], n0), [])
                                if lem not in h:
                                    h.append(lem)
                            if lem not in core:
                                continue
                            ls = entries[lem]["tests"].setdefault(t["id"], {}).setdefault("l", [])
                            if n0 not in ls:
                                ls.append(n0)
                            if lem not in listen_example and 30 <= len(sent) <= 220 and t["id"] not in source_only:
                                listen_example[lem] = {"text": sent.strip(), "testId": t["id"], "number": n0, "part": p["part"]}
    # mục "Từ vựng" trong giải thích Part 3/4: chỉ bổ sung nghĩa cho từ đã có; danh sách này vẫn hiện trong tab
    # "Từ vựng" khi xem lại câu hỏi, nhưng không đưa vào bộ thẻ của đề (quá dài, nhiều cụm ghép đơn giản)
    for t in tests:
        for p in t["parts"]:
            if p["part"] not in (3, 4):
                continue
            for g in p["groups"]:
                n0 = g["questionNumbers"][0]
                script = " ".join(ps["en"] for ps in g["passages"] if ps.get("en"))
                for item in g.get("vocab", []):
                    term = item["term"].lower().replace("’", "'")
                    if "=" in term or len(term.split()) > 4 or term in BASIC_WORDS:
                        continue
                    lem = term if " " in term else lemma_map.get(term) or lemma_of(term, known)
                    lem = lemma_map.get(lem, lem)
                    if lem in BASIC_WORDS:
                        continue
                    e = entries.get(lem)
                    if e is None:
                        e = entries[lem] = {"w": lem, "pos": item["pos"], "meanings": [], "related": [], "inflections": [],
                                            "basic": False, "freq": 0, "examples": [], "tests": {}}
                    if e["basic"]:
                        continue
                    if len(e["meanings"]) < 3 and item["meaning"].lower() not in (x.lower() for x in e["meanings"]):
                        e["meanings"].append(item["meaning"])
                    if not e["pos"] and item["pos"]:
                        e["pos"] = item["pos"]
                    if lem in core and lem not in listen_example and t["id"] not in source_only:
                        for sent in SENT_SPLIT_RE.split(re.sub(r"\s+", " ", script.replace("**", ""))):
                            if term in sent.lower() and 20 <= len(sent) <= 240:
                                listen_example[lem] = {"text": sent.strip(), "testId": t["id"], "number": n0, "part": p["part"]}
                                break

    if group_words is not None:
        for key, lems in hits.items():
            group_words[key] = [
                {"term": w, "pos": entries[w]["pos"], "meaning": "; ".join(entries[w]["meanings"][:2])}
                for w in lems
                if entries[w]["meanings"]
            ]

    out = []
    for e in entries.values():
        e.pop("_vq", None)
        if not e["tests"]:  # không thuộc bộ thẻ của đề nào → không xuất ra
            continue
        if e["w"] in listen_example:
            e["listenExample"] = listen_example[e["w"]]
        for v in e["tests"].values():
            for k in v:
                v[k].sort()
        e["freq"] = len(e["tests"])
        out.append(e)
    out.sort(key=lambda e: (-e["freq"], e["w"]))
    return out


# ---------------------------------------------------------------------------
# Ngân hàng câu theo dạng (dùng cho trang "Luyện theo dạng")
# ---------------------------------------------------------------------------
def build_bank(tests: list[dict]) -> tuple[list[dict], dict[tuple[int, str], list[dict]]]:
    banks: dict[tuple[int, str], list[dict]] = defaultdict(list)
    for t in tests:
        for p in t["parts"]:
            if p["part"] not in TAG_LABELS:
                continue
            for g in p["groups"]:
                for q in g["questions"]:
                    for tag in q.get("tags", []):
                        banks[(p["part"], tag)].append({"testId": t["id"], "testTitle": t["title"], "group": g})
    index = []
    for part, labels in TAG_LABELS.items():
        for tag, label in labels.items():
            items = banks.get((part, tag), [])
            index.append({
                "part": part,
                "tag": tag,
                "label": label,
                "count": len(items),
                # "testId:số câu:đáp án" — để tính tỉ lệ đúng theo dạng ở phía client
                "keys": [f"{it['testId']}:{it['group']['questionNumbers'][0]}:{it['group']['questions'][0]['answer'] or ''}"
                         for it in items],
            })
    return index, banks


def write_extras(tests: list[dict], out_dir: Path, dictionary_tests: list[dict] | None = None) -> dict:
    """dictionary_tests: thêm đề chỉ dùng để lấy nghĩa từ (không xuất ra) — từ điển chỉ giữ tham chiếu tới `tests`."""
    index, banks = build_bank(tests)
    bank_dir = out_dir / "bank"
    bank_dir.mkdir(parents=True, exist_ok=True)
    for old in bank_dir.glob("*.json"):
        old.unlink()
    for (part, tag), items in banks.items():
        (bank_dir / f"p{part}-{tag}.json").write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
    (bank_dir / "index.json").write_text(json.dumps(index, ensure_ascii=False), encoding="utf-8")
    keep = {t["id"] for t in tests}
    source_only = frozenset(t["id"] for t in dictionary_tests or [] if t["id"] not in keep)
    group_words: dict[tuple[str, int], list[dict]] = {}
    vocab = build_vocab(dictionary_tests or tests, source_only, group_words)
    if source_only:  # bỏ tham chiếu tới đề không xuất ra; từ chỉ có ở các đề đó thì bỏ luôn
        for e in vocab:
            e["tests"] = {k: v for k, v in e["tests"].items() if k in keep}
        vocab = [e for e in vocab if e["tests"]]
    (out_dir / "vocab.json").write_text(json.dumps(vocab, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    fill_group_vocab(tests, group_words)
    return {"tags": {f"p{i['part']}-{i['tag']}": i["count"] for i in index}, "vocab": len(vocab)}


AUTO_VOCAB_LIMIT = 12
# "từ TOEIC hay hỏi": từng là phương án câu hỏi từ vựng Part 5 ở ít nhất bấy nhiêu đề
CORE_MIN_TESTS = 3


def fill_group_vocab(tests: list[dict], group_words: dict[tuple[str, int], list[dict]]) -> None:
    """Đoạn Part 3/4 không có mục "Từ vựng" trong giải thích: lấy các từ (không cơ bản) của từ điển
    xuất hiện trong lời thoại, theo thứ tự xuất hiện (tab "Từ vựng" khi xem lại câu — không phải bộ thẻ học)."""
    for t in tests:
        for p in t["parts"]:
            if p["part"] not in (3, 4):
                continue
            for g in p["groups"]:
                if g.get("vocab"):
                    continue
                g["vocab"] = group_words.get((t["id"], g["questionNumbers"][0]), [])[:AUTO_VOCAB_LIMIT]
                g["vocabAuto"] = True

if __name__ == "__main__":
    root = Path(__file__).resolve().parent.parent
    tests = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((root / "content" / "tests").glob("20*.json"))]
    for t in tests:
        for p in t["parts"]:
            for g in p["groups"]:
                for q in g["questions"]:
                    q["tags"] = tag_question(q)
    idx, _ = build_bank(tests)
    for i in idx:
        print(f"P{i['part']} {i['tag']:<14} {i['count']:>5}  {i['label']}")
    v = build_vocab(tests)
    print("vocab", len(v), Counter(p for e in v for p in e["pos"]))
    for e in v[:5] + v[200:203] + v[1500:1503]:
        print(" ", e["w"], e["pos"], e["meanings"], e["freq"], e["examples"][:1])
