"""Freeze the golden set: pick a balanced 150 from the drafts, split dev/test, keep the rest as reserve.

Usage: python3 -m evals.freeze_goldens
"""
import glob
import json
import random
from collections import Counter, defaultdict
from pathlib import Path

GOLDENS = Path(__file__).resolve().parent / "goldens"
SEED = 20261027
PER_CHAPTER = {"definition": 1, "mechanism_why": 3, "compare": 1, "worked_problem": 2,
               "code_api": 1, "false_premise": 1, "application": 1}
N_CROSS = 18
N_UNANS = {"in_domain_not_covered": 8, "off_topic": 4}


def load():
    rows = []
    for f in sorted(glob.glob(str(GOLDENS / "drafts" / "*.jsonl"))):
        rows += [json.loads(line) for line in open(f)]
    return [r for r in rows if not r.get("dropped")]


def pick_chapter(rows, rng):
    by_type = defaultdict(list)
    for r in rows:
        by_type[r["query_type"]].append(r)
    for v in by_type.values():
        rng.shuffle(v)
    chosen = []
    for qtype, n in PER_CHAPTER.items():
        chosen += by_type[qtype][:n]
        by_type[qtype] = by_type[qtype][n:]
    # Chapters without enough of a type (e.g. no code_api) fill from mechanism_why, then anything.
    leftovers = by_type["mechanism_why"] + [r for t, v in by_type.items() if t != "mechanism_why" for r in v]
    while len(chosen) < sum(PER_CHAPTER.values()):
        chosen.append(leftovers.pop(0))
    return chosen


def split(rows, rng):
    """Alternate dev/test inside each (query_type, style) bucket so both halves look alike."""
    buckets = defaultdict(list)
    for r in rows:
        # Unanswerable goldens are balanced by kind (in-domain vs off-topic), the rest by style.
        buckets[(r["query_type"], r["subtype"] if r["query_type"] == "unanswerable" else r["style"])].append(r)
    flip = 0
    for key in sorted(buckets):
        group = buckets[key]
        rng.shuffle(group)
        for r in group:
            r["split"] = "dev" if flip % 2 == 0 else "test"
            flip += 1


def main():
    rng = random.Random(SEED)
    rows = load()
    by_chapter = defaultdict(list)
    for r in rows:
        if r["query_type"] not in ("cross_chapter", "unanswerable"):
            by_chapter[r["chapter"]].append(r)
    chosen = []
    for ch in sorted(by_chapter):
        chosen += pick_chapter(by_chapter[ch], rng)
    cross = [r for r in rows if r["query_type"] == "cross_chapter"]
    rng.shuffle(cross)
    chosen += cross[:N_CROSS]
    for sub, n in N_UNANS.items():
        pool = [r for r in rows if r["query_type"] == "unanswerable" and r["subtype"] == sub]
        rng.shuffle(pool)
        chosen += pool[:n]
    split(chosen, rng)

    ids = {r["id"] for r in chosen}
    reserve = [r for r in rows if r["id"] not in ids]
    order = lambda r: r["id"]
    with open(GOLDENS / "goldens_v1.jsonl", "w") as f:
        f.writelines(json.dumps(r, ensure_ascii=False) + "\n" for r in sorted(chosen, key=order))
    with open(GOLDENS / "reserve_v1.jsonl", "w") as f:
        f.writelines(json.dumps(r, ensure_ascii=False) + "\n" for r in sorted(reserve, key=order))

    print(f"frozen {len(chosen)}  reserve {len(reserve)}")
    for half in ("dev", "test"):
        part = [r for r in chosen if r["split"] == half]
        print(f"\n{half}: {len(part)}")
        print("  types :", dict(Counter(r["query_type"] for r in part)))
        print("  styles:", dict(Counter(r["style"] for r in part)))
        print("  hops  :", dict(Counter(r["hops"] for r in part)))


if __name__ == "__main__":
    main()
