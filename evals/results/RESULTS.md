# Retrieval results

Golden set `goldens_v1`, **dev split only** (75 goldens, 69 answerable). The test split has not
been run. Date: 2026-10-27. k = number of chunks returned; production passes the top 4 to the LLM.

With 69 answerable questions one question is about 1.5 points, so differences under about 0.08
are within noise.

| Configuration | Hit@1 | Hit@5 | Hit@10 | Recall@5 | MRR | Precision@5 | Page Hit@5 | Cross-chapter Recall@5 | p50 latency |
|---|---|---|---|---|---|---|---|---|---|
| **Baseline**: openai-small, 500/50, dense | 0.25 | 0.55 | 0.70 | 0.37 | 0.38 | 0.14 | 0.74 | 0.18 | 0.29 s |
| + strip headers/footers | 0.23 | 0.62 | 0.77 | 0.41 | 0.40 | 0.15 | 0.78 | 0.18 | 0.30 s |
| chunk 1000/100 | 0.35 | 0.64 | 0.78 | 0.47 | 0.47 | 0.14 | 0.75 | 0.18 | 0.28 s |
| openai-large | 0.42 | 0.68 | 0.80 | 0.48 | 0.53 | 0.17 | 0.78 | 0.27 | 0.50 s |
| nomic-embed-text-v2-moe (production model) | 0.22 | 0.56 | 0.71 | 0.36 | 0.36 | 0.13 | 0.71 | 0.12 | 0.03 s |
| BM25 only | 0.14 | 0.43 | 0.54 | 0.28 | 0.25 | 0.09 | 0.58 | 0.20 | 0.01 s |
| hybrid (dense + BM25, RRF) | 0.25 | 0.62 | 0.78 | 0.40 | 0.42 | 0.15 | 0.74 | 0.32 | 0.32 s |
| **Combined**: openai-large, 1000/100, clean, dense | 0.39 | **0.77** | 0.83 | **0.59** | 0.53 | 0.20 | 0.85 | 0.34 | 0.49 s |
| Combined + hybrid | 0.38 | 0.74 | **0.90** | 0.56 | 0.53 | 0.18 | 0.87 | 0.31 | 0.50 s |

## Findings

1. **The production setup finds the right passage in the top 5 only about half the time** (nomic
   0.56, openai-small 0.55). Multi-passage questions get about a third of the passages they need.
2. **Three cheap changes stack**: stronger embeddings, 1000-char chunks, and stripping running
   headers/footers take Hit@5 from 0.55 to 0.77 and Recall@5 from 0.37 to 0.59.
3. **Headers/footers pollute the index.** Every OSTEP page ends with "OPERATING SYSTEMS [VERSION
   0.91] WWW.OSTEP.ORG" or a copyright line; these become chunks that win top-k slots.
   `text_clean.py` removes them document-agnostically (3% of characters, no golden evidence lost).
4. **Hybrid search** helps the weak baseline (cross-chapter recall 0.18 -> 0.32) but adds nothing at
   k=5 on top of the combined setup; it does lift Hit@10 to 0.90.
5. **A similarity threshold cannot detect unanswerable questions.** Off-topic questions are far
   from everything, but in-domain topics the book doesn't cover (real-time scheduling, zram) score
   as close as answerable ones; a cutoff that catches them would refuse about half the answerable
   set. Refusal has to come from the generator, measured in the generation eval.
6. Weakest question types: definition and compare questions, and cross-chapter questions, where the
   retriever usually finds only one of the two chapters.

## Next

- DeepEval judged metrics (ContextualRecall / Precision / Relevancy) on the best configuration.
- Port the winning configuration into `backend/rag_service.py` (header stripping, chunk size,
  embedding model) and re-index; then run the test split once.
