# Evals

Offline evaluation of the Clarix RAG tutor, using *Operating Systems: Three Easy Pieces* (OSTEP) as
the test textbook. Everything runs from the repo root and never touches Chroma Cloud or the app DB.

```
evals/
  corpus/              source text (git-ignored: ostep.pdf, pages.json, chapters/)
  goldens/             the test set; see goldens/README.md
    goldens_v1.jsonl   150 frozen goldens (75 dev / 75 test)
    reserve_v1.jsonl   64 held-back goldens for a later test
  results/             JSON per run + RESULTS.md (findings)
  .index/              local Chroma indexes (git-ignored, rebuildable)

  build_corpus.py      PDF -> pages.json + per-chapter text, using the production extractor
  validate_goldens.py  checks quotes, overlap, schema; also the shared normalize() used for matching
  freeze_goldens.py    picks the balanced 150 and the dev/test split (fixed seed)
  apply_review.py      applies AI-review fixes to drafts
  check_rewrites.py    applies/validates tone rewrites of questions
  text_clean.py        strips running headers/footers from extracted pages
  retrieval_index.py   builds a local index (embedding, chunk size, overlap, --clean)
  run_retrieval.py     retrieval metrics: Hit/Recall/Precision@k, MRR (dense, bm25 or hybrid)
```

## Setup

The textbook PDF goes at `evals/corpus/ostep.pdf` (free from ostep.org; not committed).
`OPENAI_API_KEY` must be in the root `.env` for the OpenAI embeddings; `nomic` needs Ollama running.

```bash
python3 -m evals.build_corpus                     # once: extract pages and chapters
python3 -m evals.validate_goldens evals/goldens/goldens_v1.jsonl
```

## Retrieval eval

```bash
# build an index (one per configuration; reruns are no-ops)
python3 -m evals.retrieval_index --embedding openai-large --chunk-size 1000 --overlap 100 --clean

# score it on the dev split
python3 -m evals.run_retrieval --split dev --embedding openai-large --chunk-size 1000 --overlap 100 --clean --retriever dense
```

Options: `--embedding openai-small|openai-large|nomic`, `--retriever dense|bm25|hybrid`,
`--split dev|test|all`. Tune on `dev` only; run `test` once for the reported number.

**Relevance rule:** a retrieved chunk is relevant to a golden's evidence quote when at least half of
the normalized quote appears contiguously in the chunk. Quote-level scores are strict (a useful code
listing that is not the quoted prose counts as a miss); `page_hit@5` is the lenient upper bound.
