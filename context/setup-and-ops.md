# Setup and Operations

## Prerequisites

- Python 3.13 (the committed `__pycache__` is `cpython-313`), a virtualenv (`venv/` at repo root is gitignored).
- Node (for Vite 8) and npm.
- **Ollama** running locally with the models: `ollama pull qwen3.5` and `ollama pull nomic-embed-text-v2-moe`.
- **Tesseract** and **poppler** installed (`brew install tesseract poppler`) — needed by `pytesseract` / `pdf2image`.
- A Supabase project (Storage) and a Chroma Cloud database. Without Supabase configured, uploads return 503.

## Backend env (`Backend/.env`, gitignored; template `Backend/example.env`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLAlchemy URL (**required**; import-time crash if missing). Example uses `sqlite:///./todosapp.db` |
| `SECRET_KEY` | JWT signing key (falls back to a hardcoded default in `auth.py` if unset) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Storage (buckets `classroom-resources`, `profile-pictures`) |
| `CHROMA_API_KEY`, `CHROMA_TENANT`, `CHROMA_DATABASE` | Chroma Cloud |
| `OLLAMA_MODEL` | Chat model, default `qwen3.5:latest` (read in code but **not listed in `example.env`**) |
| `OPENAI_API_KEY` | Only for `streamlit_app.py` |

A local `.env` may omit some of these; check it directly rather than assuming. Frontend `.env` exists but the code only reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (in the unused `lib/supabase.js`).

## Run

```bash
# from repo root (venv active, deps from Backend/requirements.txt)
uvicorn Backend.main:app --reload          # http://localhost:8000  (docs at /docs)

cd Frontend && npm install && npm run dev   # http://localhost:5173
```

`AGENTS.md` says `cd Backend && uvicorn main:app`; that fails because `main.py` does `from Backend import models` before it adds the repo root to `sys.path`,
so run from the root with `Backend.main:app`. Because the frontend's API URL is hardcoded to `http://localhost:8000`, the backend must be on that port.

Other commands: `npm run build`, `npm run lint` (ESLint 9, `varsIgnorePattern: '^[A-Z_]'`), `streamlit run Backend/streamlit_app.py` (standalone demo; needs `streamlit`, which is not in requirements).

## requirements.txt notes

Pins are all `>=`. Includes `openai`, `langchain-openai` (not used by the app) and `langchain-ollama` (used). Missing but imported somewhere:
`langchain-huggingface` (rag_pipeline `chroma_client.py` / Streamlit path, and committed HEAD `rag_service.py`), `streamlit`, and — at HEAD — `groq`/`langchain-groq`.

## Tests, CI, deployment

No automated tests, no CI config, no Dockerfile in the repo. `TESTING_GUIDE.md` is a manual checklist for the profile-picture feature only.
Git workflow: feature branches (`feat/ai`, `feat/local-ai`, `feat/quiz1`, …) merged to `main` through numbered PRs by collaborator Kash4511.
