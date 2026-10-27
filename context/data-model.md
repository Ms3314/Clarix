# Data Model

Source: `Backend/models.py` (SQLAlchemy declarative `Base` from `Backend/Database.py`).
Tables are created on startup via `Base.metadata.create_all`, then `main.py` runs ad-hoc `ALTER TABLE` migrations (below).
There is **no Alembic**.

## Tables

| Table | Model | Key columns / notes |
| --- | --- | --- |
| `users` | `Users` | `username` (unique), `email` (unique), `hashed_password` (bcrypt), `role` ('teacher'\|'student', default student), `unique_id` (8-char uuid), `is_active`, `profile_picture_url`, `profile_picture_updated_at`, `created_at` |
| `classrooms` | `Classroom` | `name`, `description`, `subject`, `icon` (default 'sigma'), `banner`, `banner_color`, `is_public`, 4 feature flags (`resources_enabled`, `quizzes_enabled`, `flashcards_enabled`, `announcements_enabled`), `teacher_id` → users (owner), `invite_code` (unique, 6-char upper uuid slice) |
| `classroom_teachers` | `ClassroomTeacher` | co-teacher link: `classroom_id`, `teacher_id` |
| `enrollments` | `Enrollment` | `user_id`, `classroom_id`, `status` ('pending'\|'approved'\|'rejected', default approved), `enrolled_at` |
| `folders` | `Folder` | `classroom_id`, `name`, `parent_id` (self-ref, nestable) |
| `resources` | `Resource` | `classroom_id`, `folder_id`, `filename`, `file_path` (**public Supabase URL**, not a path), `file_size`, `resource_type` ('notes'\|'pyq'\|'other'), `indexed`, `indexed_at`, `annotations_data` (JSON text), `personal_copy_of` + `owner_id` (declared, unused by any route) |
| `quizzes` | `Quiz` | `classroom_id`, `title`, `description`, `created_by`, `is_ai_generated` |
| `quiz_questions` | `QuizQuestion` | `quiz_id`, `question`, `options` (JSON string of strings), `correct_answer` (int index), `order` |
| `quiz_attempts` | `QuizAttempt` | `quiz_id`, `student_id`, `score` (0–100 float), `total_questions`, `answers` (JSON list of ints) |
| `flashcards` | `Flashcard` | `classroom_id`, `front`, `back`, `created_by` |
| `announcements` | `Announcement` | `classroom_id`, `teacher_id`, `title`, `content` |
| `chat_sessions` | `ChatSession` | `classroom_id`, `user_id`, `title` (nullable, auto-generated) — private per user |
| `chat_messages` | `ChatMessage` | `session_id`, `role` ('user'\|'assistant'), `content` |

## Relationships / cascades

- `Classroom` cascades `all, delete-orphan` to co-teacher links, enrollments, resources, folders, quizzes, flashcards, announcements.
  **Not** cascaded: `chat_sessions` (plain FK, no relationship cascade) and the Chroma vectors / Supabase files — deleting a classroom leaves those behind.
- `Quiz` cascades to questions and attempts. `ChatSession` cascades to messages.
- `Folder` cascades to children and resources via ORM, but the folder-delete endpoint first re-parents children/resources to the folder's parent.

## Startup migrations (`main.py` `startup_event`)

Idempotent, each wrapped in try/except that only prints a note on failure:
`chat_sessions.title`; classroom columns (`subject, icon, is_public, banner, banner_color`, 4 flags); `folders` table
(raw `CREATE TABLE IF NOT EXISTS … id SERIAL PRIMARY KEY` — **PostgreSQL syntax**, a no-op on SQLite because `create_all` already made it);
resources columns (`folder_id, resource_type, personal_copy_of, owner_id, annotations_data`); users columns (`profile_picture_url, profile_picture_updated_at`);
then ensure Supabase buckets `classroom-resources` and `profile-pictures` exist (created public).
`PROFILE_MIGRATION.sql` is the manual equivalent for the profile columns.

## Database engine

`DATABASE_URL` from `.env`. `Backend/example.env` shows `sqlite:///./todosapp.db`, but `create_engine` is called with no
`connect_args`, so SQLite would need `check_same_thread=False` (the old Backend README claims it's set; it isn't). The raw SQL
and PROFILE docs hint the real deployment target is PostgreSQL (Supabase). Confirm which one your `.env` uses before debugging DB issues.
