# Status, Gotchas, and Security Notes

Snapshot verified against the code on 2026-10-27 (branch `main`, after commit `2119eec` "refactored file structure": `backend/`, `frontend/`, docs moved to `context/`).

## Feature status

| Area | State |
| --- | --- |
| Auth, roles, profile pictures | Working |
| Classrooms (create, edit, flags, banners, co-teachers, invite code, public/private join + approval) | Working; co-teacher support is partial (see bug 9) |
| Resources (PDF upload, folders, move, delete, annotations, PDF viewer) | Working; indexing is synchronous inside the upload request; rename/move-batch/folder-rename endpoints have no UI |
| RAG tutor (`/learn`, per-user chat sessions, auto titles) | Working end-to-end; no citations in answers; no streaming |
| Past-year question (PYQ) indexing | Indexed with rich metadata, but nothing queries `find_similar_questions` yet |
| Quizzes (manual + AI generation, attempt, leaderboard) | Working; AI quizzes ignore uploaded material; students see only a score |
| Announcements | Working |
| Flashcards | Backend CRUD only; UI is an unmounted "coming soon" stub |
| Real-time chat (WebSocket) | Backend stub only; group/peer chat and podcast-style lessons from the README pitch are not implemented |
| Tests / CI | None for the app (RAG evals live in `evals/`, see [evals.md](evals.md)) |

## Bugs and sharp edges (each re-checked in code on 2026-10-27)

1. **`uploadStore.js` calls store methods that don't exist** (`fetchResourcesStore`, `fetchFoldersStore` - those are local aliases in `ClassroomDetail.jsx`; the store exposes `fetchResources`/`fetchFolders`). The `TypeError` is swallowed by a bare `catch {}`, so after an upload the lists only refresh because `invalidateEntity` marks them stale.
2. **Quiz generation parsing is brittle** - `json.loads` on raw LLM text (`quiz_ai.py`); code fences or prose -> HTTP 500; no validation of `correct_answer`/option count, no bound on `num_questions`. The `<think>` block is stripped here but not in RAG answers.
3. **Editing a quiz after attempts exist** deletes/recreates questions (new ids, possibly different order) while stored `answers` are positional - old attempts become misleading. Scores already stored are not recomputed. `GET quiz` returns questions without ORDER BY while grading orders by `order`; they only agree because the UI writes monotonic `order` values.
4. **Deleting a classroom** (API only; no UI) orphans its Chroma collection, Supabase files, and `chat_sessions` rows (and may raise an FK error on Postgres).
5. **Re-indexing duplicates vectors** (`add_documents` without ids). There is no re-index endpoint, so this only bites if you add one. A failed index leaves the resource `indexed=false` with no retry path.
6. **Embedding switch** (MiniLM -> `nomic-embed-text-v2-moe`): collections built with the old model must be rebuilt.
7. **Chroma/Ollama handles rebuilt per call** (`get_vectorstore`, `ChatOllama`, a DB lookup for the invite code on every query) - slow under load.
8. **`flashcard.py` uses `Depends(SessionLocal)`** -> sessions are never closed. `quiz.py` still declares an unused `db_dependency = Annotated[Session, Depends(SessionLocal)]` (its routes use `get_db`).
9. **Co-teacher support is partial**: `classroom.py` and folder mutations/move honor co-teachers; upload/delete/rename resources, quizzes, announcements, flashcards, `/teacher/resources`, delete classroom, resource/folder reads and all chat endpoints are owner-only (co-teachers get 403 on list resources/folders).
10. **Renaming a classroom wipes its settings**: `ClassroomDetail` sends `PUT /classrooms/{id}` with only `{name}`; `ClassroomUpdate` defaults every other field (description, subject, icon, banner, `is_public=False`, all flags `True`), so they are reset.
11. **Learn page groups every conversation under "Older"** (`groupByTime` reads a `timeCategory` field that no store sets).
12. **SQLite vs Postgres**: raw `SERIAL PRIMARY KEY` in the startup migration is Postgres-only (harmless no-op on SQLite); know which DB `.env` points at. (`check_same_thread` is not an issue with SQLAlchemy 2.x.)
13. **Route guards only test that a token string exists** - an expired/invalid token shows protected pages until the first API call returns 401.
14. **Chunker edge case**: `chunker.chunk_text` cuts at the first separator type present anywhere in the window, which can produce tiny chunks. Measured on the OSTEP book at 500/50: 58 of 3,746 chunks (1.5%) are under 100 chars, median 464, so the impact is small (see [rag-pipeline.md](rag-pipeline.md)).
15. **Leaderboard/attempts scoping**: `GET .../leaderboard` is readable by any teacher for any classroom's quiz; `GET .../attempts` does not check the quiz belongs to the classroom.
16. **Debug leftovers**: `auth.py` login prints (including the user object); `main.py` startup prints; `backend/.gitignore` contains the typo `_pycache_` (the root `.gitignore` covers `__pycache__/`).
17. **Dead code** - frontend (see [frontend.md](frontend.md)), and backend RAG helpers/LangGraph path (see [rag-pipeline.md](rag-pipeline.md)); `@tanstack/react-query` is wrapped around the app but unused; `Resource.personal_copy_of`/`owner_id` are unused columns; `requirements.txt` lists unused packages.
18. **External CDNs**: pdf.js worker from `unpkg.com`, fonts from Google Fonts, preset banners from Unsplash - the UI degrades offline.

## Security notes (fix before any real deployment)

- `POST /auth/signup` lets anyone self-assign `role: "teacher"` (the UI offers the choice).
- CORS middleware reflects any `Origin` with `Allow-Credentials: true` (works with the cookie, so cross-site requests can ride the session; SameSite=Lax mitigates only partially).
- `SECRET_KEY` has a hardcoded fallback in `auth.py`; if `.env` is missing the JWT key is public in git.
- Cookie is not `Secure`; the token is *also* stored in `localStorage` (XSS-exposed). 20-minute tokens with no refresh flow; logout doesn't clear the cookie server-side.
- Supabase buckets are **public**; every PDF URL is guessable-by-timestamp + filename and readable by anyone with the link, including non-members. Uploaded filenames are used unsanitized in the storage path. Deleting a profile picture does not delete the stored object.
- Annotation endpoints only require a valid login, not classroom membership, and a single annotation blob is shared per resource, so any user (even a student or outsider who knows the ids) can overwrite it. `GET /classrooms/info/{code}`, `GET /profile/{user_id}/picture` and the WebSocket route are unauthenticated.
- Uploads trust the `.pdf` extension only (no content-type/size limit for resources; profile pictures are limited to 5 MB images).
- Student-facing LLM prompt injection from PDF content is untested.
- The embedded fallback `SECRET_KEY` and the open CORS/role rules mean a deployment must set `.env` and tighten these first.

## Stale docs

None in the repo root. Historical docs live in `context/archive/` (see [archive/README.md](archive/README.md)); `AGENTS.md` was rewritten on 2026-10-27 to point here.

## Suggested next steps (not started)

1. Add `OLLAMA_MODEL` to `backend/example.env` and prune unused requirements.
2. Harden auth: server-side role assignment, required `SECRET_KEY`, scoped CORS, `Secure` cookie, membership checks on annotations.
3. Return retrieved chunks/citations from the tutor; store the filename/URL in chunk metadata instead of the temp path. A similarity threshold will not catch in-domain unanswerable questions (see [evals.md](evals.md)); refusal must come from the prompt.
4. Port the retrieval improvements measured in `evals/results/RESULTS.md` (strip running headers/footers before chunking, ~1000-char chunks, stronger embeddings) into `backend/rag_service.py` and re-index.
5. Fix the small UI bugs (uploadStore method names, classroom rename payload, Learn grouping).
6. Build the flashcards UI (backend is ready) or remove the stub; delete dead frontend components and the unused LangGraph library path.

## Changelog of this folder

- 2026-10-26 - initial snapshot from a full read of the repo.
- 2026-10-27 - re-verified after the `backend/` + `frontend/` rename and the move of old docs to `archive/`; Streamlit demo removed from docs; added bugs 10, 11, 15-18; removed the doc-drift table for archived docs.
