"""Generate the tutor's answers for the golden set with the local Ollama model (no API cost).

Reproduces backend/rag_service.generate_rag_response for a single-turn question: same system
prompt, same context formatting, same temperature (0.7). Only the retrieval source differs: it
comes from the local eval index (see --embedding/--chunk-size/--clean) instead of Chroma Cloud.
If the prompt in rag_service.py changes, update SYSTEM_PROMPT here to match.

Answers are appended one per line, so an interrupted run resumes where it stopped.

Usage:
  python3 -m evals.generate_answers --split dev --limit 3        # timing check
  python3 -m evals.generate_answers --split dev                  # all 75 dev goldens
"""
import argparse
import json
import re
import time
from pathlib import Path

from evals.retrieval_index import collection_name, get_vectorstore
from evals.run_retrieval import GOLDENS, RESULTS, make_retriever

SYSTEM_PROMPT = """You are a helpful teaching assistant for a classroom. Use the following context from the classroom's PDF resources to answer the user's question.

Format your responses nicely using:
- Clear headings and subheadings when needed
- Bullet points for lists
- Bold text for important terms or key points
- Numbered lists for sequential steps or rankings
- Short paragraphs for explanations

Be thorough but concise. If the answer cannot be found in the context provided, clearly state that the information is not available.

If asked questions unrelated to the classroom materials (like general knowledge, personal questions, etc.), politely say you can only help with classroom-related questions.

Context:
{context}"""

THINK = re.compile(r"<think>.*?</think>", re.DOTALL)


def format_context(chunks):
    """Same layout as backend/rag_service.format_context (source is the book, not a temp path)."""
    out = ""
    for i, (text, page) in enumerate(chunks, 1):
        out += f"\n--- Document {i} ---\nSource: ostep.pdf\nPage: {page}\n{text}\n"
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--split", default="dev", choices=["dev", "test", "all"])
    ap.add_argument("--model", default="qwen3.5:4b")
    ap.add_argument("--temperature", type=float, default=0.7)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--embedding", default="openai-large")
    ap.add_argument("--chunk-size", type=int, default=1000)
    ap.add_argument("--overlap", type=int, default=100)
    ap.add_argument("--clean", action="store_true", default=True)
    ap.add_argument("--k", type=int, default=5)
    a = ap.parse_args()

    from langchain_core.prompts import ChatPromptTemplate
    from langchain_ollama import ChatOllama

    goldens = [json.loads(line) for line in open(GOLDENS)]
    if a.split != "all":
        goldens = [g for g in goldens if g["split"] == a.split]
    if a.limit:
        goldens = goldens[:a.limit]

    ctx_run = collection_name(a.embedding, a.chunk_size, a.overlap, a.clean)
    out_path = RESULTS / f"answers_{a.split}_{a.model.replace(':', '-')}__{ctx_run}_k{a.k}.jsonl"
    RESULTS.mkdir(exist_ok=True)
    done = {json.loads(line)["id"] for line in open(out_path)} if out_path.exists() else set()

    search = make_retriever(get_vectorstore(a.embedding, a.chunk_size, a.overlap, a.clean), "dense")
    prompt = ChatPromptTemplate.from_messages([("system", SYSTEM_PROMPT), ("user", "{query}")])
    chain = prompt | ChatOllama(model=a.model, temperature=a.temperature)

    todo = [g for g in goldens if g["id"] not in done]
    print(f"{len(done)} already done, {len(todo)} to generate with {a.model} -> {out_path.name}", flush=True)
    for n, g in enumerate(todo, 1):
        chunks = [(text, page) for text, page, _ in search(g["input"], a.k)]
        t = time.time()
        resp = chain.invoke({"context": format_context(chunks), "query": g["input"]})
        secs = time.time() - t
        meta = resp.response_metadata or {}
        row = {"id": g["id"], "input": g["input"], "answer": THINK.sub("", resp.content).strip(),
               "raw_answer": resp.content, "contexts": [c[0] for c in chunks], "context_pages": [c[1] for c in chunks],
               "seconds": round(secs, 1), "prompt_tokens": meta.get("prompt_eval_count"),
               "completion_tokens": meta.get("eval_count"), "model": a.model, "temperature": a.temperature}
        with open(out_path, "a") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
        print(f"[{n}/{len(todo)}] {g['id']}  {secs:.0f}s  prompt_tok={row['prompt_tokens']} out_tok={row['completion_tokens']}"
              f"  empty={not row['answer']}", flush=True)


if __name__ == "__main__":
    main()
