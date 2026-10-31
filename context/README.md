# Clarix - Context Index

Last verified against code: 2026-10-27

Clarix is an AI-assisted classroom platform. Teachers create classrooms, upload PDFs (notes, past-year question papers) and build quizzes;
students join by invite code, chat with an AI tutor that answers from the classroom's indexed PDFs (RAG), and take quizzes. Flashcards exist in the backend only.
Stack: FastAPI + SQLAlchemy (`backend/`, :8000), React 19 + Vite + Tailwind v4 + Zustand (`frontend/`, :5173), Supabase Storage, Chroma Cloud, local Ollama.

**Trust order when sources disagree:** the code > this folder > `AGENTS.md` > `archive/` (historical, not maintained).

## Read this first

1. [architecture.md](architecture.md) - components, repo layout, key flows.
2. [setup-and-ops.md](setup-and-ops.md) - get it running (env vars, Ollama, Tesseract, run commands).
3. [backend.md](backend.md) or [frontend.md](frontend.md) - whichever side you are changing.
4. [data-model.md](data-model.md) and [rag-pipeline.md](rag-pipeline.md) - when touching tables or the tutor.
5. [status-and-gotchas.md](status-and-gotchas.md) - before trusting any feature or deploying.

## Files in this folder

| File | Purpose |
| --- | --- |
| [architecture.md](architecture.md) | Big picture: components, request flow, external services, repo layout, conventions |
| [backend.md](backend.md) | Every router/module and its endpoints, auth and access rules |
| [frontend.md](frontend.md) | Routes, pages, Zustand stores, API usage, styling, dead code |
| [data-model.md](data-model.md) | SQLAlchemy tables, relationships/cascades, startup "migrations", DB engine notes |
| [rag-pipeline.md](rag-pipeline.md) | How PDFs are indexed and how the tutor answers; the unused LangGraph library path |
| [setup-and-ops.md](setup-and-ops.md) | Env vars, run commands, external dependencies, requirements notes |
| [status-and-gotchas.md](status-and-gotchas.md) | Feature status, verified bugs, security notes, stale docs, next steps |
| [evals.md](evals.md) | RAG evaluation harness in `evals/` (retrieval metrics, goldens, results) |
| [archive/](archive/README.md) | Historical docs (profile-picture feature set, old READMEs, original evals plan); outdated in places |

## 60-second summary

- **Auth:** JWT (HS256, 20 min) via bcrypt login; sent as `clarix_token` cookie *and* `Authorization: Bearer`. Roles: `teacher`, `student` (self-selected at signup).
- **Storage:** relational DB via `DATABASE_URL` (SQLite locally, Postgres/Supabase intended); PDFs and images in Supabase Storage (public buckets); vectors in **Chroma Cloud** (one collection per classroom).
- **AI:** all local via **Ollama** - chat/quiz model `qwen3.5:latest` (env `OLLAMA_MODEL`), embeddings `nomic-embed-text-v2-moe`.
- **PDF ingestion:** PyMuPDF text extraction, Tesseract OCR for handwritten/scanned; question papers get a regex/LLM question-level chunker. Runs synchronously in the upload request.
- **Run (from repo root):** `uvicorn backend.main:app --reload` and `cd frontend && npm run dev`.
- **Tests:** none for the app; RAG evals in `evals/`.

## How to keep this folder current

Update the relevant file in the same change whenever you add a router/endpoint, a table/column, an env var, a frontend route/store, or change the RAG path or access rules.
Verify claims against the code (not against other docs), fix the bug list in [status-and-gotchas.md](status-and-gotchas.md) when you fix or introduce a bug, then bump the "Last verified against code" date above and add a line to the changelog at the bottom of `status-and-gotchas.md`.
Do not edit `archive/`; add a new current doc instead and note which archived file it supersedes in `archive/README.md`.
