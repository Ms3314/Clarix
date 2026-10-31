# Clarix

**Where teachers teach, and AI amplifies.**

Clarix is an AI classroom platform. Teachers upload their course material (textbooks, notes, past
papers) into a classroom; it is indexed into a per-classroom vector store, and students get an AI
tutor that answers from *that* material instead of generic knowledge.

## Features

| Area | Status |
|---|---|
| Teacher and student roles, auth, profiles | Working |
| Classrooms: create, invite code, public/private join with approval, co-teachers | Working |
| Resources: PDF upload, folders, PDF viewer, annotations; indexed for the tutor | Working |
| RAG tutor: per-student chat sessions over the classroom's resources | Working (no citations yet) |
| Quizzes: manual and AI-generated, attempts, leaderboard | Working |
| Announcements | Working |
| Flashcards | Backend only |
| Group/peer chat, podcast-style lessons | Planned |

## Stack

- **Frontend**: React 19, Vite, Tailwind CSS 4, Zustand, React Router (`frontend/`)
- **Backend**: FastAPI, SQLAlchemy (Postgres/Supabase), JWT auth (`backend/`)
- **RAG**: PyMuPDF and Tesseract extraction, LangChain, Chroma Cloud, Ollama for chat and embeddings
- **Evals**: offline retrieval and generation evals on a textbook test set (`evals/`)

## Repository layout

```
backend/    FastAPI app, models, routers, RAG service and indexing pipeline
frontend/   React app
evals/      RAG evaluation harness, golden test set and results
context/    project documentation; start at context/README.md
AGENTS.md   instructions for AI coding agents working in this repo
```

## Running locally

Requires Python 3.13, Node 20+, Tesseract and poppler (for PDF OCR), and Ollama with the chat and
embedding models pulled. Copy `backend/example.env` to `backend/.env` and fill it in.

```bash
# backend (from the repo root)
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload        # http://localhost:8000

# frontend
cd frontend && npm install && npm run dev  # http://localhost:5173
```

More detail: `context/setup-and-ops.md`. Evals: `evals/README.md`.
