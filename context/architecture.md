# Architecture

## Components

```
 Browser (React SPA, :5173)
   |  axios, baseURL http://localhost:8000 (hardcoded), JWT in localStorage + Bearer header
   v
 FastAPI app  (backend/main.py, :8000)
   |- routers: auth, classroom, resources(+chat), quiz, flashcard, announcements, profile
   |- SQLAlchemy ---------------> relational DB   (DATABASE_URL; SQLite or Postgres)
   |- supabase-py --------------> Supabase Storage (buckets: classroom-resources, profile-pictures; both public)
   |- rag_service.py --+--------> Chroma Cloud    (one collection per classroom)
   |                   |--------> Ollama          (embeddings + chat LLM, localhost:11434)
   |                   `--------> Tesseract/poppler (OCR, local binaries)
   `- quiz_ai.py -------------> Ollama          (MCQ generation)
```

No background workers or queues: PDF indexing, LLM calls and quiz generation all run **synchronously inside the request**.
(The old Streamlit RAG demo, `backend/streamlit_app.py`, was removed.)

## Repo layout

```
Clarix/
|- AGENTS.md                 agent instructions; points to context/
|- README.md                 product pitch + quick start (already uses backend/ and frontend/)
|- context/                  this documentation; index in README.md; historical docs in archive/
|- evals/                    offline RAG evaluation harness (see evals.md); not imported by the app
|- venv/                     local virtualenv (gitignored)
|- backend/
|   |- main.py               app, hand-rolled CORS middleware, router wiring, WebSocket rooms, startup migrations, /teacher/resources
|   |- Database.py           engine / SessionLocal / Base / get_db  (reads DATABASE_URL)
|   |- models.py             all ORM models
|   |- auth.py               /auth/* + get_current_user / teacher / student
|   |- classroom.py          /classrooms CRUD, invite/join/approve, banners, co-teachers
|   |- resources.py          folders, resource upload/move/delete, annotations, chat sessions + RAG chat
|   |- quiz.py, quiz_ai.py   quiz CRUD, attempt, leaderboard; Ollama MCQ generation
|   |- flashcard.py          flashcard CRUD (no UI)
|   |- announcements.py      announcements
|   |- profile.py            profile pictures
|   |- rag_service.py        the RAG used in production (index, query, answer, title)
|   |- rag_pipeline/indexing/ detector, extractors, chunker, qp_chunker (used) + LangGraph graph/pipeline/nodes/chroma_client/embedder/state (unused)
|   `- example.env, requirements.txt, .gitignore
`- frontend/
    |- vite.config.js        '@' -> src alias, react + @tailwindcss/vite
    |- package.json          package name "miniproject"
    `- src/                  App.jsx, main.jsx, pages/, components/, stores/, lib/, layouts/, hooks/
```

Not tracked any more: root `todosapp.db`, root `package-lock.json` (only `frontend/package-lock.json` remains), `.DS_Store`, `__pycache__`.

## Key flows

**Login.** `POST /auth/login` -> JWT (20 min) returned in body *and* set as httpOnly cookie `clarix_token`.
`Index.jsx` stores the body token in `localStorage['clarix_token']`; the axios request interceptor adds `Authorization: Bearer`.
`get_current_user` reads the cookie first, then the header. Any 401 -> frontend clears the token and hard-redirects to `/`.
If a visitor came from `/join/:code` while logged out, `JoinPage` saves `localStorage['join_redirect']` and `Index` returns them there after login.

**Create classroom -> join.** Teacher `POST /classrooms/` (gets a 6-char uppercase `invite_code`; optional co-teachers by email).
Student `POST /classrooms/join {invite_code}` (or opens `/join/:code`, which previews via the public `GET /classrooms/info/{code}`).
Public classroom -> enrollment `approved` immediately; private -> `pending` until a teacher approves. Teachers can also enroll a student directly by email (`POST /{id}/invite`, immediately `approved`).

**Upload -> index.** Teacher `POST /classrooms/{id}/resources/upload` (multipart, `.pdf` only, `resource_type` = notes | pyq | other):
upload bytes to Supabase -> insert `Resource` -> **synchronously** `rag_service.index_resource()` on a temp copy
(detect handwriting -> extract -> chunk -> embed -> add to Chroma) -> set `indexed` / `indexed_at`. Indexing failures are swallowed (`indexed=false`, upload still returns 201). Details: [rag-pipeline.md](rag-pipeline.md).

**Ask the tutor.** `POST /classrooms/{id}/chat/sessions/{sid}/messages {query}` -> save user message, auto-title the
session on the first message (LLM), load history, `generate_rag_response()` (top-4 similarity search in the classroom's
Chroma collection -> prompt -> Ollama), save + return the assistant message. The frontend `/learn` page uses this; `ClassroomDetail`'s "review sheet" button uses the stateless `POST /{id}/chat`.

**Quiz.** Teacher builds manually or `POST /{id}/quizzes/generate {title, topic, difficulty, num_questions}` (LLM, *not* grounded in uploaded PDFs).
Student `POST /{id}/quizzes/{qid}/attempt {answers:[int]}` -> server grades by position, one attempt per student.

## Cross-cutting conventions

- Backend imports are absolute (`from backend.x import ...`), so the app must be launched from the repo root as the `backend` package (`uvicorn backend.main:app`). `main.py` inserts the repo root into `sys.path`, but only *after* its first `from backend import ...`, so `cd backend && uvicorn main:app` does not work.
- Env loading: `main.py`, `rag_service.py` load `backend/.env` explicitly; `Database.py`, `auth.py`, `quiz_ai.py`, `profile.py` call bare `load_dotenv()` (searches upward from the calling file, so it also finds `backend/.env`).
- Every router re-implements classroom access checks inline (owner / co-teacher / approved student); there is no shared helper, so the rules differ per module (see [backend.md](backend.md) and [status-and-gotchas.md](status-and-gotchas.md)).
- Feature flags per classroom (`resources_enabled`, `quizzes_enabled`, `flashcards_enabled`, `announcements_enabled`) are stored and returned by the API; only the frontend uses them (tab visibility). The backend never enforces them.
- Supabase client is lazily created and duplicated in `resources.py`, `classroom.py`, `profile.py` and `main.py` (startup bucket check). It returns `None` (-> 503, or 500 in `profile.py`) when `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` are unset or the URL still contains `your-project`.
- `get_db` is defined three times (`Database.py`, `main.py`, `auth.py`); behaviour is identical and most routers import the `Database.py` one.
