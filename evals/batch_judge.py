"""A DeepEval judge model that runs through the OpenAI Batch API (50% cheaper, asynchronous).

DeepEval metrics call the judge one request at a time and wait for each answer. Here every metric
runs concurrently; each `a_generate` call parks on a future. When all metrics are blocked, the
queued requests are sent as ONE batch, the answers are fed back, and the metrics move to their
next step (a metric with three LLM steps costs three rounds). Identical requests are de-duplicated
and cached on disk, so re-running only pays for new questions, and a hard budget refuses to submit a
batch whose projected cost would pass the cap.

    judge = BatchJudge(model="gpt-6-luna", budget_usd=0.08)
    metric = FaithfulnessMetric(model=judge, include_reason=False)
    results = asyncio.run(judge.drive([metric.a_measure(tc, _show_indicator=False) for tc in cases]))

Smoke test (one tiny request, about $0.00001): python3 -m evals.batch_judge --smoke
"""
import asyncio
import hashlib
import json
import tempfile
import time
from pathlib import Path

from deepeval.models import DeepEvalBaseLLM
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = Path(__file__).resolve().parent / ".judge_cache"
load_dotenv(ROOT / ".env")

# USD per token at standard rates, from DeepEval's model table (not verified against OpenAI's
# pricing page). Batch is billed at BATCH_DISCOUNT of these. Edit here if the real prices differ.
PRICES = {"gpt-6-luna": (0.10 / 1e6, 0.50 / 1e6), "gpt-5-nano": (0.05 / 1e6, 0.40 / 1e6)}
BATCH_DISCOUNT = 0.5
CHARS_PER_TOKEN = 3.0          # conservative: over-estimates input tokens
EXPECTED_OUTPUT_TOKENS = 600   # includes hidden reasoning tokens
MAX_COMPLETION_TOKENS = 4000   # per request; bounds worst-case spend


class BudgetExceeded(RuntimeError):
    pass


class BatchPending(RuntimeError):
    pass


def request_key(model: str, prompt: str, schema_json: str) -> str:
    return hashlib.sha256(f"{model}\n{schema_json}\n{prompt}".encode()).hexdigest()[:40]


class OpenAIBatchBackend:
    """Submits a list of {key, prompt, schema_json} as one batch and returns {key: result}."""

    def __init__(self, model: str, poll_s: int = 20, max_wait_s: int = 3600):
        from openai import OpenAI
        self.client = OpenAI()
        self.model, self.poll_s, self.max_wait_s = model, poll_s, max_wait_s

    def body(self, req):
        body = {"model": self.model, "messages": [{"role": "user", "content": req["prompt"]}],
                "max_completion_tokens": MAX_COMPLETION_TOKENS}
        if req["schema_json"]:
            body["response_format"] = {"type": "json_schema", "json_schema": {
                "name": req["schema_name"][:60], "strict": True, "schema": json.loads(req["schema_json"])}}
        return body

    def submit(self, reqs, state):
        lines = [json.dumps({"custom_id": r["key"], "method": "POST", "url": "/v1/chat/completions",
                             "body": self.body(r)}) for r in reqs]
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as f:
            f.write("\n".join(lines))
        up = self.client.files.create(file=open(f.name, "rb"), purpose="batch")
        batch = self.client.batches.create(input_file_id=up.id, endpoint="/v1/chat/completions",
                                           completion_window="24h")
        state["batch_id"] = batch.id
        return self.wait(batch.id)

    def wait(self, batch_id):
        start = time.time()
        while True:
            b = self.client.batches.retrieve(batch_id)
            c = b.request_counts
            print(f"  batch {batch_id[-8:]}: {b.status} ({c.completed}/{c.total} done, {c.failed} failed)", flush=True)
            if b.status in ("completed", "failed", "expired", "cancelled"):
                break
            if time.time() - start > self.max_wait_s:
                raise BatchPending(f"batch {batch_id} still {b.status}; rerun to resume")
            time.sleep(self.poll_s)
        if b.status != "completed" or not b.output_file_id:
            raise RuntimeError(f"batch {batch_id} ended as {b.status}: {b.errors}")
        out = {}
        for line in self.client.files.content(b.output_file_id).text.splitlines():
            row = json.loads(line)
            resp = row.get("response") or {}
            if row.get("error") or resp.get("status_code") != 200:
                out[row["custom_id"]] = {"error": str(row.get("error") or resp.get("body"))[:300]}
                continue
            body = resp["body"]
            out[row["custom_id"]] = {"text": body["choices"][0]["message"].get("content") or "",
                                     "in": body["usage"]["prompt_tokens"], "out": body["usage"]["completion_tokens"]}
        return out


class BatchJudge(DeepEvalBaseLLM):
    def __init__(self, model="gpt-6-luna", budget_usd=0.08, total_budget_usd=0.10, backend=None, cache_name=None):
        self.model_name = model
        self.budget_usd = budget_usd              # cap for this run
        self.total_budget_usd = total_budget_usd  # cap across all runs, tracked in LEDGER
        self.backend = backend or OpenAIBatchBackend(model)
        CACHE_DIR.mkdir(exist_ok=True)
        self.cache_path = CACHE_DIR / f"{cache_name or model}.jsonl"
        self.cache = {}
        if self.cache_path.exists():
            for line in self.cache_path.read_text().splitlines():
                row = json.loads(line)
                self.cache[row["key"]] = row
        self.pending = {}   # key -> {"req": ..., "futures": [...]}
        self.spent_usd = 0.0
        self.rounds = 0
        self._seq = 0
        super().__init__(model)

    # ---- DeepEvalBaseLLM interface ----
    def load_model(self):
        return self

    def get_model_name(self, *a, **k):
        return self.model_name

    def generate(self, prompt, schema=None, **kw):
        raise RuntimeError("BatchJudge is async-only: use metric.a_measure inside judge.drive()")

    async def a_generate(self, prompt, schema=None, **kw):
        schema_json = json.dumps(self._strict_schema(schema)) if schema is not None else ""
        key = request_key(self.model_name, prompt, schema_json)
        row = self.cache.get(key)
        if row is None:
            fut = asyncio.get_running_loop().create_future()
            entry = self.pending.setdefault(key, {"req": {"key": key, "prompt": prompt, "schema_json": schema_json,
                                                          "schema_name": getattr(schema, "__name__", "Out")},
                                                  "futures": []})
            entry["futures"].append(fut)
            self._seq += 1
            row = await fut
        if row.get("error"):
            raise RuntimeError(f"judge request failed: {row['error']}")
        text = row["text"]
        if schema is not None:
            try:
                return schema.model_validate_json(text)
            except Exception:
                return text
        return text

    @staticmethod
    def _strict_schema(schema):
        from openai.lib._pydantic import to_strict_json_schema
        return to_strict_json_schema(schema)

    # ---- batching ----
    def projected_cost(self, reqs):
        pin, pout = PRICES[self.model_name]
        tin = sum(len(r["prompt"]) + len(r["schema_json"]) for r in reqs) / CHARS_PER_TOKEN
        return BATCH_DISCOUNT * (tin * pin + len(reqs) * EXPECTED_OUTPUT_TOKENS * pout)

    def ledger_total(self):
        """Estimated USD spent by every run of this judge model (smoke tests excluded via cache_name)."""
        path = CACHE_DIR / "ledger.json"
        return json.loads(path.read_text()).get(self.model_name, 0.0) if path.exists() else 0.0

    def ledger_add(self, cost):
        path = CACHE_DIR / "ledger.json"
        data = json.loads(path.read_text()) if path.exists() else {}
        data[self.model_name] = round(data.get(self.model_name, 0.0) + cost, 6)
        path.write_text(json.dumps(data, indent=2))

    def actual_cost(self, tokens_in, tokens_out):
        pin, pout = PRICES[self.model_name]
        return BATCH_DISCOUNT * (tokens_in * pin + tokens_out * pout)

    async def drive(self, coros):
        """Run metric coroutines to completion, flushing queued judge requests as batches."""
        tasks = [asyncio.ensure_future(c) for c in coros]
        while not all(t.done() for t in tasks):
            before = self._seq
            await asyncio.sleep(0.3)
            if self.pending and self._seq == before:
                await asyncio.get_running_loop().run_in_executor(None, self._flush)
        return [t.exception() or t.result() if not t.cancelled() else None for t in tasks]

    def _flush(self):
        pending, self.pending = self.pending, {}
        reqs = [e["req"] for e in pending.values()]
        projected = self.projected_cost(reqs)
        total = self.ledger_total()
        if self.spent_usd + projected > self.budget_usd or total + projected > self.total_budget_usd:
            err = BudgetExceeded(f"round {self.rounds + 1}: projected ${projected:.4f}; this run has spent "
                                 f"${self.spent_usd:.4f} of ${self.budget_usd:.2f}, all runs ${total:.4f} of "
                                 f"${self.total_budget_usd:.2f}; nothing submitted")
            self._resolve(pending, {k: {"error": str(err)} for k in pending})
            return
        self.rounds += 1
        print(f"round {self.rounds}: {len(reqs)} requests, projected ${projected:.4f} "
              f"(spent so far ${self.spent_usd:.4f}, budget ${self.budget_usd:.2f})", flush=True)
        state = {}
        try:
            results = self.backend.submit(reqs, state)
        except Exception as e:
            self._resolve(pending, {k: {"error": f"{type(e).__name__}: {e}"} for k in pending})
            return
        tin = sum(v.get("in", 0) for v in results.values())
        tout = sum(v.get("out", 0) for v in results.values())
        cost = self.actual_cost(tin, tout)
        self.spent_usd += cost
        self.ledger_add(cost)
        print(f"  done: {tin} in / {tout} out tokens, actual about ${cost:.4f}", flush=True)
        with open(self.cache_path, "a") as f:
            for key, v in results.items():
                row = {"key": key, **v}
                if "error" not in v:
                    self.cache[key] = row
                    f.write(json.dumps(row) + "\n")
        self._resolve(pending, {k: results.get(k, {"error": "missing from batch output"}) for k in pending})

    def _resolve(self, pending, results):
        loop_set = []
        for key, entry in pending.items():
            for fut in entry["futures"]:
                loop_set.append((fut, results[key]))
        for fut, row in loop_set:
            fut.get_loop().call_soon_threadsafe(fut.set_result, row)


def smoke():
    from pydantic import BaseModel

    class Ok(BaseModel):
        ok: bool

    judge = BatchJudge(model="gpt-6-luna", budget_usd=0.01, cache_name="smoke")

    async def one():
        return await judge.a_generate('Reply with JSON {"ok": true}.', schema=Ok)

    out = asyncio.run(judge.drive([one()]))
    print("result:", out, "| spent about $%.6f" % judge.spent_usd)


if __name__ == "__main__":
    import sys
    if "--smoke" in sys.argv:
        smoke()
