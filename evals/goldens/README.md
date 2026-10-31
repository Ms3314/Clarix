# Clarix golden set v1 (OSTEP)

Test questions for evaluating the Clarix RAG tutor on *Operating Systems: Three Easy Pieces*
(`Operating Systems - Three Easy Pieces.pdf`, 675 pages, OSTEP v0.91). Frozen 2026-10-27.

| File | What it is |
|---|---|
| `goldens_v1.jsonl` | **The eval set: 150 goldens, 75 `dev` / 75 `test`.** Tune on dev, report on test once. |
| `reserve_v1.jsonl` | 64 more goldens built the same way, held back for a later test. |
| `drafts/` | All 215 drafts with review fixes applied (one dropped). Source of truth for edits. |
| `reviews/`, `rewrites/` | AI review verdicts and tone rewrites, kept for traceability. |
| `SPEC.md`, `REVIEW_SPEC.md`, `REWRITE_SPEC.md` | Instructions given to the writing, review and rewrite agents. |

## Composition (goldens_v1)

- 120 single-chapter goldens, 10 per chapter: Ch 4, 7, 8, 15, 18, 19, 22, 28, 30, 31, 40, 42.
  Per chapter: 1 definition, 3 mechanism/why, 1 compare, 2 worked problems, 1 code/API,
  1 false premise, 1 application.
- 18 cross-chapter goldens (the answer needs passages from two chapters).
- 12 unanswerable: 8 OS topics the book does not cover (checked by full-book search), 4 off-topic.
- Styles: about 61% casual, 23% messy, 16% textbook.

## Schema

`input` (student question), `expected_output` (reference answer, supported only by the evidence),
`evidence` (list of `{page, quote}`: PDF page number, 1-based, and a verbatim quote from
`PyMuPDF page.get_text()` output), `query_type`, `style`, `hops` (passages needed; 0 for
unanswerable), `difficulty`, `chapter`, `split`, `notes`.

**Relevance rule for retrieval metrics:** a retrieved chunk counts as relevant to an evidence item
when it contains that quote after `validate_goldens.normalize()` (NFKC, hyphens and whitespace
dropped, lowercase). Use the same function at eval time.

## How it was built

1. `build_corpus.py` extracted the chapters with the production extractor.
2. Sonnet agents wrote 15 drafts per chapter from `SPEC.md`; cross-chapter and unanswerable goldens
   were written separately.
3. `validate_goldens.py` checks every quote is on its page, and no question shares a 3-word phrase
   with its evidence.
4. Independent AI review: Sonnet first, then a stricter Opus pass on all 215, which fixed 75 and
   dropped 1. Most fixes added the quote an answer relied on.
5. Human tone review of 30 sampled questions; 7 of 20 casual ones read as forced, so 106 long or
   two-part casual/messy questions were rewritten shorter (`REWRITE_SPEC.md`).
6. `freeze_goldens.py` (fixed seed) picked the balanced 150 and split dev/test.

Rebuild: `python3 -m evals.freeze_goldens`. Validate: `python3 -m evals.validate_goldens evals/goldens/goldens_v1.jsonl`.
