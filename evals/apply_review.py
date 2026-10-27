"""Apply a strict reviewer's suggested fixes to the draft goldens.

Usage: python3 -m evals.apply_review evals/goldens/reviews/groupB_strict.jsonl evals/goldens/drafts/ch18.jsonl [...]

Understands these items in `suggested_fix`, separated by " | ":
  Add evidence (pNNN): "quote"
  Replace expected_output with: "text"
  Replace input with: "text"
Quotes that are substrings of a newly added quote are dropped (the new one extends them).
"""
import json
import re
import sys

from evals.validate_goldens import normalize

ADD = re.compile(r'Add evidence \(p(\d+)\): "(.+?)"\s*(?:\||$)')
REPLACE = re.compile(r'Replace (expected_output|input) with: "(.+?)"\s*(?:\||$)')


def apply(golden: dict, fix: str) -> list:
    changes = []
    for field, text in REPLACE.findall(fix):
        golden[field] = text
        changes.append(f"replace {field}")
    for page, quote in ADD.findall(fix):
        new = normalize(quote)
        golden["evidence"] = [e for e in golden["evidence"] if normalize(e["quote"]) not in new]
        golden["evidence"].append({"page": int(page), "quote": quote})
        changes.append(f"add p{page}")
    if changes:
        golden["hops"] = max(golden.get("hops", 1), min(3, len({e["page"] for e in golden["evidence"]})))
        golden["notes"] = (golden.get("notes", "") + " | master: applied strict-review fix").strip(" |")
    return changes


def main(review_path, draft_paths):
    reviews = {r["id"]: r for r in map(json.loads, open(review_path)) if r["verdict"] != "ok"}
    unparsed = set(reviews)
    for path in draft_paths:
        rows = [json.loads(line) for line in open(path)]
        for g in rows:
            r = reviews.get(g["id"])
            if not r:
                continue
            if r["verdict"] == "drop":
                g["dropped"] = r["explanation"]
                print(f"{g['id']}: marked dropped")
                unparsed.discard(g["id"])
                continue
            changes = apply(g, r.get("suggested_fix", ""))
            if changes:
                unparsed.discard(g["id"])
                print(f"{g['id']}: {', '.join(changes)}")
        with open(path, "w") as f:
            f.writelines(json.dumps(g, ensure_ascii=False) + "\n" for g in rows)
    for gid in sorted(unparsed):
        print(f"{gid}: NOT APPLIED (could not parse fix) -> {reviews[gid].get('suggested_fix', '')[:200]}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:])
