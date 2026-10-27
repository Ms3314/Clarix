# Backend

FastAPI app `Clarix API v1.0.0` in `Backend/main.py`. Launch from the **repo root** (imports are `from Backend import …`).

## main.py

- Loads `Backend/.env`, builds the app, adds a **custom `BaseHTTPMiddleware` "CORS"** that echoes whatever `Origin` it receives (or `*`) with `Allow-Credentials: true` — effectively allow-all (see security notes).
- Includes routers in this order: `auth`, `classroom`, `resources`, `quiz`, `flashcard`, `announcements`, `profile`.
- `GET /` and `GET /health` — liveness.
- `GET /teacher/resources` (teacher only) — every resource across classrooms the teacher **owns**, with classroom name. Used by the Dashboard.
- `WS /ws/{room}/{username}` — in-memory room chat (`ConnectionManager`); **no auth, no persistence, not used by the frontend**.
- `startup` hook — `create_all` + the ad-hoc migrations and bucket creation described in [data-model.md](data-model.md).
- Defines its own `get_db`/`db_dependency`, duplicated in `Database.py` and `auth.py`.

## Auth (`auth.py`, prefix `/auth`)

| Endpoint | Notes |
| --- | --- |
| `POST /auth/signup` | `{username, email, password, role='student'}`; rejects duplicate username/email; bcrypt hash. **The client chooses its own role, including `teacher`.** |
| `POST /auth/login` | JSON `{username, password}` (not the OAuth2 form). Returns `{access_token, token_type, user}` and sets httpOnly cookie `clarix_token` (max-age 1200 s, SameSite=Lax, not Secure). Token payload `{sub, id, role, exp}`, HS256, 20 min. |
| `GET /auth/me` | Current user incl. `profile_picture_url`. |

Dependencies: `get_current_user` (cookie first, then `Authorization: Bearer`; re-reads the user from DB each request),
`get_current_teacher` (403 unless `role == 'teacher'`), `get_current_student`. The role is read from the DB row, not the token claim.
`SECRET_KEY` comes from env but **falls back to a hardcoded string** when unset. No refresh tokens, no logout endpoint (client just drops the token; the cookie is not cleared).

## Classrooms (`classroom.py`, prefix `/classrooms`)

| Endpoint | Who | Notes |
| --- | --- | --- |
| `POST /upload-banner` | teacher | image → Supabase `banners/…`; returns public URL |
| `POST /` | teacher | create; `teacher_emails` adds existing *teacher* users as co-teachers |
| `GET /` | any | teacher: owned + co-taught; student: approved enrollments. Includes `student_count`, `teacher_name`, flags |
| `GET /info/{invite_code}` | **public** | preview for the join page (no auth) |
| `GET /{id}` | owner / co-teacher / approved student | detail + counts + co-teachers |
| `PUT /{id}` | owner / co-teacher | full replace of editable fields incl. the 4 feature flags |
| `DELETE /{id}` | owner only | ORM cascade (not Chroma/Supabase) |
| `POST /{id}/invite` | owner / co-teacher | by student email; enrolls immediately as `approved` |
| `GET /{id}/students` | teachers / enrolled students | approved only |
| `DELETE /{id}/students/{sid}` | owner / co-teacher | removes enrollment |
| `POST /join` | student | `{invite_code}`; public → approved, private → pending; re-apply after rejection |
| `GET /{id}/pending`, `POST /{id}/pending/{sid}/approve`, `DELETE /{id}/pending/{sid}/reject` | owner / co-teacher | join-request moderation (reject deletes the row) |

## Resources, folders, annotations, chat (`resources.py`, prefix `/classrooms`)

Folders: `GET/POST /{id}/folders`, `PUT/DELETE /{id}/folders/{fid}` (delete re-parents contents).
Resources: `POST /{id}/resources/upload` (multipart: `file`, `folder_id?`, `resource_type`), `GET /{id}/resources`,
`PUT /{id}/resources/{rid}` (rename), `DELETE /{id}/resources/{rid}` (Supabase file + Chroma vectors + row),
`PUT /{id}/resources/{rid}/move`, `PUT /{id}/resources/move-batch`.
Annotations: `GET/PUT /{id}/resources/{rid}/annotations` (JSON array stored in `annotations_data`).
Chat: `GET/POST /{id}/chat/sessions`, `GET /{id}/chat/sessions/{sid}`, `POST /{id}/chat/sessions/{sid}/messages`,
plus legacy stateless `POST /{id}/chat` and a stub `GET /{id}/chat/history` that always returns `{"messages": []}`.

Access rules are **not uniform**: upload/delete/rename require the *owner*; folder/move mutations allow owner or co-teacher
(`_check_teacher_access`); reads and chat for teachers require the *owner* only (co-teachers get 403 on `list_resources`, `list_folders`, chat);
students need an `approved` enrollment. Annotation GET/PUT only require a logged-in user (no classroom membership check).
Uploads accept `.pdf` only, are stored under `public/{ms-timestamp}-{filename}` in bucket `classroom-resources`, and the *public URL* is saved in `Resource.file_path`.

## Quizzes (`quiz.py` + `quiz_ai.py`, prefix `/classrooms`)

`POST /{id}/quizzes` (manual create), `GET /{id}/quizzes`, `GET /{id}/quizzes/{qid}` (students get `correct_answer: null`),
`PUT /{id}/quizzes/{qid}` (replace title/description and, if given, delete+recreate all questions),
`DELETE /{id}/quizzes/{qid}`, `POST /{id}/quizzes/generate`, `POST /{id}/quizzes/{qid}/attempt` (student; **one attempt per student**,
score = % correct by index), `GET /{id}/quizzes/{qid}/attempts` and `…/leaderboard` (teacher; leaderboard is by score desc, ties unordered).
`quiz_ai.generate_quiz(topic, difficulty, num_questions)` prompts Ollama for a JSON array of `{question, options[4], correct_answer}`,
strips a `<think>…</think>` prefix, then `json.loads` — no fence stripping, validation or retry (malformed output → 500).
Quizzes are generated **from a topic string only**, not from the classroom's indexed documents. Students do not get per-question review after an attempt (response is score + counts).
Teacher checks are owner-only here.

## Flashcards (`flashcard.py`) and announcements (`announcements.py`)

Flashcards: `POST/GET /{id}/flashcards`, `PUT/DELETE /{id}/flashcards/{fid}` — teacher (owner) writes, enrolled/owner reads. **No frontend uses it.** Uses `Depends(SessionLocal)` as its DB dependency (a fresh unclosed session per request).
Announcements: `GET /{id}/announcements`, `POST …` (owner), `DELETE …/{aid}` (owner).

## Profile (`profile.py`, prefix `/profile`)

`POST /picture/upload` (image/*, ≤5 MB → bucket `profile-pictures`, `upsert`), `DELETE /picture`, `GET /{user_id}/picture`, `GET /me/details`.

## Other backend files

- `Database.py` — `create_engine(DATABASE_URL)`; will crash at import if the variable is missing.
- `rag_service.py`, `rag_pipeline/` — see [rag-pipeline.md](rag-pipeline.md).
- `streamlit_app.py` — standalone demo using OpenAI `gpt-4o-mini` over the `clarix_docs` collection; unrelated to the API.
