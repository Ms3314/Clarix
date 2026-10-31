"""Strip running headers and footers from extracted PDF pages before chunking.

Document-agnostic: a line is boilerplate if it sits in the top or bottom few lines of a page and
the same line text recurs in those positions on several pages (running titles, book name, version
strings, copyright lines), or if it is a bare page number there. Body text is never touched.
"""
import re
from collections import Counter

TOP_LINES = 3
BOTTOM_LINES = 5
MIN_PAGES = 3
PAGE_NUMBER = re.compile(r"^\d{1,4}$")


def _edges(lines):
    top = range(min(TOP_LINES, len(lines)))
    bottom = range(max(len(lines) - BOTTOM_LINES, 0), len(lines))
    return set(top) | set(bottom)


def strip_headers_footers(pages: list) -> list:
    """pages: [{'page', 'text', ...}] as returned by extract_text. Returns cleaned copies."""
    split = [p["text"].split("\n") for p in pages]
    counts = Counter()
    for lines in split:
        counts.update({lines[i].strip() for i in _edges(lines) if lines[i].strip()})
    boilerplate = {line for line, n in counts.items() if n >= MIN_PAGES}

    cleaned = []
    for page, lines in zip(pages, split):
        edges = _edges(lines)
        kept = [line for i, line in enumerate(lines)
                if not (i in edges and (line.strip() in boilerplate or PAGE_NUMBER.match(line.strip())))]
        text = "\n".join(kept).strip()
        if text:
            cleaned.append({**page, "text": text})
    return cleaned
