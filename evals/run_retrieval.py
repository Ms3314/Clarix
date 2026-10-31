"""Deterministic retrieval metrics on the golden set (no LLM judge).

A retrieved chunk is relevant to an evidence quote when at least MATCH_FRACTION of the quote
(normalized) appears as one contiguous run in the chunk. This handles quotes that a chunk boundary
cuts in half. Unanswerable goldens have no evidence; we only record their top similarity.

Usage:
  python3 -m evals.run_retrieval --split dev
  python3 -m evals.run_retrieval --split dev --embedding openai-large --chunk-size 1000 --overlap 100
"""
import argparse
import json
import re
import statistics
import time
from collections import defaultdict
from datetime import datetime
from difflib import SequenceMatcher
from pathlib import Path

from evals.retrieval_index import collection_name, get_vectorstore
from evals.validate_goldens import normalize

GOLDENS = Path(__file__).resolve().parent / "goldens" / "goldens_v1.jsonl"
RESULTS = Path(__file__).resolve().parent / "results"
KS = (1, 3, 5, 10)
MATCH_FRACTION = 0.5


def covers(chunk: str, quote: str) -> bool:
    """True if a contiguous run of at least MATCH_FRACTION of the quote is in the chunk."""
    if quote in chunk:
        return True
    m = SequenceMatcher(None, chunk, quote, autojunk=False).find_longest_match(0, len(chunk), 0, len(quote))
    return m.size >= MATCH_FRACTION * len(quote)


def score_golden(golden: dict, chunks: list) -> dict:
    """chunks: list of (normalized_text, page) in rank order."""
    quotes = [normalize(e["quote"]) for e in golden["evidence"]]
    # covered[r] = set of evidence indexes the chunk at rank r covers
    covered = [{i for i, q in enumerate(quotes) if covers(text, q)} for text, _ in chunks]
    out = {}
    first = next((r for r, c in enumerate(covered, start=1) if c), None)
    out["mrr"] = 1 / first if first else 0.0
    for k in KS:
        top = covered[:k]
        found = set().union(*top) if top else set()
        out[f"hit@{k}"] = float(bool(found))
        out[f"recall@{k}"] = len(found) / len(quotes)
        out[f"precision@{k}"] = sum(bool(c) for c in top) / k
    out["first_relevant_rank"] = first
    return out


TOKEN = re.compile(r"[a-z0-9_]+")
RRF_K = 60
CANDIDATES = 50


def tokenize(text: str) -> list:
    return TOKEN.findall(text.lower())


def make_retriever(store, mode: str):
    """Returns search(query, k) -> [(text, page, distance_or_None)] in rank order."""
    def dense(query, k):
        return [(d.page_content, d.metadata.get("page"), dist)
                for d, dist in store.similarity_search_with_score(query, k=k)]
    if mode == "dense":
        return dense

    from rank_bm25 import BM25Okapi
    data = store._collection.get(include=["documents", "metadatas"])
    texts, pages = data["documents"], [m.get("page") for m in data["metadatas"]]
    bm25 = BM25Okapi([tokenize(t) for t in texts])

    def keyword(query, k):
        scores = bm25.get_scores(tokenize(query))
        top = sorted(range(len(texts)), key=lambda i: -scores[i])[:k]
        return [(texts[i], pages[i], None) for i in top]
    if mode == "bm25":
        return keyword

    def hybrid(query, k):
        # Reciprocal rank fusion of the two candidate lists.
        fused = defaultdict(float)
        info = {}
        for results in (dense(query, CANDIDATES), keyword(query, CANDIDATES)):
            for rank, (text, page, _) in enumerate(results, start=1):
                fused[text] += 1 / (RRF_K + rank)
                info[text] = page
        ranked = sorted(fused, key=lambda t: -fused[t])[:k]
        return [(t, info[t], None) for t in ranked]
    return hybrid


def mean(rows, key):
    vals = [r[key] for r in rows]
    return sum(vals) / len(vals) if vals else float("nan")


def summarize(rows, keys):
    return {k: round(mean(rows, k), 3) for k in keys}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--split", default="dev", choices=["dev", "test", "all"])
    ap.add_argument("--embedding", default="openai-small")
    ap.add_argument("--chunk-size", type=int, default=500)
    ap.add_argument("--overlap", type=int, default=50)
    ap.add_argument("--k", type=int, default=10)
    ap.add_argument("--clean", action="store_true", help="use the header/footer-stripped index")
    ap.add_argument("--retriever", default="dense", choices=["dense", "bm25", "hybrid"])
    a = ap.parse_args()

    goldens = [json.loads(line) for line in open(GOLDENS)]
    if a.split != "all":
        goldens = [g for g in goldens if g["split"] == a.split]
    store = get_vectorstore(a.embedding, a.chunk_size, a.overlap, a.clean)
    if store._collection.count() == 0:
        raise SystemExit("index is empty; run python3 -m evals.retrieval_index with the same settings first")
    search = make_retriever(store, a.retriever)

    per_golden, latencies = [], []
    for g in goldens:
        t = time.time()
        # Dense results carry the raw Chroma distance (default L2, as in production); lower is closer.
        hits = search(g["input"], a.k)
        latencies.append(time.time() - t)
        chunks = [(normalize(text), page) for text, page, _ in hits]
        row = {"id": g["id"], "query_type": g["query_type"], "style": g["style"], "hops": g["hops"],
               "top_distance": round(hits[0][2], 4) if hits and hits[0][2] is not None else None,
               "retrieved_pages": [p for _, p in chunks],
               "gold_pages": sorted({e["page"] for e in g["evidence"]})}
        if g["evidence"]:
            row.update(score_golden(g, chunks))
            row["page_hit@5"] = float(any(p in row["gold_pages"] for p in row["retrieved_pages"][:5]))
        per_golden.append(row)

    answerable = [r for r in per_golden if r["query_type"] != "unanswerable"]
    unanswerable = [r for r in per_golden if r["query_type"] == "unanswerable"]
    keys = ["mrr"] + [f"{m}@{k}" for m in ("hit", "recall", "precision") for k in KS]
    groups = {}
    for field in ("query_type", "style", "hops"):
        buckets = defaultdict(list)
        for r in answerable:
            buckets[str(r[field])].append(r)
        groups[field] = {b: {"n": len(rs), **summarize(rs, ["hit@5", "recall@5", "mrr"])}
                         for b, rs in sorted(buckets.items())}

    report = {
        "config": {"split": a.split, "embedding": a.embedding, "chunk_size": a.chunk_size,
                   "overlap": a.overlap, "clean": a.clean, "retriever": a.retriever, "k": a.k,
                   "match_fraction": MATCH_FRACTION,
                   "collection": collection_name(a.embedding, a.chunk_size, a.overlap, a.clean),
                   "goldens": GOLDENS.name, "run_at": datetime.now().isoformat(timespec="seconds")},
        "n_answerable": len(answerable),
        "overall": summarize(answerable, keys + ["page_hit@5"]),
        "by": groups,
        "top_distance": {
            "answerable_median": round(statistics.median(r["top_distance"] for r in answerable), 4),
            "unanswerable_median": round(statistics.median(r["top_distance"] for r in unanswerable), 4) if unanswerable else None,
            "unanswerable": {r["id"]: r["top_distance"] for r in unanswerable},
            "answerable_farther_than_min_unanswerable": sum(
                r["top_distance"] >= min(u["top_distance"] for u in unanswerable) for r in answerable) if unanswerable else None,
        } if a.retriever == "dense" else None,
        "latency_s": {"p50": round(statistics.median(latencies), 3),
                      "p95": round(sorted(latencies)[int(0.95 * (len(latencies) - 1))], 3)},
        "misses_at_5": [r["id"] for r in answerable if r["hit@5"] == 0],
        "per_golden": per_golden,
    }
    RESULTS.mkdir(exist_ok=True)
    run_name = f"{report['config']['collection']}_{a.retriever}"
    out = RESULTS / f"retrieval_{a.split}_{run_name}.json"
    out.write_text(json.dumps(report, indent=2))

    o = report["overall"]
    print(f"{run_name}  split={a.split}  answerable n={len(answerable)}")
    print("      " + "  ".join(f"k={k:<3}" for k in KS))
    for m in ("hit", "recall", "precision"):
        print(f"{m:>9} " + "  ".join(f"{o[f'{m}@{k}']:.2f} " for k in KS))
    print(f"      MRR {o['mrr']:.3f}   (page-level hit@5, lenient: {o['page_hit@5']:.2f})")
    print("\nby query_type (hit@5 / recall@5 / mrr):")
    for b, s in groups["query_type"].items():
        print(f"  {b:<15} n={s['n']:<3} {s['hit@5']:.2f} / {s['recall@5']:.2f} / {s['mrr']:.2f}")
    print("by style:", {b: s["hit@5"] for b, s in groups["style"].items()})
    print("by hops :", {b: s["recall@5"] for b, s in groups["hops"].items()}, "(recall@5)")
    u = report["top_distance"]
    if u:
        print(f"\ntop-1 distance, median (lower = closer): answerable {u['answerable_median']}  "
              f"unanswerable {u['unanswerable_median']}")
        print(f"answerable questions at least as far as the closest unanswerable one: "
              f"{u['answerable_farther_than_min_unanswerable']}/{len(answerable)}")
    print(f"latency p50 {report['latency_s']['p50']}s  p95 {report['latency_s']['p95']}s")
    print(f"misses@5 ({len(report['misses_at_5'])}): {report['misses_at_5']}")
    print(f"\nwrote {out.relative_to(Path.cwd()) if out.is_relative_to(Path.cwd()) else out}")


if __name__ == "__main__":
    main()
