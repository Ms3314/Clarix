# Status, Gotchas, and Doc Drift

Snapshot as of 2026-10-26 (branch `main`, HEAD `51f9eda`; uncommitted: Groq → Ollama in `rag_service.py`, `quiz_ai.py`, `qp_chunker.py`; untracked `Clarix Evals Plan.md`).

## Feature status

| Area | State |
| --- | --- |
| Auth, roles, profile pictures | Working (profile feature has its own set of docs) |
| Classrooms (create, edit, flags, banners, co-teachers, invite code, public/private join + approval) | Working |
| Resources (PDF upload, folders, move, rename, delete, annotations, PDF viewer) | Working; indexing is synchronous inside the upload request |
| RAG tutor (`/learn`, per-user chat sessions, auto titles) | Working end-to-end; no citations in answers; no streaming |
| Past-year question (PYQ) indexing | Indexed with rich metadata, but nothing queries `find_similar_questions` yet |
| Quizzes (manual + AI generation, attempt, leaderboard) | Working; AI quizzes ignore uploaded material |
| Announcements | Working |
| Flashcards | Backend CRUD only; UI is a "coming soon" stub that isn't even mounted |
| Real-time chat (WebSocket) | Backend stub only; podcasts, group/peer chat from the README pitch are not implemented |

## Bugs and sharp edges

1. **`uploadStore.js` calls store methods that don't exist** (`fetchResourcesStore`, `fetchFoldersStore` — the store exposes `fetchResources`/`fetchFolders`). The `TypeError` is swallowed by a bare `catch {}`, so after an upload the lists only refresh because `invalidateEntity` marks them stale.
2. **Quiz generation parsing is brittle** — `json.loads` on raw LLM text; code fences or prose → HTTP 500. The Ollama model's `<think>` block is stripped here but not in RAG answers.
3. **Editing a quiz after attempts exist** deletes/recreates questions (new ids, possibly different order) while stored `answers` are positional — old attempts become unreadable/misleading. Scores already stored are not recomputed.
4. **Deleting a classroom** orphans its Chroma collection, Supabase files, and `chat_sessions` rows.
5. **Re-indexing duplicates vectors** (path A adds documents without ids). There is no re-index endpoint today, so this only bites if you add one.
6. **Embedding switch** (MiniLM → `nomic-embed-text-v2-moe`): existing Chroma collections must be rebuilt.
7. **Chroma/Ollama handles rebuilt per call** (`get_vectorstore`, `ChatOllama`, DB lookup for the invite code) — slow under load.
8. **`flashcard.py` uses `Depends(SessionLocal)`** → sessions are never closed. `quiz.py` declares an unused `db_dependency` the same way.
9. **Co-teacher support is partial**: classroom.py, folder mutations and move honor co-teachers; upload/delete/rename resources, quizzes, announcements, flashcards, `/teacher/resources`, resource/folder reads and chat are owner-only.
10. **SQLite vs Postgres**: raw `SERIAL PRIMARY KEY` in the startup migration and no `check_same_thread` for SQLite; know which DB `.env` points at.
11. **Route guards only test that a token string exists** — an expired/invalid token shows protected pages until the first API call returns 401.
12. **Dead frontend code** — see [frontend.md](frontend.md); `@tanstack/react-query` is wrapped around the app but no component uses `useQuery` (all fetching goes through Zustand).

## Security notes (fix before any real deployment)

- `POST /auth/signup` lets anyone self-assign `role: "teacher"`.
- CORS middleware reflects any `Origin` with `Allow-Credentials: true` (works with the cookie ⇒ cross-site requests can ride the session; SameSite=Lax mitigates only partially).
- `SECRET_KEY` has a hardcoded fallback in `auth.py`; if `.env` is missing the JWT key is public in git.
- Cookie is not `Secure`; token is *also* stored in `localStorage` (XSS-exposed). 20-minute tokens with no refresh flow; logout doesn't clear the cookie server-side.
- Supabase buckets are **public**; every PDF URL is guessable-by-timestamp + filename and readable by anyone with the link, including non-members.
- Annotation endpoints only require a valid login, not classroom membership. `GET /classrooms/info/{code}` and the WebSocket route are unauthenticated.
- Uploads trust the `.pdf` extension only (no content-type/size limit for resources; profile pictures are limited to 5 MB images).
- Student-facing LLM prompt injection from PDF content is untested (the evals plan proposes testing it).

## Doc drift (what the older docs get wrong)

| Doc | Says | Reality |
| --- | --- | --- |
| `AGENTS.md` "Run Commands" | `cd Backend && uvicorn main:app` | Must run from root as `Backend.main:app` |
| `AGENTS.md` "Known Issues (Being Fixed)" | Vite alias, UI packages, pages, SECRET_KEY, roles are pending | All done (alias, deps, pages, roles exist); only the SECRET_KEY *fallback* remains |
| `AGENTS.md` RAG section | LangGraph StateGraph is the integrated pipeline; `all-MiniLM-L6-v2` embeddings | App uses `rag_service.py` directly; embeddings are Ollama (uncommitted) / MiniLM at HEAD; LangGraph path is only used by Streamlit |
| `Backend/README.md` | GPT-4o-mini for answers, SQLite w/ `check_same_thread=False`, no profile/folder endpoints | Ollama/Groq, no `connect_args`, many more endpoints |
| `Frontend/DESIGN.md` | Dark-only theme, 4 routes | Light warm theme, 8 routes |
| `PROFILE_*.md`, `QUICKSTART.md`, `START_HERE.md`, `IMPLEMENTATION_REPORT.md` | Profile-picture feature docs, "complete and ready for testing" | Accurate in scope but unrelated to the rest of the system; seven overlapping files |
| `Clarix Evals Plan.md` | Written without repo access (from the resume): assumes Gemini vision for handwriting, citations, refresh-token auth, WebSocket chat load tests | Handwriting uses **Tesseract OCR**, answers carry **no citations**, there are **no refresh tokens**, WebSocket chat has no UI. Rename/adjust its eval steps accordingly |

## Evals plan — what maps to the code

The untracked evals plan (retrieval Hit@k/MRR, groundedness, citations, quiz validity, auto-grading tests) is the main forward-looking work item.
Code facts it needs: pipeline functions are `is_handwritten`, `extract_text`, `create_langchain_documents`/`smart_chunk_question_paper`, `query_resources`, `generate_rag_response`
in `rag_service.py`/`rag_pipeline/indexing/`; chunking is 500 chars / 50 overlap; retrieval is top-4 dense search per classroom collection with no reranker or score threshold;
page provenance is in `metadata.page` + `metadata.resource_id` (not `source`); quiz grading is the `attempt_quiz` function (percent, no negative marking, no timing, one attempt, no double-submit lock beyond the "already attempted" check).
To make evals possible you will probably need: citations (or at least returned source chunks) from `generate_rag_response`, an offline script that bypasses the DB/HTTP layer, and a fixed Chroma snapshot or a local Chroma client.

## Suggested next steps (not started)

1. Commit the Ollama migration and update `requirements.txt`/`example.env` (`OLLAMA_MODEL`).
2. Harden auth: server-side role assignment, required `SECRET_KEY`, scoped CORS, `Secure` cookie.
3. Return retrieved chunks/citations from the tutor and add a similarity threshold (unlocks the evals).
4. Build the flashcards UI (backend is ready) or remove the stub.
5. Delete dead frontend components and consolidate the profile docs.

## Changelog of this folder

- 2026-10-26 — initial snapshot from a full read of the repo.
