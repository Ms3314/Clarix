# Reviewer Spec — independent check of draft goldens

You are an independent reviewer. Someone else wrote these goldens for a RAG tutor that helps students
learn operating systems from the OSTEP textbook. Your job is to find problems. Be skeptical; do not
assume the author was right. Do NOT edit the draft files.

Each golden has: `input` (student question), `expected_output` (reference answer), `evidence`
(verbatim quotes with PDF page numbers), `query_type`, `style`. The full extracted book is in
`evals/corpus/pages.json` (keys are PDF page numbers as strings) — use it to read the context around
each quote (read surrounding text on that page and neighbouring pages when needed).

For every golden, check:
1. **answer_wrong** — the expected_output is factually incorrect, or contradicts the book.
2. **answer_unsupported** — expected_output states something the evidence quotes do not support
   (arithmetic in `worked_problem` is allowed if correct — CHECK the arithmetic).
3. **evidence_misses** — the quotes don't actually answer the question, or a better/necessary
   passage elsewhere in the book is missing.
4. **ambiguous** — the question could reasonably be read in two ways, or has more than one correct
   answer, or is not answerable from the book.
5. **false_premise_bad** — for `false_premise`: the premise is not actually wrong, or the answer
   doesn't correct it.
6. **unanswerable_actually_answerable** — for `unanswerable`: search pages.json; if the book does
   cover the topic (even partly), flag it with the page.
7. **trivial_or_trivia** — the question is about trivia (names, dates, citations) or is useless
   to a student.

Verdicts: `ok` (no real problem), `fix` (fixable — give the concrete fix), `drop` (not worth fixing).
Minor style nitpicks are `ok`. Only flag real problems that would make the eval score wrong.

Output: JSONL, one line per golden, in the same order:
{"id": "...", "verdict": "ok|fix|drop", "issues": ["answer_unsupported", ...], "explanation": "1-2 sentences", "suggested_fix": "concrete replacement text or quote+page, or empty"}
