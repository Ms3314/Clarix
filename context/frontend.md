# Frontend

`frontend/` - package name `miniproject`. React 19, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), react-router-dom 7, Zustand 5, axios,
`@tanstack/react-query` (provider mounted but **no `useQuery`/`useMutation` anywhere**), sonner for toasts, lucide-react, react-markdown + remark-gfm,
`@embedpdf/react-pdf-viewer` (annotating viewer), `react-pdf` / `pdfjs-dist` (thumbnails), shadcn-style Radix primitives in `src/components/ui/`. JavaScript/JSX only (no TypeScript).
Path alias `@` -> `src` (`frontend/vite.config.js`). Scripts: `npm run dev | build | lint | preview`. ESLint 9 flat config (`frontend/eslint.config.js`) with `no-unused-vars` ignoring names that start with an uppercase letter or `_` (`varsIgnorePattern: '^[A-Z_]'`).
`frontend/README.md` is the untouched Vite template text.

## Routing (`src/App.jsx`)

| Route | Page | Guard |
| --- | --- | --- |
| `/` | `Index` - login / register toggle (register has a student/teacher role picker) | `GuestRoute` (redirects to `/dashboard` if a token exists) |
| `/join/:code` | `JoinPage` - public classroom preview + join | none |
| `/learn` | `Learn` - full-screen RAG tutor chat (own layout, no sidebar) | `ProtectedRoute` |
| `/dashboard` | `Dashboard` | `ProtectedLayout` (sidebar `AppLayout`) |
| `/classroom/new` | `CreateClassroom` | `ProtectedLayout` |
| `/classroom/:id` | `ClassroomDetail` | `ProtectedLayout` |
| `/settings` | `Settings` - profile picture, account info, logout | `ProtectedLayout` |
| `*` | `NotFound` | none |

Guards only check that `localStorage['clarix_token']` exists; real validation happens when an API call returns 401 (axios interceptor clears the token and sets `window.location.href = '/'`).
`AuthHydrator` calls `authStore.hydrate()` on load. `App.jsx` mounts both sonner's `<Toaster>` and a local `ui/toaster.jsx` that renders `null` (stub); toasts are sonner only.

## State (`src/stores/`, Zustand)

- `authStore` - `user`, `fetchUser` (5-min staleness, `GET /auth/me`), `setUser`, `logout` (removes token, `resetAllStores`; no server call), `hydrate`.
- `classroomStore` - list from `GET /classrooms/` with 2-min staleness cache; `invalidate`.
- `classroomDetailStore` - per-classroom entity cache keyed `id:entity` (`classroom, students, resources, quizzes, announcements, folders, pending`), 5-min staleness; `fetchAll` (all except `pending`), per-entity `fetchX(id, force)`, `invalidateEntity`, `setEntityData`.
- `learnStore` - chat sessions + messages per session for `/learn`.
- `uploadStore` - sequential upload queue (`addFiles` -> `processNext`, `retryAll`, `clearAll`) feeding the global `UploadBanner` in `layouts/AppLayout.jsx`; posts to `.../resources/upload`.
- `lib/resetStores.js` - clears all five stores on login/logout (must be extended when a store is added). `learnStore.reset` exists but is not what `resetAllStores` calls.

## Pages worth knowing

- **ClassroomDetail** (~880 lines) - the hub. Tabs: Overview, Students, then Announcements / Resources / Quizzes (shown only when the classroom's flag is on), plus Settings (teacher). Handles announcements, inviting students by email, approving/rejecting pending joins (teacher), folder create/delete, move/delete resources, upload dialog, and a "review sheet" generator that calls the legacy stateless `POST .../chat` and downloads the answer as `.txt`. Embeds `ResourceBrowser`, `PdfViewerPanel`, `ClassroomSettings`, `QuizTab`. Classroom rename via `PUT /classrooms/{id}` with only `{name}` (which resets other editable fields to defaults, see backend `ClassroomUpdate`).
- **QuizTab** (~870 lines) - list / create / edit / take / results / leaderboard modes; manual builder (4 options) and AI generation (topic, difficulty, count; sends `title: "Quiz: <topic>"`); teacher sees attempts and leaderboard, student attempts once.
- **Learn** - classroom picker (first classroom auto-selected), session sidebar, markdown-rendered chat against `.../chat/sessions/{sid}/messages`, resource list, and a PDF `<iframe>` of `file_url`. The sidebar groups conversations by a `timeCategory` field that nothing sets, so every conversation lands under "Older". The paperclip button only shows a toast. Session titles are set client-side to the first 25 chars, then replaced by the server's LLM title.
- **ResourceBrowser** - folder/file grid with drag-to-move; PDF thumbnails via `react-pdf` (pdf.js worker is loaded from `unpkg.com`, an external CDN dependency).
- **PdfViewerPanel** - views a resource in `@embedpdf/react-pdf-viewer` and auto-saves annotations (exports every 3 s and `PUT`s `.../annotations` when the snapshot changed).
- **Dashboard** - teacher: classrooms + all owned resources (`/teacher/resources`) + "Add New Classroom"; student: join by invite code (`POST /classrooms/join`).
- **CreateClassroom** / **ClassroomSettings** - name, description, subject, icon (sigma/flask/scroll), banner (upload or preset Unsplash image URL), public/private, feature toggles; create also takes co-teacher emails.
- **Settings** - `GET /profile/me/details`, upload (client-side 5 MB check) / delete profile picture, logout.
- **Index** - `POST /auth/login`, `POST /auth/signup`; errors surface through `alert()`.
- **JoinPage** - `GET /classrooms/info/{code}`, then `POST /classrooms/join`; logged-out users are sent to `/` with `join_redirect` saved.

## API layer

`src/lib/api.js`: axios instance, `baseURL: 'http://localhost:8000'` (**hardcoded, no env var**), `withCredentials: true`, Bearer header from localStorage, 401 -> clear token + redirect to `/`.
Backend endpoints with **no frontend caller**: all `/flashcards`, `DELETE /classrooms/{id}`, `DELETE .../students/{sid}`, `PUT .../folders/{fid}` (rename), `PUT .../resources/{rid}` (rename), `PUT .../resources/move-batch`, `GET .../chat/history`, `GET /profile/{user_id}/picture`, and the `/ws/...` WebSocket.
All endpoints are listed in [backend.md](backend.md).

## Styling

Actual UI is a **light, warm theme** (page bg `#faf8f6`, borders `#e8e4e0`, accent green `#4a7c59`; Inter + Playfair Display from Google Fonts in `index.html`) using Tailwind utilities. Theme tokens are in `src/index.css` (`@theme`). The old `FRONTEND_DESIGN.md` (dark `#0d0d0d` theme) is archived and no longer matches.

## Dead / orphaned code

Nothing imports these (the barrel `components/classroom/index.js` re-exports some of them but is itself unused): `ClassroomTabs`, `ComingSoonTabs` (the "Flashcards coming soon" stub), `OverviewTab`, `ResourcesTab`, `StudentsTab`, `ClassroomNav`, `CreateClassroomModal`,
`components/chat/ChatTab`, `components/StudentProfileCard`, `hooks/use-toast.jsx`, `lib/supabase.js` (a Supabase JS client with placeholder URL/key from `VITE_SUPABASE_*`; the frontend uploads through the backend instead, so `@supabase/supabase-js` is an unneeded dependency),
and the Vite template leftovers `src/App.css`, `src/assets/*`. `frontend/public/icons.svg` is also unreferenced by the code reviewed.
