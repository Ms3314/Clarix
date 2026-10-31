"""Judge the tutor's generated answers with DeepEval metrics, through the OpenAI Batch API.

Metrics per answerable golden (all judged by `--judge`, default gpt-6-luna, via evals.batch_judge):
  faithfulness       are the answer's claims consistent with the retrieved context? (DeepEval penalizes
                     contradictions only, not extra material the context never mentions)
  answer_relevancy   does the answer address the question?
  correctness        GEval: does the answer agree with and cover the golden's reference answer?
Unanswerable goldens get a free keyword check: did the tutor decline? The same check on answerable
goldens gives a false-refusal rate. Keyword matching is approximate; read a few answers too.

Usage:
  python3 -m evals.run_generation_judged --answers evals/results/answers_dev_....jsonl --sample 20
  python3 -m evals.run_generation_judged --answers evals/results/answers_dev_....jsonl          # all
Rerunning is free for anything already judged (disk cache); --budget is a hard cap in USD.
"""
import argparse
import asyncio
import json
import os
import re
import statistics
from collections import defaultdict
from datetime import datetime
from pathlib import Path

os.environ.setdefault("DEEPEVAL_TELEMETRY_OPT_OUT", "YES")

from deepeval.metrics import AnswerRelevancyMetric, FaithfulnessMetric, GEval  # noqa: E402
from deepeval.test_case import LLMTestCase, LLMTestCaseParams  # noqa: E402

from evals.batch_judge import BatchJudge  # noqa: E402
from evals.run_retrieval import GOLDENS, RESULTS  # noqa: E402

REFUSAL = re.compile(
    r"(couldn'?t find|could not find|can(?:no|')t find|not (?:available|covered|mentioned|found|included|discussed|addressed)"
    r"|isn'?t (?:available|covered|mentioned|in )|no (?:relevant )?information|don'?t have (?:any )?information"
    r"|only (?:help|answer|assist)[^.]{0,60}(?:classroom|course|material|resources)"
    r"|(?:unrelated|outside)[^.]{0,40}(?:classroom|course|material|resources)"
    r"|not (?:related|relevant) to (?:the |your )?(?:classroom|course|class))", re.I)

CORRECTNESS = ("Compare the actual output with the expected output. The actual output is correct if it agrees "
               "with the expected output and covers its key facts. Extra correct explanation, formatting, or a "
               "clearly framed analogy is fine. Penalize contradictions of the expected output and missing key facts.")


def stratified_sample(goldens, n):
    by_type = defaultdict(list)
    for g in sorted(goldens, key=lambda g: g["id"]):
        by_type[g["query_type"]].append(g)
    out, i = [], 0
    while len(out) < n and any(by_type.values()):
        for qt in sorted(by_type):
            if by_type[qt] and len(out) < n:
                out.append(by_type[qt].pop(0))
        i += 1
    return out


def make_metrics(judge):
    return {
        "faithfulness": FaithfulnessMetric(model=judge, include_reason=False, async_mode=True),
        "answer_relevancy": AnswerRelevancyMetric(model=judge, include_reason=False, async_mode=True),
        "correctness": GEval(name="Correctness", criteria=CORRECTNESS, model=judge, async_mode=True,
                             evaluation_params=[LLMTestCaseParams.ACTUAL_OUTPUT, LLMTestCaseParams.EXPECTED_OUTPUT]),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--answers", required=True)
    ap.add_argument("--judge", default="gpt-6-luna")
    ap.add_argument("--budget", type=float, default=0.08, help="hard cap in USD for this run")
    ap.add_argument("--sample", type=int, default=0, help="judge a stratified sample of N answerable goldens")
    a = ap.parse_args()

    goldens = {g["id"]: g for g in map(json.loads, open(GOLDENS))}
    answers = {r["id"]: r for r in map(json.loads, open(a.answers))}
    answerable = [goldens[i] for i in answers if goldens[i]["evidence"]]
    unanswerable = [goldens[i] for i in answers if not goldens[i]["evidence"]]
    if a.sample:
        answerable = stratified_sample(answerable, a.sample)

    judge = BatchJudge(model=a.judge, budget_usd=a.budget)
    cases, coros = [], []
    for g in answerable:
        r = answers[g["id"]]
        tc = LLMTestCase(input=g["input"], actual_output=r["answer"], expected_output=g["expected_output"],
                         retrieval_context=r["contexts"])
        for name, metric in make_metrics(judge).items():
            cases.append((g["id"], name))
            coros.append(metric.a_measure(tc, _show_indicator=False))
    print(f"judging {len(answerable)} answers x 3 metrics = {len(coros)} measurements with {a.judge} (budget ${a.budget:.2f})")
    results = asyncio.run(judge.drive(coros))

    per = defaultdict(dict)
    for (gid, name), res in zip(cases, results):
        if isinstance(res, BaseException):
            per[gid][name] = None
            per[gid][f"{name}_error"] = f"{type(res).__name__}: {res}"[:300]
        else:
            per[gid][name] = res
    rows = [{"id": g["id"], "query_type": g["query_type"], "style": g["style"], **per[g["id"]]} for g in answerable]

    def avg(name, subset):
        vals = [r[name] for r in subset if r.get(name) is not None]
        return round(statistics.mean(vals), 3) if vals else None

    names = ["faithfulness", "answer_relevancy", "correctness"]
    by_type = {qt: {"n": len(s), **{m: avg(m, s) for m in names}}
               for qt in sorted({r["query_type"] for r in rows}) for s in [[r for r in rows if r["query_type"] == qt]]}
    refusals = {g["id"]: bool(REFUSAL.search(answers[g["id"]]["answer"])) for g in unanswerable}
    in_domain = [g["id"] for g in unanswerable if g["subtype"] == "in_domain_not_covered"]
    off_topic = [g["id"] for g in unanswerable if g["subtype"] == "off_topic"]
    all_answerable = [g["id"] for g in goldens.values() if g["id"] in answers and g["evidence"]]
    report = {
        "config": {"answers": Path(a.answers).name, "judge": a.judge, "budget_usd": a.budget, "sample": a.sample,
                   "run_at": datetime.now().isoformat(timespec="seconds")},
        "n_judged": len(rows),
        "overall": {m: avg(m, rows) for m in names},
        "by_query_type": by_type,
        "refusal": {
            "in_domain_unanswerable_declined": f"{sum(refusals[i] for i in in_domain)}/{len(in_domain)}",
            "off_topic_declined": f"{sum(refusals[i] for i in off_topic)}/{len(off_topic)}",
            "false_refusals_on_answerable": f"{sum(bool(REFUSAL.search(answers[i]['answer'])) for i in all_answerable)}/{len(all_answerable)}",
            "per_unanswerable": refusals,
        },
        "judge_cost_usd_estimated": round(judge.spent_usd, 4),
        "rounds": judge.rounds,
        "failures": {r["id"]: [n for n in names if r.get(n) is None] for r in rows if any(r.get(n) is None for n in names)},
        "per_golden": rows,
    }
    out = RESULTS / f"generation_judged_{Path(a.answers).stem}{'_s' + str(a.sample) if a.sample else ''}.json"
    out.write_text(json.dumps(report, indent=2))

    print(f"\njudged {len(rows)} answers, {judge.rounds} batch rounds, estimated judge cost ${judge.spent_usd:.4f}")
    for m, v in report["overall"].items():
        print(f"  {m:<18} {v}")
    print("by query_type (faithfulness / relevancy / correctness):")
    for qt, s in by_type.items():
        print(f"  {qt:<15} n={s['n']:<3} {s['faithfulness']} / {s['answer_relevancy']} / {s['correctness']}")
    print("refusals:", {k: v for k, v in report["refusal"].items() if k != "per_unanswerable"})
    if report["failures"]:
        print("judge failures:", report["failures"])
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
