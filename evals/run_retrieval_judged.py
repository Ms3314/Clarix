"""LLM-judged retrieval metrics with DeepEval: ContextualRecall, ContextualPrecision, ContextualRelevancy.

Retrieves top-k chunks for each answerable golden with the given index configuration and asks the
judge model to score them. `--context gold` replaces retrieval with the golden's own evidence
quotes: a ceiling/sanity check on the judge (recall there should be close to 1.0).

Usage:
  python3 -m evals.run_retrieval_judged --split dev --embedding openai-large --chunk-size 1000 --overlap 100 --clean
  python3 -m evals.run_retrieval_judged --split dev --context gold
"""
import argparse
import asyncio
import json
import os
import statistics
import time
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

os.environ.setdefault("DEEPEVAL_TELEMETRY_OPT_OUT", "YES")
ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

from deepeval.metrics import (ContextualPrecisionMetric, ContextualRecallMetric,  # noqa: E402
                              ContextualRelevancyMetric)
from deepeval.test_case import LLMTestCase  # noqa: E402

from evals.retrieval_index import collection_name, get_vectorstore  # noqa: E402
from evals.run_retrieval import GOLDENS, RESULTS, make_retriever  # noqa: E402

METRICS = {
    "contextual_recall": ContextualRecallMetric,
    "contextual_precision": ContextualPrecisionMetric,
    "contextual_relevancy": ContextualRelevancyMetric,
}


async def judge(golden, context, judge_model, sem):
    tc = LLMTestCase(input=golden["input"], actual_output="(not evaluated)",
                     expected_output=golden["expected_output"], retrieval_context=context)
    row = {"id": golden["id"], "query_type": golden["query_type"], "style": golden["style"]}
    async with sem:
        for name, cls in METRICS.items():
            metric = cls(model=judge_model, include_reason=True, async_mode=True)
            try:
                await metric.a_measure(tc, _show_indicator=False)
                row[name] = metric.score
                row[f"{name}_reason"] = metric.reason
                row["cost"] = row.get("cost", 0) + (metric.evaluation_cost or 0)
            except Exception as e:  # keep going; report failures instead of aborting the run
                row[name] = None
                row[f"{name}_error"] = f"{type(e).__name__}: {e}"[:300]
    return row


async def run(goldens, contexts, judge_model, concurrency):
    sem = asyncio.Semaphore(concurrency)
    return await asyncio.gather(*(judge(g, contexts[g["id"]], judge_model, sem) for g in goldens))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--split", default="dev", choices=["dev", "test", "all"])
    ap.add_argument("--context", default="retrieved", choices=["retrieved", "gold"])
    ap.add_argument("--embedding", default="openai-small")
    ap.add_argument("--chunk-size", type=int, default=500)
    ap.add_argument("--overlap", type=int, default=50)
    ap.add_argument("--clean", action="store_true")
    ap.add_argument("--retriever", default="dense", choices=["dense", "bm25", "hybrid"])
    ap.add_argument("--k", type=int, default=5)
    ap.add_argument("--judge", default="gpt-6-luna")
    ap.add_argument("--concurrency", type=int, default=8)
    ap.add_argument("--limit", type=int, default=0, help="only the first N goldens (smoke test)")
    a = ap.parse_args()

    goldens = [json.loads(line) for line in open(GOLDENS)]
    goldens = [g for g in goldens if g["evidence"] and (a.split == "all" or g["split"] == a.split)]
    if a.limit:
        goldens = goldens[:a.limit]

    if a.context == "gold":
        contexts = {g["id"]: [e["quote"] for e in g["evidence"]] for g in goldens}
        run_name = "gold"
    else:
        store = get_vectorstore(a.embedding, a.chunk_size, a.overlap, a.clean)
        search = make_retriever(store, a.retriever)
        contexts = {g["id"]: [text for text, _, _ in search(g["input"], a.k)] for g in goldens}
        run_name = f"{collection_name(a.embedding, a.chunk_size, a.overlap, a.clean)}_{a.retriever}_k{a.k}"

    start = time.time()
    rows = asyncio.run(run(goldens, contexts, a.judge, a.concurrency))
    elapsed = time.time() - start

    def avg(name, subset=rows):
        vals = [r[name] for r in subset if r.get(name) is not None]
        return round(statistics.mean(vals), 3) if vals else None

    by_type = {}
    for qt in sorted({r["query_type"] for r in rows}):
        sub = [r for r in rows if r["query_type"] == qt]
        by_type[qt] = {"n": len(sub), **{m: avg(m, sub) for m in METRICS}}
    failures = {r["id"]: [m for m in METRICS if r.get(m) is None] for r in rows if any(r.get(m) is None for m in METRICS)}
    report = {
        "config": {"split": a.split, "context": a.context, "run": run_name, "k": a.k, "judge": a.judge,
                   "goldens": GOLDENS.name, "run_at": datetime.now().isoformat(timespec="seconds")},
        "n": len(rows),
        "overall": {m: avg(m) for m in METRICS},
        "by_query_type": by_type,
        "failures": failures,
        "judge_cost_usd_reported": round(sum(r.get("cost", 0) for r in rows), 4),
        "elapsed_s": round(elapsed),
        "per_golden": rows,
    }
    RESULTS.mkdir(exist_ok=True)
    out = RESULTS / f"judged_{a.split}_{run_name}.json"
    out.write_text(json.dumps(report, indent=2))

    print(f"{run_name}  split={a.split}  n={len(rows)}  judge={a.judge}  {elapsed:.0f}s")
    for m, v in report["overall"].items():
        print(f"  {m:<22} {v}")
    print("by query_type (recall / precision / relevancy):")
    for qt, s in by_type.items():
        print(f"  {qt:<15} n={s['n']:<3} {s['contextual_recall']} / {s['contextual_precision']} / {s['contextual_relevancy']}")
    if failures:
        print(f"judge failures: {failures}")
    print(f"reported judge cost ${report['judge_cost_usd_reported']}  ->  {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
