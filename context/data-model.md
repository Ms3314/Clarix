# Data Model

Source: `backend/models.py` (SQLAlchemy declarative `Base` from `backend/Database.py`).
Tables are created on startup via `Base.metadata.create_all`, then `backend/main.py` runs ad-hoc `ALTER TABLE` migrations (below).
There is **no Alembic**. All timestamps are naive `datetime.utcnow`.

## Tables

| Table | Model | Key columns / notes |
| --- | --- | --- |
| `users` | `Users` | `username` (unique), `email` (unique), `hashed_password` (bcrypt), `role` ('teacher'\|'student', default student, not constrained), `unique_id` (8-char uuid slice, unique), `is_active`, `profile_picture_url`, `profile_picture_updated_at`, `created_at` |
| `classrooms` | `Classroom` | `name`, `description`, `subject`, `icon` (default 'sigma'; UI offers sigma/flask/scroll), `banner`, `banner_color`, `is_public`, 4 feature flags (`resources_enabled`, `quizzes_enabled`, `flashcards_enabled`, `announcements_enabled`), `teacher_id` -> users (owner), `invite_code` (unique, 6-char upper uuid slice) |
| `classroom_teachers` | `ClassroomTeacher` | co-teacher link: `classroom_id`, `teacher_id` |
| `enrollments` | `Enrollment` | `user_id`, `classroom_id`, `status` ('pending'\|'approved'\|'rejected', default approved; 'rejected' is never written because reject deletes the row), `enrolled_at`. No unique constraint on (user, classroom) |
| `folders` | `Folder` | `classroom_id`, `name`, `parent_id` (self-ref, nestable), `created_at` |
| `resources` | `Resource` | `classroom_id`, `folder_id`, `filename`, `file_path` (**public Supabase URL**, not a path), `file_size`, `resource_type` ('notes'\|'pyq'\|'other'), `indexed`, `indexed_at`, `annotations_data` (JSON text, one shared copy), `personal_copy_of` + `owner_id` (declared and migrated, unused by any route), `created_at` |
| `quizzes` | `Quiz` | `classroom_id`, `title`, `description`, `created_by`, `is_ai_generated`, `created_at` |
| `quiz_questions` | `QuizQuestion` | `quiz_id`, `question`, `options` (JSON string of strings), `correct_answer` (int index), `order` |
| `quiz_attempts` | `QuizAttempt` | `quiz_id`, `student_id`, `score` (0-100 float), `total_questions`, `answers` (JSON list of ints, positional), `attempted_at`. "One attempt per student" is enforced in code only, not by a constraint |
| `flashcards` | `Flashcard` | `classroom_id`, `front`, `back`, `created_by` |
| `announcements` | `Announcement` | `classroom_id`, `teacher_id`, `title`, `content` |
| `chat_sessions` | `ChatSession` | `classroom_id`, `user_id`, `title` (nullable, LLM-generated) - private per user |
| `chat_messages` | `ChatMessage` | `session_id`, `role` ('user'\|'assistant'), `content` |

## Relationships / cascades

- `Classroom` cascades `all, delete-orphan` to co-teacher links, enrollments, resources, folders, quizzes, flashcards, announcements.
  **Not** cascaded: `chat_sessions` (`ChatSession.classroom` is a one-way relationship with no cascade) and the Chroma vectors / Supabase files. Deleting a classroom leaves those behind; on SQLite (FKs not enforced by default) the `chat_sessions` rows are simply orphaned, on Postgres the delete would hit an FK violation if any session exists (not tested).
- `Quiz` cascades to questions and attempts. `ChatSession` cascades to messages.
- `Folder` cascades to children and resources via ORM, but the folder-delete endpoint first re-parents children/resources to the folder's parent.

## Startup migrations (`backend/main.py` `startup_event`)

Idempotent, each block wrapped in try/except that only prints a `[Startup]` note on failure:
`chat_sessions.title`; classroom columns (`subject, icon, is_public, banner, banner_color`, 4 flags); `folders` table
(raw `CREATE TABLE IF NOT EXISTS ... id SERIAL PRIMARY KEY` - **PostgreSQL syntax**, a no-op on SQLite because `create_all` already made the table);
resources columns (`folder_id, resource_type, personal_copy_of, owner_id, annotations_data`); users columns (`profile_picture_url, profile_picture_updated_at`);
then ensure Supabase buckets `classroom-resources` and `profile-pictures` exist (created public). The bucket step is skipped when `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` are unset or placeholder.
The old `PROFILE_MIGRATION.sql` (archived) is obsolete: these startup blocks add the profile columns automatically.

## Database engine

`DATABASE_URL` from `backend/.env`. `backend/example.env` shows `sqlite:///./todosapp.db` (a relative path, so the file lands in whatever directory uvicorn is started from; `*.db` is gitignored and the tracked root `todosapp.db` was deleted).
`create_engine` is called with no `connect_args`; with the installed SQLAlchemy 2.0.x, SQLite file databases get `check_same_thread=False` automatically, so this is not a problem.
The raw `SERIAL` SQL and the Supabase storage usage suggest the real deployment target is PostgreSQL (Supabase); the README stack line says Postgres/Supabase. Confirm which one your `.env` uses before debugging DB issues.
