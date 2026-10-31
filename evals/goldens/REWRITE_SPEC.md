# Rewrite Spec — make student questions sound real

A human reviewer read a sample of our casual/messy questions as if a student typed them into a
tutor chat. About 1 in 3 sounded **forced**. Common causes:

- Too long: real chat questions are usually 6–18 words. Ours had a median of 23.
- Two questions glued together ("…how many misses, and would random be any better?").
- Textbook precision wrapped in fake slang ("cycles through 5 different pages over and over… per lap").
- False-premise questions that read like a trap, not a confused student
  ("…basically just as efficient as sleeping right? no reason for anything fancier").
- Odd word choices a student wouldn't use ("sneaky program", "booted", "marker blocks").

Your job: rewrite the `input` of each listed golden so it sounds like a real student typed it,
**without changing what is being asked** unless you also update the answer (see below).

## Rules for the new question

1. **Length**: aim for 6–18 words. `worked_problem` may go up to 25 words because it has to carry
   numbers — keep every number the answer depends on.
2. **One question.** A tiny natural follow-up is fine ("what is X and why does it matter?"). Two
   separate asks are not.
3. **Sound like chat**: lowercase is fine, light or no punctuation, plain words. No forced typos
   (at most one natural one, only in `messy`), no forced slang, no "sneaky", "lap", "booted".
4. **false_premise**: phrase it as a student checking a belief they actually hold —
   "isnt fifo always fair?" / "so the tlb is just the page table in memory right?" — not as a
   setup with extra rhetorical pushes.
5. **messy** stays messy: vague, half-remembered term, or describing the concept without its
   name. Make it vague in a natural way, not unclear about what is being asked.
6. **Do not reuse the book's wording**: no 3 consecutive content words from the evidence quotes.
   Do not mention the book, chapters, figures or "the example".
7. Keep the same `style` and `query_type`.

## If your shorter question drops part of the original ask

The `expected_output` must answer exactly what the new question asks, and every evidence quote
must still be needed. If you drop a part:
- give a new `expected_output` that only answers the new question (use only facts in the remaining
  evidence quotes; do not add new facts), and
- list the evidence quotes that are no longer needed in `remove_quotes` (copy them exactly as they
  appear in the draft). Keep at least one quote. For `cross_chapter` goldens, keep quotes from at
  least two different chapters — if that is impossible, keep both parts of the question.

If the meaning is unchanged, leave `expected_output` out and `remove_quotes` empty.

## Output

JSONL to the path you were given, one line per listed id, in the order listed:

```json
{"id": "ch19-10", "old_input": "...", "input": "new question", "expected_output": "only if changed", "remove_quotes": []}
```

## Self-check

Run `python3 -m evals.check_rewrites <your output file>` from the repo root. It applies your
rewrites to a temporary copy and runs the validator. Fix everything it reports, and rewrite any
question over the word limit.
