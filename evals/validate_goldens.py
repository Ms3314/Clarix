"""Validate draft goldens against the extracted corpus.

Usage: python3 -m evals.validate_goldens evals/goldens/drafts/ch19.jsonl [...]
"""
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

CORPUS = Path(__file__).resolve().parent / "corpus"

QUERY_TYPES = {"definition", "mechanism_why", "compare", "worked_problem", "code_api",
               "false_premise", "application", "cross_chapter", "unanswerable"}
STYLES = {"textbook", "casual", "messy"}
STOPWORDS = set("""a an the of to in on for and or is are was were be been it its this that these those
with as by at from what why how does do did i my me so if when which who can could would should
not no yes about into than then there their they them you your we our us vs versus""".split())


def normalize(text: str) -> str:
    """Shared normalization for quote validation and eval-time chunk matching."""
    text = unicodedata.normalize("NFKC", text)
    # Drop hyphens entirely: line-wrap hyphenation and real compounds then compare equal.
    text = re.sub(r"-\s*", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip().lower()


def content_tokens(text: str) -> list:
    return [t for t in re.findall(r"[a-z0-9]+", normalize(text)) if t not in STOPWORDS]


def overlap(question: str, quotes: list) -> float:
    """Share of the question's content words that appear in the evidence."""
    q = content_tokens(question)
    ev = set(content_tokens(" ".join(quotes)))
    return sum(t in ev for t in q) / len(q) if q else 0.0


def shared_trigram(question: str, quotes: list) -> bool:
    q = content_tokens(question)
    ev = content_tokens(" ".join(quotes))
    ev_tri = {tuple(ev[i:i + 3]) for i in range(len(ev) - 2)}
    return any(tuple(q[i:i + 3]) in ev_tri for i in range(len(q) - 2))


def validate(path: Path, pages: dict) -> list:
    rows, errors = [], []
    for n, line in enumerate(path.read_text().splitlines(), start=1):
        if not line.strip():
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError as e:
            errors.append(f"line {n}: bad JSON ({e})")
    seen_quotes = {}
    shared = []
    for g in rows:
        gid = g.get("id", "?")
        for field in ("id", "input", "expected_output", "evidence", "query_type", "style"):
            if not g.get(field) and not (field == "evidence" and g.get("query_type") == "unanswerable"):
                errors.append(f"{gid}: missing {field}")
        if g.get("query_type") not in QUERY_TYPES:
            errors.append(f"{gid}: bad query_type {g.get('query_type')}")
        if g.get("style") not in STYLES:
            errors.append(f"{gid}: bad style {g.get('style')}")
        quotes = []
        own_quotes = set()
        for ev in g.get("evidence", []):
            page_text = pages.get(str(ev.get("page")))
            quote = ev.get("quote", "")
            quotes.append(quote)
            if page_text is None:
                errors.append(f"{gid}: page {ev.get('page')} not in corpus")
            elif normalize(quote) not in normalize(page_text):
                errors.append(f"{gid}: quote not found on page {ev['page']}: {quote[:70]!r}")
            if not 40 <= len(quote) <= 400:
                errors.append(f"{gid}: quote length {len(quote)} outside 40-400")
            key = normalize(quote)
            if key in own_quotes:
                errors.append(f"{gid}: quote repeated within the golden")
            elif key in seen_quotes:
                # Two goldens may legitimately share a supporting sentence; report, don't fail.
                shared.append(f"{gid} shares a quote with {seen_quotes[key]}")
            own_quotes.add(key)
            seen_quotes.setdefault(key, gid)
        g["_overlap"] = round(overlap(g.get("input", ""), quotes), 2) if quotes else None
        if quotes and shared_trigram(g.get("input", ""), quotes):
            errors.append(f"{gid}: question shares a 3-word phrase with evidence")
    for note in shared:
        print("  note:", note)
    return rows, errors


def main(paths):
    pages = json.loads((CORPUS / "pages.json").read_text())
    total_err = 0
    for p in map(Path, paths):
        rows, errors = validate(p, pages)
        total_err += len(errors)
        print(f"\n== {p.name}: {len(rows)} goldens, {len(errors)} issues")
        print("  types :", dict(Counter(g.get("query_type") for g in rows)))
        print("  styles:", dict(Counter(g.get("style") for g in rows)))
        ov = [g["_overlap"] for g in rows if g["_overlap"] is not None]
        if ov:
            print(f"  lexical overlap: mean {sum(ov)/len(ov):.2f}, max {max(ov):.2f}, "
                  f">0.6: {[g['id'] for g in rows if (g['_overlap'] or 0) > 0.6]}")
        for e in errors:
            print("  -", e)
    sys.exit(1 if total_err else 0)


if __name__ == "__main__":
    main(sys.argv[1:])
