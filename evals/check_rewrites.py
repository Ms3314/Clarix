"""Apply proposed question rewrites to the drafts (or a temp copy) and validate.

Usage:
  python3 -m evals.check_rewrites evals/goldens/rewrites/g1.jsonl            # dry run on a temp copy
  python3 -m evals.check_rewrites --apply evals/goldens/rewrites/g1.jsonl    # write into the drafts
"""
import json
import shutil
import sys
import tempfile
from pathlib import Path

from evals.validate_goldens import normalize, validate, CORPUS

DRAFTS = Path(__file__).resolve().parent / "goldens" / "drafts"
WORD_LIMIT = {"worked_problem": 25}


def apply(rewrites: dict, draft_dir: Path) -> list:
    problems = []
    for path in sorted(draft_dir.glob("*.jsonl")):
        rows = [json.loads(line) for line in open(path)]
        touched = False
        for g in rows:
            rw = rewrites.get(g["id"])
            if not rw:
                continue
            touched = True
            g["input"] = rw["input"]
            if rw.get("expected_output"):
                g["expected_output"] = rw["expected_output"]
            drop = {normalize(q) for q in rw.get("remove_quotes", [])}
            missing = drop - {normalize(e["quote"]) for e in g["evidence"]}
            if missing:
                problems.append(f"{g['id']}: remove_quotes not found in draft: {len(missing)}")
            g["evidence"] = [e for e in g["evidence"] if normalize(e["quote"]) not in drop]
            if g["query_type"] != "unanswerable" and not g["evidence"]:
                problems.append(f"{g['id']}: no evidence left")
            if g["query_type"] == "cross_chapter":
                if len({e["page"] for e in g["evidence"]}) < 2:
                    problems.append(f"{g['id']}: cross_chapter golden now cites a single page")
            limit = WORD_LIMIT.get(g["query_type"], 18)
            if len(g["input"].split()) > limit:
                problems.append(f"{g['id']}: {len(g['input'].split())} words (limit {limit})")
            g["hops"] = max(1, min(g.get("hops", 1), len(g["evidence"])))
            g["notes"] = (g.get("notes", "") + " | master: tone rewrite").strip(" |")
        if touched:
            with open(path, "w") as f:
                f.writelines(json.dumps(g, ensure_ascii=False) + "\n" for g in rows)
    return problems


def main(args):
    do_apply = args and args[0] == "--apply"
    files = args[1:] if do_apply else args
    rewrites = {}
    for f in files:
        for line in open(f):
            if line.strip():
                r = json.loads(line)
                rewrites[r["id"]] = r
    target = DRAFTS if do_apply else Path(tempfile.mkdtemp()) / "drafts"
    if not do_apply:
        shutil.copytree(DRAFTS, target)
    problems = apply(rewrites, target)
    pages = json.loads((CORPUS / "pages.json").read_text())
    for path in sorted(target.glob("*.jsonl")):
        _, errors = validate(path, pages)
        problems += [e for e in errors if e.split(":")[0] in rewrites]
    print(f"{len(rewrites)} rewrites, {len(problems)} problems")
    for p in problems:
        print("  -", p)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main(sys.argv[1:])
