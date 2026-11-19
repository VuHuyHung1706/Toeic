"""Làm giàu dữ liệu sau ETL: gắn nhãn dạng câu (Part 2, Part 5) và trích từ vựng.

Được gọi từ scripts/etl.py; có thể chạy riêng để xem thống kê:
    python3 scripts/enrich.py
"""
from __future__ import annotations

import json
import re
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


def build_vocab(tests: list[dict]) -> list[dict]:
    entries: dict[str, dict] = {}
    for t in tests:
        for p in t["parts"]:
            if p["part"] not in (5, 6):
                continue
            for g in p["groups"]:
                for q in g["questions"]:
                    for line in q.get("explanation", "").split("\n"):
                        m = VOCAB_LINE_RE.match(line)
                        if not m:
                            continue
                        letter, word, raw = m.groups()
                        word = re.sub(r"\s+", " ", word.strip())
                        if _norm(q["options"].get(letter, "")) != word.lower() or len(word.split()) > 3:
                            continue
                        key = word.lower().replace("’", "'")
                        if key in SKIP_WORDS or len(key) < 2:
                            continue
                        pos, meaning = _parse_meaning(raw)
                        e = entries.setdefault(key, {"w": word.lower() if not word.isupper() else word, "pos": set(),
                                                     "meanings": [], "freq": 0, "examples": [], "_seen": set()})
                        e["pos"].update(pos)
                        if meaning and meaning.lower() not in (m_.lower() for m_ in e["meanings"]) and len(e["meanings"]) < 3:
                            e["meanings"].append(meaning)
                        src = (t["id"], q["number"])
                        if src not in e["_seen"]:
                            e["_seen"].add(src)
                            e["freq"] += 1
                        # câu ví dụ: chỉ lấy Part 5 khi từ này là đáp án đúng → điền vào chỗ trống
                        if (p["part"] == 5 and q.get("answer") == letter and len(e["examples"]) < 2
                                and BLANK_RE.search(q.get("question", ""))):
                            sent = BLANK_RE.sub(q["options"][letter], q["question"], count=1)
                            sent = re.sub(r"\s+([,.;:?!])", r"\1", re.sub(r"\s+", " ", sent)).strip()
                            e["examples"].append({"text": sent, "testId": t["id"], "number": q["number"]})
    out = []
    for e in entries.values():
        if not e["meanings"]:
            continue
        e.pop("_seen")
        e["pos"] = sorted(e["pos"])
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


def write_extras(tests: list[dict], out_dir: Path) -> dict:
    index, banks = build_bank(tests)
    bank_dir = out_dir / "bank"
    bank_dir.mkdir(parents=True, exist_ok=True)
    for old in bank_dir.glob("*.json"):
        old.unlink()
    for (part, tag), items in banks.items():
        (bank_dir / f"p{part}-{tag}.json").write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
    (bank_dir / "index.json").write_text(json.dumps(index, ensure_ascii=False), encoding="utf-8")
    vocab = build_vocab(tests)
    (out_dir / "vocab.json").write_text(json.dumps(vocab, ensure_ascii=False, indent=0), encoding="utf-8")
    return {"tags": {f"p{i['part']}-{i['tag']}": i["count"] for i in index}, "vocab": len(vocab)}


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
