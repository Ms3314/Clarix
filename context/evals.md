# Evals

Offline evaluation of the RAG tutor lives in `evals/` (how to run: `evals/README.md`; findings:
`evals/results/RESULTS.md`; golden set: `evals/goldens/README.md`). It reuses the production
extractor and chunker from `backend/rag_pipeline/indexing/` but indexes into a local Chroma under
`evals/.index/`, never Chroma Cloud.

## Plan and status (2026-10-27)

| Stage | Status |
|---|---|
| Golden set (OSTEP textbook) | Done: 150 frozen goldens, 75 dev / 75 test, plus 64 reserve |
| Retrieval eval, deterministic (Hit/Recall/Precision@k, MRR) | Done on dev; 7 one-factor experiments + combined |
| Retrieval eval, DeepEval judged (Contextual Recall/Precision/Relevancy) | Done on dev (judge gpt-6-luna, ~$0.37); declared final, held-out test split not run |
| Generator eval (faithfulness, answer relevance, refusal on unanswerable) | Planned |
| Full RAG triad | Planned |
| Conversational metrics (multi-turn) and "when to retrieve vs not" | Deferred, to revisit after generator evals |
| Safety: toxicity, PII, prompt injection, guardrail adherence | Planned |
| Operational: latency, cost per question | Measured alongside each stage |

## Decisions

- **Test textbook**: OSTEP v0.91 (675 pages). Whole book indexed; goldens cover chapters 4, 7, 8, 15,
  18, 19, 22, 28, 30, 31, 40, 42 plus cross-chapter and unanswerable questions.
- **Relevance**: quote-level (chunk contains at least half of a gold evidence quote), not page-level.
- **Golden quality**: drafts by Sonnet agents, strict review by Opus (fixed 75, dropped 1), human tone
  review, then rewrites of 106 overly long casual questions.
- **Tutor behaviour to evaluate against** (product intent): conversational; answers only from the
  teacher's resources; may use clearly framed analogies (the faithfulness judge must allow those);
  strict guardrails (refuse off-topic, never invent material, resist being talked out of rules).

## Headline so far (dev split)

Production-like retrieval (500-char chunks, nomic or openai-small, top 5) finds the right passage
for about 55% of questions. openai-large + 1000-char chunks + header/footer stripping reaches 77%
(judged recall 0.55 -> 0.71 against a 0.89 judge ceiling).
See `evals/results/RESULTS.md`.

## Code facts the evals depend on

- `generate_rag_response` does not return the chunks it retrieved; the generator eval needs an
  offline harness that calls retrieval and generation separately.
- Chunk metadata `source` is a temp file path; provenance is `page` + `resource_id`.
- Production retrieval is top-4 dense search with no reranker or score threshold.
