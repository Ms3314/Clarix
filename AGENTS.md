# Clarix: Agent Instructions

Read `context/README.md` first. It indexes the project docs (architecture, backend, frontend, data
model, RAG pipeline, setup, known issues, evals), which are kept in sync with the code.

## Run

```bash
uvicorn backend.main:app --reload     # backend, from the repo root
cd frontend && npm run dev            # frontend
python3 -m evals.run_retrieval --help # evals, from the repo root
```

## Conventions

- Backend imports are absolute from the repo root: `from backend import models`,
  `from backend.rag_pipeline.indexing.chunker import chunk_pages`. Always run from the root.
- Secrets live in `backend/.env` (template: `backend/example.env`) and the root `.env`; never commit them.
- Frontend: Tailwind via `@tailwindcss/vite`, the `@` alias points to `frontend/src`, the API goes through
  the axios instance in `frontend/src/lib/api.js`, and UI primitives follow shadcn/ui in
  `frontend/src/components/ui/`.
- ESLint allows unused UPPER_CASE names (`varsIgnorePattern: '^[A-Z_]'`).
- Documentation goes in `context/`, not in the repo root. Update the relevant context file when you
  change behaviour it describes.
- Evals never touch Chroma Cloud or the app DB; they use local indexes under `evals/.index/`.
  Tune on the `dev` split; run `test` only for a reported number.
