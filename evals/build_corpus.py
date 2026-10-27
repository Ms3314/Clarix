"""Extract the golden chapters from the OSTEP PDF using the production extractor,
so evidence quotes match the text that actually gets chunked and indexed."""
import json
from pathlib import Path

import fitz

from backend.rag_pipeline.indexing.extractors import extract_text_from_pdf

ROOT = Path(__file__).resolve().parent.parent
PDF = Path(__file__).resolve().parent / "corpus" / "ostep.pdf"
OUT = Path(__file__).resolve().parent / "corpus"

GOLDEN_CHAPTERS = [4, 7, 8, 15, 18, 19, 22, 28, 30, 31, 40, 42]


def chapter_ranges():
    toc = fitz.open(PDF).get_toc()
    entries = [(int(t.split()[0]), t, p) for lvl, t, p in toc if lvl == 2 and t.split()[0].isdigit()]
    starts = [p for lvl, t, p in toc if lvl >= 1]
    ranges = {}
    for num, title, start in entries:
        nxt = min(p for p in starts if p > start)
        ranges[num] = (title, start, nxt - 1)
    return ranges


def main():
    pages = {p["page"]: p["text"] for p in extract_text_from_pdf(str(PDF))}
    (OUT / "pages.json").write_text(json.dumps(pages))
    ranges = chapter_ranges()
    meta = {}
    for ch in GOLDEN_CHAPTERS:
        title, start, end = ranges[ch]
        body = "".join(f"\n\n===== PAGE {n} =====\n{pages.get(n, '')}" for n in range(start, end + 1))
        (OUT / "chapters" / f"ch{ch:02d}.txt").write_text(f"# {title} (PDF pages {start}-{end})" + body)
        meta[ch] = {"title": title, "start": start, "end": end}
    (OUT / "chapters.json").write_text(json.dumps(meta, indent=2))
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
