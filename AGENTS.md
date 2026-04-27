# Clarix — Agent Instructions

## Run Commands

```bash
# Backend (from repo root)
cd Backend && uvicorn main:app --reload

# Frontend
cd Frontend/miniproject && npm run dev
```

## Architecture

```
Frontend/miniproject/   # React 19 + Vite frontend
Backend/
  main.py              # FastAPI entrypoint
  models.py           # SQLAlchemy User model
  auth.py             # JWT authentication (hardcoded SECRET_KEY at line 20)
  Database.py         # SQLite: todosapp.db
  templates/         # Jinja2 HTML templates (Login, Chat, Dashboard)
  rag_pipeline/      # PDF indexing with LangChain + LangGraph + ChromaDB
```

## Known Issues (Fix These)

1. **Missing Vite alias**: `App.jsx` uses `@/` imports but `vite.config.js` has no alias. Add:
   ```js
   resolve: { alias: { '@': '/src' } }
   ```

2. **Missing UI packages**: `App.jsx` imports `@tanstack/react-query`, `react-router-dom`, and shadcn/ui components not in `package.json`.

3. **Missing pages**: `App.jsx` imports `./pages/Index.tsx` and `./pages/NotFound.tsx` — directory doesn't exist.

4. **Auth hardcoded secret**: `Backend/auth.py:20` has inline JWT `SECRET_KEY` — move to `Backend/.env`.

## Conventions

- Backend imports: `from Backend import models` (NOT relative). Run from repo root.
- ESLint: Allows `CONSTANTS` (uppercase) as unused vars via `varsIgnorePattern: '^[A-Z_]'` at eslint.config.js:26

## RAG Pipeline

- Uses **LangChain** and **LangGraph** for pipeline orchestration
- **LangGraph StateGraph** with nodes: `detect` → `extract` → `chunk` → `index`
- **LangChain Documents** for chunk representation
- **LangChain Chroma** wrapper for vectorstore
- Requires `CHROMA_API_KEY` in `Backend/.env` (already set)
- Uses `all-MiniLM-L6-v2` embeddings (sentence-transformers)
- Supports handwritten vs text PDF detection via `detector.py`