# Backend

FastAPI app `Clarix API v1.0.0` in `backend/main.py`. Launch from the **repo root**: `uvicorn backend.main:app --reload` (imports are `from backend.x import ...`). Interactive docs at `/docs`.

## main.py

- Loads `backend/.env`, builds the app, adds a **custom `BaseHTTPMiddleware` named `CORSMiddleware`** (not Starlette's) that echoes whatever `Origin` it receives (or `*`) with `Allow-Credentials: true`; `OPTIONS` is answered with a bare 200. Effectively allow-all (see security notes).
- Includes routers in this order: `auth`, `classroom`, `resources`, `quiz`, `flashcard`, `announcements`, `profile`.
- `GET /` and `GET /health` - liveness.
- `GET /teacher/resources` (teacher only) - every resource across classrooms the teacher **owns** (not co-taught), with classroom name. Used by the Dashboard.
- `WS /ws/{room}/{username}` - in-memory room chat (`ConnectionManager`); **no auth, no persistence, not used by the frontend**.
- `startup` hook (`@app.on_event("startup")`) - `create_all` + the ad-hoc migrations and bucket creation described in [data-model.md](data-model.md).

## Auth (`auth.py`, prefix `/auth`)

| Endpoint | Notes |
| --- | --- |
| `POST /auth/signup` | `{username, email, password, role='student'}`; rejects duplicate username/email; bcrypt hash. **The client chooses its own role, including `teacher`.** Returns 201 with the created user (no token). |
| `POST /auth/login` | JSON `{username, password}` (not the OAuth2 form). Returns `{access_token, token_type, user}` and sets httpOnly cookie `clarix_token` (max-age 1200 s, SameSite=Lax, not Secure). Token payload `{sub, id, role, exp}`, HS256, 20 min. Contains leftover debug `print`s (one prints the user object). |
| `GET /auth/me` | Current user incl. `profile_picture_url`. |

Dependencies: `get_current_user` (cookie first, then `Authorization: Bearer`; re-reads the user from DB each request),
`get_current_teacher` (403 unless `role == 'teacher'`), `get_current_student` (403 unless `role == 'student'`). The role is read from the DB row, not the token claim.
`SECRET_KEY` comes from env but **falls back to a hardcoded string** when unset. No refresh tokens, no logout endpoint (client just drops the token; the cookie is not cleared). `oauth2_scheme` points at a non-existent `auth/token` and is unused.

## Classrooms (`classroom.py`, prefix `/classrooms`)

Teacher checks here use `_is_teacher_or_co_teacher` unless noted.

| Endpoint | Who | Notes |
| --- | --- | --- |
| `POST /upload-banner` | teacher | image -> Supabase `classroom-resources/banners/...`; returns public URL (503 if Supabase unset) |
| `POST /` | teacher | create; `teacher_emails` adds existing *teacher* users as co-teachers |
| `GET /` | any | teacher: owned + co-taught; student: approved enrollments. Includes `student_count`, `teacher_name`, `teacher_profile_picture`, flags |
| `GET /info/{invite_code}` | **public** | preview for the join page (no auth); returns flags, teacher + co-teachers, student_count |
| `GET /{id}` | owner / co-teacher / approved student | detail + counts + co-teachers (no role check for other roles) |
| `PUT /{id}` | owner / co-teacher | full replace of editable fields incl. the 4 feature flags (omitted fields reset to defaults) |
| `DELETE /{id}` | owner only | ORM cascade only (not Chroma/Supabase); **no frontend caller** |
| `POST /{id}/invite` | owner / co-teacher | by student email; enrolls immediately as `approved`; 400 if already enrolled in any status |
| `GET /{id}/students` | teachers (owner/co) / approved students | approved only |
| `DELETE /{id}/students/{sid}` | owner / co-teacher | removes enrollment; **no frontend caller** |
| `POST /join` | student | `{invite_code}`; public -> approved, private -> pending; a previously rejected student can re-apply (note: reject deletes the row, so the "rejected" branch is effectively dead) |
| `GET /{id}/pending`, `POST /{id}/pending/{sid}/approve`, `DELETE /{id}/pending/{sid}/reject` | owner / co-teacher | join-request moderation (reject deletes the row) |

## Resources, folders, annotations, chat (`resources.py`, prefix `/classrooms`)

- Folders: `GET/POST /{id}/folders`, `PUT/DELETE /{id}/folders/{fid}` (delete re-parents contents to the folder's parent). Rename has no frontend caller.
- Resources: `POST /{id}/resources/upload` (multipart: `file`, `folder_id?`, `resource_type`), `GET /{id}/resources`, `PUT /{id}/resources/{rid}` (rename; no frontend caller), `DELETE /{id}/resources/{rid}` (Supabase file + Chroma vectors + row), `PUT /{id}/resources/{rid}/move`, `PUT /{id}/resources/move-batch` (no frontend caller).
- Annotations: `GET/PUT /{id}/resources/{rid}/annotations` (JSON array stored in `Resource.annotations_data`; one shared copy per resource).
- Chat: `GET/POST /{id}/chat/sessions`, `GET /{id}/chat/sessions/{sid}`, `POST /{id}/chat/sessions/{sid}/messages`, plus legacy stateless `POST /{id}/chat` (used by ClassroomDetail's "review sheet") and a stub `GET /{id}/chat/history` that always returns `{"messages": []}` (unused).

Access rules are **not uniform**:

| Operation | Allowed |
| --- | --- |
| upload / delete / rename resource | classroom **owner** only |
| folder create/rename/delete, move, move-batch | owner or co-teacher (`_check_teacher_access`) |
| list resources, list folders, all chat endpoints | owner (teachers) or approved student; **co-teachers get 403** |
| annotations GET/PUT | **any logged-in user** (no classroom membership check, students included) |

Uploads accept `.pdf` by extension only (no size/content-type check), are stored under `public/{ms-timestamp}-{filename}` (filename unsanitized) in bucket `classroom-resources`, and the *public URL* is saved in `Resource.file_path` (returned as `file_url`).
Chat sessions are private per user (`ChatSession.user_id`); `title` is LLM-generated on the first message if empty.

## Quizzes (`quiz.py` + `quiz_ai.py`, prefix `/classrooms`)

| Endpoint | Who | Notes |
| --- | --- | --- |
| `POST /{id}/quizzes` | owner | manual create `{title, description, questions[{question, options[], correct_answer, order}], is_ai_generated}` |
| `GET /{id}/quizzes` | owner / approved student | list with `question_count` |
| `GET /{id}/quizzes/{qid}` | owner / approved student | students get `correct_answer: null`; questions come from the relationship (no explicit ORDER BY) |
| `PUT /{id}/quizzes/{qid}` | owner | title/description; if `questions` given, **delete all + recreate** |
| `DELETE /{id}/quizzes/{qid}` | owner | deletes questions, attempts, quiz |
| `POST /{id}/quizzes/generate` | owner | body `{title, topic, difficulty='medium', num_questions=5}` -> LLM -> saved as `is_ai_generated` quiz with `order = index+1` |
| `POST /{id}/quizzes/{qid}/attempt` | student (approved) | `{answers:[int]}`; **one attempt per student**; score = % correct by position (questions ordered by `order`); response is score + counts only, no per-question review |
| `GET /{id}/quizzes/{qid}/attempts` | owner | list of attempts (does not verify the quiz belongs to the classroom) |
| `GET /{id}/quizzes/{qid}/leaderboard` | **any teacher** | ranked by score desc, ties by DB order; only checks the quiz belongs to `classroom_id`, not that the caller owns it |

`quiz_ai.generate_quiz(topic, difficulty, num_questions)` prompts Ollama (`OLLAMA_MODEL`, default `qwen3.5:latest`, temp 0.7) for a JSON array of `{question, options[4], correct_answer}`,
strips everything up to `</think>` if a `<think>` block is present, then `json.loads` - no fence stripping, schema validation, bounds check on `num_questions`, or retry (malformed output -> 500).
Quizzes are generated **from a topic string only**, not from the classroom's indexed documents.

## Flashcards (`flashcard.py`) and announcements (`announcements.py`)

- Flashcards: `POST/GET /{id}/flashcards`, `PUT/DELETE /{id}/flashcards/{fid}` - owner writes, owner/approved student reads. **No frontend uses it.** Uses `Depends(SessionLocal)` as its DB dependency (a fresh session per request that is never closed).
- Announcements: `GET /{id}/announcements` (owner / approved student), `POST` (owner), `DELETE /{id}/announcements/{aid}` (owner).

## Profile (`profile.py`, prefix `/profile`)

`POST /picture/upload` (image/*, <= 5 MB -> bucket `profile-pictures`, file name `{user_id}_{timestamp}.{ext}`; sets `profile_picture_url` + `profile_picture_updated_at`), `DELETE /picture` (clears the DB columns only; the Supabase object is left), `GET /{user_id}/picture` (**unauthenticated**), `GET /me/details`.

## Other backend files

- `Database.py` - `create_engine(os.getenv("DATABASE_URL"))`; crashes at import if the variable is missing. No `connect_args` (SQLAlchemy 2.x already sets `check_same_thread=False` for SQLite file URLs).
- `rag_service.py`, `rag_pipeline/` - see [rag-pipeline.md](rag-pipeline.md).
