# Setup and Operations

## Prerequisites

- Python 3.13 (README requirement), a virtualenv (`venv/` at repo root is gitignored).
- Node 20+ (Vite 8) and npm.
- **Ollama** running locally with the models: `ollama pull qwen3.5` and `ollama pull nomic-embed-text-v2-moe`.
- **Tesseract** and **poppler** installed (`brew install tesseract poppler`) - needed by `pytesseract` / `pdf2image`.
- A Supabase project (Storage) and a Chroma Cloud database. Without Supabase configured, resource/banner uploads return 503 and profile-picture upload returns 500.

## Backend env (`backend/.env`, gitignored; template `backend/example.env`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLAlchemy URL (**required**; import-time crash if missing). The template uses `sqlite:///./todosapp.db` (relative to the launch directory) |
| `SECRET_KEY` | JWT signing key (falls back to a hardcoded default in `auth.py` if unset) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Storage (buckets `classroom-resources`, `profile-pictures`, created public on startup) |
| `CHROMA_API_KEY`, `CHROMA_TENANT`, `CHROMA_DATABASE` | Chroma Cloud (tenant/database default to `"default"`) |
| `OLLAMA_MODEL` | Chat/quiz model, default `qwen3.5:latest` (read in `rag_service.py`, `quiz_ai.py`, `qp_chunker.py`; **not listed in `example.env`**) |
| `LLM_PROVIDER`, `LLM_MODEL`, `LLM_BASE_URL`, `LLM_API_KEY` | Chat/quiz/question-paper LLM (`backend/llm.py`). `ollama` (default) or `openai` = any OpenAI-compatible API such as OpenRouter. `LLM_MODEL` falls back to `OLLAMA_MODEL` |
| `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`, `EMBEDDING_BASE_URL`, `EMBEDDING_API_KEY` | Embeddings: `ollama` (default, nomic) or `openai` (default `text-embedding-3-small`). Changing the model requires re-indexing Chroma collections |
| `OPENAI_API_KEY` | Fallback key for the `openai` providers; also used by the evals (root `.env`, see [evals.md](evals.md)) |
| `CORS_ORIGINS` | Comma-separated allow-list; unset reflects any origin (dev) |
| `COOKIE_SECURE`, `APP_ENV` | `COOKIE_SECURE=true` marks the auth cookie `Secure`; `APP_ENV=production` makes a missing `SECRET_KEY` fatal |

A local `.env` may omit most of these; check it directly rather than assuming (the one on the author's machine defined only `DATABASE_URL` and `SECRET_KEY`, so uploads and RAG would not work there).
`frontend/.env` exists but the code only reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (in the unused `lib/supabase.js`).

## Run

```bash
# from repo root (venv active, deps from backend/requirements.txt)
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload          # http://localhost:8000  (docs at /docs)

cd frontend && npm install && npm run dev   # http://localhost:5173
```

Run the backend **from the repo root** as `backend.main:app`: `main.py` does `from backend import models, auth` before it adds the repo root to `sys.path`, so `cd backend && uvicorn main:app` fails.
The frontend's API URL is `VITE_API_URL` at build time, defaulting to `http://localhost:8000` (the Docker build sets `/api`). The SQLite file (if used) is created relative to where uvicorn is launched.

Other commands: `npm run build`, `npm run lint` (ESLint 9).

## requirements.txt notes

All pins are `>=`; `backend/requirements.txt` lists `fastapi`, `uvicorn`, `sqlalchemy`, `python-jose`, `bcrypt`, `supabase`, LangChain pieces (`langchain`, `-core`, `-community`, `-chroma`, `-openai`, `-ollama`), `langgraph`, `chromadb`, `sentence-transformers`, PDF/OCR libs (`pymupdf`, `pdf2image`, `pytesseract`, `Pillow`), `openai`.
- Used by the app: `langchain-ollama`, `langchain-chroma`, `chromadb`, `langchain-core`, PDF/OCR libs, `langgraph` (only because `rag_pipeline/__init__.py` compiles the graph at import).
- Not used by the app: `openai`, `langchain-openai` (evals only), `sentence-transformers` (only the unused HuggingFace path), `langchain-community`, `langchain`.
- Imported somewhere but **missing from requirements**: `langchain-huggingface` (only the unused `chroma_client.py`). `groq` is installed in the local venv but nothing imports it.

## Tests, CI, deployment

No automated tests for the app and no CI config. Deployment (Docker Compose + Caddy on one VM) is in [deploy.md](deploy.md) (the `evals/` harness is separate, see [evals.md](evals.md)). The old `TESTING_GUIDE.md` (archived) was a manual checklist for the profile-picture feature only.
Git workflow: feature branches (`feat/ai`, `feat/local-ai`, `feat/quiz1`, ...) merged to `main` through numbered PRs by collaborator Kash4511.
