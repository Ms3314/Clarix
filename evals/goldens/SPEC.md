# Golden Spec — Clarix RAG Tutor (OSTEP textbook)

Clarix is an AI tutor for **students learning operating systems**. A teacher uploads the
textbook *Operating Systems: Three Easy Pieces* (OSTEP); students ask questions in a chat and the
tutor answers from retrieved chunks of the book. These goldens are used to evaluate
**retrieval** (does the right passage come back?) and later the **generator** (is the answer
correct, grounded, and useful to a student?).

You are writing draft goldens for **one chapter**. Your input is a text file with the chapter's
extracted text, split by `===== PAGE N =====` markers. N is the PDF page number — use it exactly.

## Output

Write **exactly 15** goldens as JSON Lines (one JSON object per line, no array, no comments) to the
output path you were given. Schema:

```json
{
  "id": "ch19-01",
  "chapter": 19,
  "input": "the student's question, as a student would type it",
  "expected_output": "reference answer, 2-5 sentences, fully supported by the evidence",
  "evidence": [{"page": 212, "quote": "verbatim span copied from that page"}],
  "query_type": "mechanism_why",
  "style": "casual",
  "hops": 1,
  "difficulty": "medium",
  "notes": "optional: anything a reviewer should know"
}
```

### Field rules

- **id**: `ch<NN>-<01..15>`, chapter zero-padded to 2 digits.
- **input**: the question. See "Writing the question" below — this is the most important field.
- **expected_output**: a correct, concise answer a good tutor would give, using **only** facts in the
  evidence. Explain in plain words, not copy-paste. For `false_premise`, the answer must correct the
  premise first. For `worked_problem`, show the short working and the final result.
- **evidence**: 1–3 entries. Each `quote` is a **verbatim** span from the page you name:
  - 1–3 sentences, roughly 80–300 characters. Short and specific beats long.
  - Copy words exactly. You MAY join line breaks with a single space, rejoin words hyphenated across
    a line break (`rea-\nsons` → `reasons`), and write `fi`/`fl` instead of the `ﬁ`/`ﬂ` ligatures.
    Nothing else may change: no paraphrase, no ellipses `...`, no fixed typos.
  - A quote must lie on **one page** (never across a page marker). If the passage spans a page
    break, use two evidence entries, one per page.
  - Quote the passage that actually **answers** the question, not the section heading or the
    chapter intro that merely mentions the topic.
  - Every fact in `expected_output` must be supported by some quote. If you need a fact, quote it.
    This includes "obvious" inferences and comparative claims ("X does better than Y") — if the
    quote doesn't say it, either extend the quote or drop the claim. Only arithmetic in a
    `worked_problem` may go beyond the quotes.
  - Prefer quotes that state the rule or definition over quotes that state the book's own example
    result (e.g. quote "hit rate is hits divided by accesses", not "…is 70%").
  - Do not quote figure/code listings that extracted as one-token-per-line garbage; prefer prose.
- **hops**: number of distinct passages truly needed (1 if one quote suffices; 2–3 if the answer
  needs separate passages, e.g. comparisons).
- **difficulty**: `easy` (direct lookup) | `medium` (needs understanding of a mechanism) |
  `hard` (synthesis, calculation, or reasoning across passages).

### query_type — required mix (15 total)

| query_type | count | what it is |
|---|---|---|
| `definition` | 2 | "what is X" — but phrased naturally |
| `mechanism_why` | 4 | how something works or why the design is the way it is |
| `compare` | 2 | contrast two ideas from this chapter (usually hops ≥ 2) |
| `worked_problem` | 2 | a small concrete scenario/calculation the chapter's method solves, using **your own numbers** (not the book's example). If the chapter has no calculable content, use a "what happens step by step when…" scenario instead |
| `code_api` | 1 | about an API, instruction, data structure, or code shown in the chapter. If none exists, use `mechanism_why` |
| `false_premise` | 2 | the student states something wrong that a confused student might believe; the chapter contradicts it |
| `application` | 2 | "when would I…" / "what goes wrong if…" / exam-style reasoning beyond restating a passage |

### style — required mix

- `textbook` (≤ 4): clean, well-formed question.
- `casual` (≥ 7): how a student types in a chat — lowercase, informal, short, "i don't get why…",
  "so basically…", "wait so does…".
- `messy` (≥ 3): vague, typo'd, half-remembered term, or describes the concept without naming it
  ("the thing where the os keeps a little cache of the page lookups").

## Writing the question (read carefully)

The biggest risk is questions that copy the book's wording: they make retrieval look far better
than it is for real students. So:

1. **Do not reuse the distinctive phrases of the evidence.** Write the question first from the idea,
   then check it against the quote. If 3+ consecutive content words match the quote, rewrite.
2. Students often don't know the official term — in at least 5 of 15, avoid the key technical term
   entirely and describe it instead.
3. Do not mention the book, the chapter, section numbers, figure numbers, or "according to the text".
   A student doesn't say "in Figure 19.4".
4. Each question must be answerable from **this chapter's** evidence alone, and have one clear
   correct answer.
5. Cover the chapter: spread questions across its sections. No two goldens may target the same
   evidence passage.
6. Skip trivia (author names, citations, years, homework instructions, dialogue chit-chat). Ask
   what a student studying for an exam or debugging their understanding would ask.

## Self-check before you finish

For each golden: (a) every quote is verbatim on the named page per the rules above; (b) the
question shares no 3-word distinctive phrase with the quotes; (c) the answer uses only quoted facts;
(d) counts of query_type and style match the tables. Fix anything that fails, then write the file.
Finally, report back: the output path, the type/style counts, and any golden you are unsure about.
