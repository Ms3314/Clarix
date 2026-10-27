# Architecture

## Components

```
 Browser (React SPA, :5173)
   │  axios, baseURL http://localhost:8000 (hardcoded), JWT in localStorage + Bearer header
   ▼
 FastAPI app  (Backend/main.py, :8000)
   ├─ routers: auth, classroom, resources(+chat), quiz, flashcard, announcements, profile
   ├─ SQLAlchemy ──────────────► relational DB   (DATABASE_URL)
   ├─ supabase-py ─────────────► Supabase Storage (buckets: classroom-resources, profile-pictures; both public)
   ├─ rag_service.py ──┬───────► Chroma Cloud    (one collection per classroom)
   │                   ├───────► Ollama          (embeddings + chat LLM, localhost:11434)
   │                   └───────► Tesseract/poppler (OCR, local binaries)
   └─ quiz_ai.py ──────────────► Ollama          (MCQ generation)
```

No background workers or queues: PDF indexing, LLM calls and quiz generation all run **synchronously inside the request**.

## Repo layout

```
Clarix/
├── AGENTS.md                  agent instructions (partly stale)
├── README.md                  product pitch
├── Clarix Evals Plan.md       untracked; evaluation plan for the RAG system (see status-and-gotchas.md)
├── PROFILE_*.md, QUICKSTART.md, START_HERE.md, TESTING_GUIDE.md, IMPLEMENTATION_REPORT.md, PROFILE_MIGRATION.sql
│                              docs for the profile-picture feature only
├── todosapp.db                local SQLite file (gitignored); also venv/ at root (gitignored)
├── Backend/
│   ├── main.py                app, CORS, router wiring, WebSocket rooms, startup migrations, /teacher/resources
│   ├── Database.py            engine/SessionLocal/Base/get_db  (reads DATABASE_URL)
│   ├── models.py              all ORM models
│   ├── auth.py                /auth/* + get_current_user/teacher/student
│   ├── classroom.py           /classrooms CRUD, invite/join/approve, banners, co-teachers
│   ├── resources.py           folders, resource upload/move/delete, annotations, chat sessions + RAG chat
│   ├── quiz.py                quizzes CRUD, AI generate, attempt, attempts list, leaderboard
│   ├── quiz_ai.py             Ollama MCQ generation
│   ├── flashcard.py           flashcard CRUD (no UI yet)
│   ├── announcements.py       announcements
│   ├── profile.py             profile pictures
│   ├── rag_service.py         the RAG used in production (index, query, answer, title)
│   ├── rag_pipeline/indexing/ detector, extractors, chunker, qp_chunker  (+ LangGraph graph & Chroma client used only by streamlit_app)
│   ├── streamlit_app.py       standalone RAG demo (OpenAI), not part of the app
│   └── example.env, requirements.txt, README.md
└── Frontend/
    ├── vite.config.js         '@' → src alias, react + @tailwindcss/vite
    └── src/ App.jsx, pages/, components/, stores/, lib/, layouts/, hooks/
```

## Key flows

**Login.** `POST /auth/login` → JWT (20 min) returned in body *and* set as httpOnly cookie `clarix_token`.
Frontend stores the body token in `localStorage['clarix_token']`; the axios request interceptor adds `Authorization: Bearer`.
`get_current_user` reads the cookie first, then the header. Any 401 → frontend clears the token and hard-redirects to `/`.

**Create classroom → join.** Teacher `POST /classrooms/` (gets a 6-char uppercase `invite_code`; optional co-teachers by email).
Student `POST /classrooms/join {invite_code}` (or opens `/join/:code`, which previews via `GET /classrooms/info/{code}`).
Public classroom → enrollment `approved` immediately; private → `pending` until a teacher approves.

**Upload → index.** Teacher `POST /classrooms/{id}/resources/upload` (multipart, PDF only, `resource_type` = notes | pyq | other):
upload bytes to Supabase → insert `Resource` → **synchronously** `rag_service.index_resource()` on a temp copy
(detect handwriting → extract → chunk → embed → add to Chroma) → set `indexed` / `indexed_at`. Details: [rag-pipeline.md](rag-pipeline.md).

**Ask the tutor.** `POST /classrooms/{id}/chat/sessions/{sid}/messages {query}` → save user message, auto-title the
session on first message (LLM), load history, `generate_rag_response()` (top-4 similarity search in the classroom's
Chroma collection → prompt → Ollama), save + return the assistant message.

**Quiz.** Teacher builds manually or `POST …/quizzes/generate {topic, difficulty, num_questions}` (LLM, *not* grounded in uploaded PDFs).
Student `POST …/quizzes/{qid}/attempt {answers:[int]}` → server grades by index, one attempt per student.

## Cross-cutting conventions

- Backend imports are absolute (`from Backend.x import …`), so the app must be launched from the repo root as the `Backend` package.
- Every router re-implements classroom access checks inline (teacher-owner / enrolled-student); there is no shared helper — see the inconsistencies in [status-and-gotchas.md](status-and-gotchas.md).
- Feature flags per classroom: `resources_enabled`, `quizzes_enabled`, `flashcards_enabled`, `announcements_enabled` — stored and returned by the API and used by the UI; the backend does not enforce them.
- Supabase client is lazily created and duplicated in `resources.py`, `classroom.py`, `profile.py` and `main.py` (startup bucket check). Returns `None`/503 when `SUPABASE_URL` is unset or still the `your-project` placeholder.
