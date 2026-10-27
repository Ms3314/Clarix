# Frontend

`Frontend/` — package name `miniproject`. React 19, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), react-router-dom 7, Zustand 5, axios,
@tanstack/react-query (provider mounted but effectively unused), sonner + a Radix toaster, lucide-react, react-markdown + remark-gfm,
`@embedpdf/react-pdf-viewer` / `react-pdf` / `pdfjs-dist` for PDFs, shadcn-style Radix primitives in `components/ui/`. JavaScript/JSX only (no TypeScript).
Path alias `@` → `src`.

## Routing (`src/App.jsx`)

| Route | Page | Guard |
| --- | --- | --- |
| `/` | `Index` — login / register toggle | `GuestRoute` (redirects to `/dashboard` if a token exists) |
| `/join/:code` | `JoinPage` — public classroom preview + join | none |
| `/learn` | `Learn` — full-screen RAG tutor chat | `ProtectedRoute` (no sidebar layout) |
| `/dashboard` | `Dashboard` | `ProtectedLayout` (sidebar `AppLayout`) |
| `/classroom/new` | `CreateClassroom` | `ProtectedLayout` |
| `/classroom/:id` | `ClassroomDetail` | `ProtectedLayout` |
| `/settings` | `Settings` — profile picture | `ProtectedLayout` |
| `*` | `NotFound` | none |

Guards only check that `localStorage['clarix_token']` exists; real validation happens when an API call returns 401 (axios interceptor clears the token and sets `window.location.href = '/'`).
`AuthHydrator` calls `authStore.hydrate()` on load.

## State (`src/stores/`, Zustand)

- `authStore` — `user`, `fetchUser` (5-min staleness, `GET /auth/me`), `setUser`, `logout` (removes token, `resetAllStores`).
- `classroomStore` — list from `GET /classrooms/` with 2-min staleness cache.
- `classroomDetailStore` — per-classroom entity cache keyed `id:entity` (`classroom, students, resources, quizzes, announcements, folders, pending`), 5-min staleness, `fetchAll`, `invalidateEntity`, `setEntityData`.
- `learnStore` — chat sessions + messages per session for `/learn`.
- `uploadStore` — sequential upload queue (`addFiles` → `processNext`) feeding the global `UploadBanner` in `AppLayout`; posts to `…/resources/upload`.
- `lib/resetStores.js` — clears all stores on logout (must be extended when a store is added).

## Pages worth knowing

- **ClassroomDetail** (~880 lines) — the hub. Tabs: Overview, Announcements, Students (teacher), Resources, Quizzes, plus Settings (teacher). Handles announcements, inviting students by email, approving/rejecting pending joins, folder create/delete, move/delete resources, an AI-chat modal using the legacy stateless `POST …/chat`, and the upload dialog. Embeds `ResourceBrowser`, `PdfViewerPanel`, `ClassroomSettings`, `QuizTab`.
- **QuizTab** (~870 lines) — list / create / edit / take / results / leaderboard modes; manual builder and AI generation (topic, difficulty, count); teacher sees attempts and leaderboard, student attempts once.
- **Learn** — classroom picker, session sidebar, markdown-rendered chat against `…/chat/sessions/{sid}/messages`, resource list, PDF viewer.
- **PdfViewerPanel** — views a resource and auto-saves annotations through the annotations endpoints.
- **Dashboard** — teacher: classrooms + all resources (`/teacher/resources`); student: join by code (`POST /classrooms/join`).
- **Index** — `POST /auth/login`, `POST /auth/signup` (role picker is client-side).

## API layer

`src/lib/api.js`: axios instance, `baseURL: 'http://localhost:8000'` (**hardcoded, no env var**), `withCredentials: true`, Bearer header from localStorage.
All endpoints used are listed in [backend.md](backend.md); the frontend never calls the flashcard routes, `GET /{id}/pending` aside from the detail store, or the legacy `/chat/history`.

## Styling

Actual UI is a **light, warm theme** (page bg `#faf8f6`, borders `#e8e4e0`, accent green `#4a7c59`) with Tailwind utility classes.
`Frontend/DESIGN.md` still describes a dark-only `#0d0d0d` design and is stale. `index.css` holds the theme tokens.

## Dead / orphaned code

Nothing imports these (the barrel `components/classroom/index.js` re-exports some but is itself unused): `ClassroomTabs`, `ComingSoonTabs` (the "Flashcards coming soon" stub),
`OverviewTab`, `ResourcesTab`, `StudentsTab`, `ClassroomNav`, `CreateClassroomModal`, `components/chat/ChatTab`, `StudentProfileCard`, and `lib/supabase.js`
(a Supabase JS client with placeholder URL/key; the frontend uploads through the backend instead).
