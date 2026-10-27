# Clarix — Context Index

Living snapshot of the codebase so a new contributor (human or agent) can get oriented fast.
Written 2026-10-26 from a full read of `Backend/`, `Frontend/src/`, and the root docs on branch `main`
(HEAD `51f9eda`, with uncommitted Groq → Ollama changes in the working tree).

**Trust order when sources disagree:** the code > this folder > `AGENTS.md` / `Backend/README.md` / `Frontend/DESIGN.md` / the `PROFILE_*.md` files (those are partly stale — see [status-and-gotchas.md](status-and-gotchas.md)).

## What Clarix is

An AI-assisted classroom platform. Teachers create classrooms, upload PDFs (notes, past-year question papers),
and build quizzes. Students join by invite code, chat with an AI tutor that answers from the classroom's
indexed PDFs (RAG), and take quizzes. Flashcards exist in the backend only.

## Files in this folder

| File | Read it when you need… |
| --- | --- |
| [architecture.md](architecture.md) | The big picture: components, request flow, external services, repo layout |
| [backend.md](backend.md) | Every router/module and its endpoints, auth and access rules |
| [data-model.md](data-model.md) | SQLAlchemy tables, relationships, startup "migrations" |
| [rag-pipeline.md](rag-pipeline.md) | How PDFs are indexed and how the tutor answers; the two parallel RAG code paths |
| [frontend.md](frontend.md) | Routes, pages, Zustand stores, API usage, dead code |
| [setup-and-ops.md](setup-and-ops.md) | Env vars, how to run, external dependencies (Ollama, Chroma Cloud, Supabase, Tesseract) |
| [status-and-gotchas.md](status-and-gotchas.md) | What's done / half-done, bugs, security issues, doc drift, the evals plan |

## 60-second summary

- **Stack:** FastAPI + SQLAlchemy (backend, port 8000) · React 19 + Vite 8 + Tailwind v4 + Zustand (frontend, port 5173).
- **Auth:** JWT (HS256, 20 min) via bcrypt login; sent as `clarix_token` cookie *and* `Authorization: Bearer`. Roles: `teacher`, `student`.
- **Storage:** relational DB via `DATABASE_URL`; PDFs and images in Supabase Storage (public buckets); vectors in **Chroma Cloud**.
- **AI:** all local via **Ollama** — chat/quiz model `qwen3.5:latest` (env `OLLAMA_MODEL`), embeddings `nomic-embed-text-v2-moe`.
- **PDF ingestion:** PyMuPDF text extraction, Tesseract OCR for handwritten/scanned; question papers get a regex/LLM question-level chunker.
- **Tests:** none in the repo.
- **Run (from repo root):** `uvicorn Backend.main:app --reload` and `cd Frontend && npm run dev` — see [setup-and-ops.md](setup-and-ops.md) for why the backend command differs from `AGENTS.md`.

## Keeping this folder current

Update the relevant file in the same change whenever you add a router/endpoint, a table/column, an env var,
a frontend route/store, or change the RAG path. Date-stamp big changes at the bottom of
[status-and-gotchas.md](status-and-gotchas.md).
