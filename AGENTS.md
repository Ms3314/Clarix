# Clarix — Agent Instructions

## Run Commands

```bash
# Backend (from repo root)
cd Backend && uvicorn main:app --reload

# Frontend (from repo root)
cd Frontend && npm run dev
```

## Architecture

```
Frontend/              # React 19 + Vite + Tailwind CSS frontend
  src/
    components/        # UI components (shadcn/ui style)
    pages/             # Route pages (Dashboard, Classroom, etc.)
    lib/               # API layer, utilities
Backend/
  main.py              # FastAPI entrypoint (includes new routers)
  models.py           # SQLAlchemy models (Users, Classroom, Enrollment, Resource, Quiz, etc.)
  auth.py             # JWT authentication with role-based access (SECRET_KEY in .env)
  Database.py         # SQLite: todosapp.db
  classroom.py        # Classroom management endpoints
  resources.py        # Resource upload & RAG chat endpoints
  quiz.py             # Quiz creation & attempt endpoints
  flashcard.py        # Flashcard management endpoints
  rag_service.py      # RAG pipeline integration wrapper
  templates/         # Legacy Jinja2 HTML templates
  rag_pipeline/      # PDF indexing with LangChain + LangGraph + ChromaDB
```

## Known Issues (Being Fixed)

1. **Missing Vite alias**: Adding `resolve: { alias: { '@': path.resolve(__dirname, './src') } }` to `vite.config.js`.
2. **Missing UI packages**: Installing `react-router-dom`, `@tanstack/react-query`, `sonner`, and shadcn/ui dependencies.
3. **Missing pages**: Creating `src/pages/` with `Index.tsx`, `Register.tsx`, `Dashboard.tsx`, etc.
4. **Auth hardcoded secret**: Moving `SECRET_KEY` to `Backend/.env` and loading via `python-dotenv`.
5. **Role-based access**: Adding `role` field to `Users` model and teacher/student auth dependencies.

## Conventions

- Backend imports: `from Backend import models` (NOT relative). Run from repo root.
- ESLint: Allows `CONSTANTS` (uppercase) as unused vars via `varsIgnorePattern: '^[A-Z_]'` at eslint.config.js:26
- Frontend: Use Tailwind CSS with `@tailwindcss/vite` plugin
- API: Use Axios instance in `src/lib/api.js` with JWT cookie interceptors
- Components: Follow shadcn/ui component structure in `src/components/ui/`

## RAG Pipeline

- Uses **LangChain** and **LangGraph** for pipeline orchestration
- **LangGraph StateGraph** with nodes: `detect` → `extract` → `chunk` → `index`
- **LangChain Documents** for chunk representation
- **LangChain Chroma** wrapper for vectorstore
- Requires `CHROMA_API_KEY` in `Backend/.env` (already set)
- Uses `all-MiniLM-L6-v2` embeddings (sentence-transformers)
- Supports handwritten vs text PDF detection via `detector.py`
- Integrated with classroom resources via `rag_service.py`: uploaded PDFs are indexed with `classroom_id` metadata, student queries are filtered by enrolled classrooms.

## Project Features

- **Role-based auth**: Teacher (admin) and Student roles with separate dashboards
- **Classroom management**: Teachers create classrooms, invite students via email, manage enrollments
- **Resource management**: Teachers upload PDF resources, indexed via RAG pipeline for classroom-specific Q&A
- **AI-generated quizzes**: Teachers generate quizzes via AI, modify them, students attempt and view results
- **Flashcards**: Teachers create flashcards for classroom use
- **React frontend**: Role-based routes, shadcn/ui components, Tailwind CSS styling

## Implementation Plan

### Phase 1: Backend Models & Auth
- Update `models.py` with role-based User model and new models (Classroom, Enrollment, Resource, Quiz, Flashcard)
- Update `auth.py` to use `.env` SECRET_KEY and add role-based dependencies
- Create `classroom.py`, `resources.py`, `quiz.py`, `flashcard.py`, `rag_service.py`

### Phase 2: Frontend Setup
- Fix `vite.config.js` with alias and Tailwind
- Install all required dependencies
- Create API layer and shadcn/ui components

### Phase 3: Frontend Pages & Components
- Build role-based pages (Dashboard, Classroom, Quiz, Flashcard)
- Implement classroom management, resource upload, RAG chat interfaces

### Phase 4: Integration & Testing
- Connect frontend to backend APIs
- Test role-based access, classroom workflows, RAG queries
