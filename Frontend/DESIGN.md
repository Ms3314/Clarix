# Clarix — Frontend Design Document

## Theme & Styling

- **Color scheme:** Dark mode only (`#0d0d0d` background, `#111111` card surfaces, `#333333` borders)
- **CSS framework:** Tailwind CSS v4 with `@tailwindcss/vite` plugin
- **UI library:** shadcn/ui components (button, card, input, sidebar, sheet, dropdown-menu, etc.)
- **Icons:** lucide-react
- **CSS variables** defined in `index.css` via `@theme` block for shadcn compatibility

---

## Routing Structure

| Route | Page | Auth | Layout |
|---|---|---|---|
| `/` | Index (Login/Register) | Public | None (standalone) |
| `/learn` | Learn (RAG Chat) | Protected (token check) | None (standalone, full-screen) |
| `/dashboard` | Dashboard | Protected | AppLayout (sidebar) |
| `/classroom/:id` | Classroom Detail | Protected | AppLayout (sidebar) |
| `*` | 404 Not Found | Public | None |

### Auth Guards

- **`ProtectedRoute`** — Checks `localStorage.getItem('clarix_token')`, redirects to `/` if missing
- **`ProtectedLayout`** — Same check, then wraps children in `<AppLayout>` (sidebar)

---

## Page Designs

---

### 1. Index (`/`) — Login / Register

**Layout:** Centered card on dark background. No sidebar.

```
┌─────────────────────────────────────┐
│                                     │
│        ┌───────────────────┐        │
│        │   ⓒ              │        │
│        │                   │        │
│        │  Welcome Back     │        │
│        │  Sign in to your  │        │
│        │  account           │        │
│        │                   │        │
│        │  [Username]       │        │
│        │  [Password]       │        │
│        │                   │        │
│        │  [Sign In]        │        │
│        │                   │        │
│        │  Don't have an    │        │
│        │  account? Register│        │
│        └───────────────────┘        │
│                                     │
└─────────────────────────────────────┘
```

**States:**
| State | Render |
|---|---|
| Login mode | Username + Password fields, "Sign In" button |
| Register mode | Username + Email + Role (radio: Student/Teacher) + Password, "Create Account" button |
| Loading | Button shows "Processing..." |
| Toggle | Link text switches between "Don't have an account? Register" / "Already have an account? Sign In" |
| API Error | Toast error via sonner |

**Key elements:** Card component, Button, Input, form validation (no empty fields), role selector

---

### 2. Dashboard (`/dashboard`) — Classroom List

**Layout:** AppLayout (sidebar on left). Main content area with max-width container.

```
┌──────────┬────────────────────────────────────────┐
│ Sidebar  │  My Classrooms          [+ Create]    │
│          │                                        │
│ Main     │  ┌──────┐  ┌──────┐  ┌──────┐        │
│ ├─Dashbrd│  │Math  │  │Science│  │History│        │
│ ├─Learn  │  │101   │  │ 9th   │  │HL     │        │
│ │        │  │5 stds│  │12 stds│  │8 stds │        │
│ Classrms │  │ABC123│  │DEF456│  │GHI789│        │
│ ├─Room A │  └──────┘  └──────┘  └──────┘        │
│ ├─Room B │                                        │
│ └─Room C │  (Or empty state: "No classrooms       │
│          │   yet. Create your first classroom!")  │
│ [👤 User]│                                        │
└──────────┴────────────────────────────────────────┘
```

**States:**
| State | Render |
|---|---|
| Loading | Centered "Loading..." text |
| Empty (teacher) | "No classrooms created yet. Create your first classroom!" |
| Empty (student) | "No classrooms enrolled yet." |
| Has classrooms | Responsive grid (1/2/3 cols) of classroom cards |
| Create form open | Inline Card form with Name, Description, Create/Cancel buttons |

**Key elements:** Button, Card grid, Input, textarea, CreateClassroom form

---

### 3. Classroom Detail (`/classroom/:id`) — Multi-tab Management

**Layout:** AppLayout (sidebar). Full-width content with tab navigation.

```
┌──────────┬────────────────────────────────────────┐
│ Sidebar  │  Classroom Name              [Edit]   │
│          │  Description                          │
│ Main     │  Invite Code: ABC123 | Students: 15   │
│ ├─Dashbrd│                                        │
│ ├─Learn  │  ┌─────┬──────┬──────┬──────┬──────┐  │
│ │        │  │Overv│Annc  │Stdnts│Resrce│Quiz  │  │
│ Classrms │  │     │ments │      │s     │      │  │
│ ├─▶ RoomA│  └─────┴──────┴──────┴──────┴──────┘  │
│ │  Room B│                                        │
│ └─Room C │  [Tab Content Area]                   │
│          │  (varies by active tab)                │
│ [👤 User]│                                        │
└──────────┴────────────────────────────────────────┘
```

**Tabs:**

| Tab | Visible To | Content |
|---|---|---|
| **Overview** | Everyone | 3 stat cards showing Resources count, Quizzes count, Students count |
| **Announcements** | Everyone | Teacher: Post form (title input + content textarea + Post button). All: announcement list (title, teacher name, date, content). Teacher: delete button on each |
| **Students** | Teacher only | Invite email input + Send button. Invite code display. List of enrolled students (avatar initial, username, email) |
| **Resources** | Everyone | Teacher: Upload button (PDF via Supabase). Resource list (filename link, indexed/processing status, inline rename edit, delete). Student: read-only list |
| **Quizzes** | Everyone | Coming Soon placeholder (emoji + message) |
| **Flashcards** | Everyone | Teacher: Create Flashcard button. List of flashcards (front/back text) |

**Key elements:** ClassroomTabs (tab bar), Card (stat cards, resource items), Button, Input, textarea, file upload flow

---

### 4. Learn (`/learn`) — RAG Chat Interface

**Layout:** Full-screen standalone (no sidebar). Three-column structure.

```
┌──────────────────────────────────────────────────────────────┐
│  ← Dashboard  │  Classroom: [Math 101 ▼]            │
├─────────────────────────┬────────────────────────────────────┤
│  Conversations  [+ New] │                                    │
│  ┌───────────────────┐  │  💬 Ask a question about           │
│  │ 📘 Algebra Help   │  │     your resources                  │
│  │   15 messages     │  │                                    │
│  ├───────────────────┤  │  ┌─── You ────────────────────┐   │
│  │ 📘 Chapter 5      │  │  │  Can you explain...       │   │
│  │   8 messages      │  │  └────────────────────────────┘   │
│  ├───────────────────┤  │  ┌─── AI ─────────────────────┐   │
│  │ 📘 Homework Help  │  │  │  Sure! Here's the answer...│   │
│  │   3 messages      │  │  │  • Point 1                  │   │
│  └───────────────────┘  │  │  • Point 2                  │   │
│                         │  └────────────────────────────┘   │
│                         │                                    │
├─────────────────────────┴────────────────────────────────────┤
│  [Ask a question about your resources...]           [→] │
└──────────────────────────────────────────────────────────────┘
```

**States:**

| State | Left Panel | Right Panel |
|---|---|---|
| No classroom selected | "Select a classroom to view conversations" | Book emoji + "Select a classroom to start learning" |
| Classroom selected, no sessions | "No conversations yet. Start a new one!" | Speech bubble + "Select or create a conversation" + [+ New] button |
| Classroom selected, session selected | Session list with active highlight | Messages (user right-aligned white, AI left-aligned dark with markdown). If empty: "Ask a question about your resources" |
| Sending message | Message count updates | "Thinking..." indicator, new user + AI bubbles appear |
| Loading sessions | "Loading..." | — |
| Loading messages | — | "Loading messages..." |
| API error | — | Fallback "Sorry, I encountered an error" bubble + toast |

**Conversation management:**
- **[+ New]** creates a session → auto-selects it → focuses input
- **First question** generates an AI-powered title (3-6 word summary via gpt-4o-mini)
- **Messages persist** in DB via `ChatSession` + `ChatMessage` tables
- **Click session** loads full message history

**Key elements:** Button, select dropdown, chat bubbles, ReactMarkdown rendering, auto-scroll, send button

---

### 5. NotFound (`*`) — 404

**Layout:** Centered on dark background. No sidebar.

```
        404
  Page not found

  [Go to Dashboard]
```

**Key elements:** Button (navigates to `/dashboard`)

---

## AppSidebar — Navigation

```
┌─────────────────────┐
│  📐 Clarix          │  ← Header, click → /dashboard
│  Learning Platform  │
├─────────────────────┤
│  Main               │  ← Group label
│  📊 Dashboard       │  ← Active when on /dashboard
│  📖 Learn           │  ← Active when on /learn
├─────────────────────┤
│  ▼ Classrooms       │  ← Collapsible
│  📘 Math 101        │
│  📘 Science 9th     │  ← Active when on /classroom/:id
│  📘 History HL      │
├─────────────────────┤
│  👤 samiuddin       │  ← Footer
│  teacher            │
│  [Logout]           │  ← Dropdown menu
└─────────────────────┘
```

**Behavior:**
- Collapsible to icons (`collapsible="icon"`)
- Toggle via hamburger button or `Cmd+B`
- Responsive: sheet overlay on mobile
- Classroom list hidden when no classrooms
- SidebarRail for resize
- Active states highlight current route

---

## Layout Components

### AppLayout
```
<SidebarProvider>
  <AppSidebar collapsible="icon" />
  <SidebarInset>
    <main>children</main>
  </SidebarInset>
</SidebarProvider>
```

Used by: Dashboard, ClassroomDetail.

Learn page is rendered outside AppLayout (full-screen standalone).

---

## UI States Legend

Every page handles these states:

| State | How |
|---|---|
| **Loading** | Conditional render or inline text |
| **Empty** | Conditional message with emoji |
| **Error** | sonner toast with error message |
| **Edge case** | Graceful fallbacks (e.g., missing classroom → "Classroom not found") |

---

## Backend API Dependencies

| Endpoint | Used By |
|---|---|
| `POST /auth/login` | Index |
| `POST /auth/signup` | Index |
| `GET /auth/me` | Dashboard (user info), Sidebar, ClassroomDetail |
| `GET /classrooms/` | Dashboard (list), Sidebar (list), Learn (selector) |
| `POST /classrooms/` | Dashboard (create) |
| `GET /classrooms/{id}` | ClassroomDetail |
| `GET /classrooms/{id}/students` | ClassroomDetail |
| `POST /classrooms/{id}/invite` | ClassroomDetail |
| `GET /classrooms/{id}/resources` | ClassroomDetail |
| `POST /classrooms/{id}/resources/generate-upload-url` | ClassroomDetail |
| `POST /classrooms/{id}/resources` | ClassroomDetail |
| `DELETE /classrooms/{id}/resources/{rid}` | ClassroomDetail |
| `PUT /classrooms/{id}/resources/{rid}` | ClassroomDetail |
| `GET /classrooms/{id}/announcements` | ClassroomDetail |
| `POST /classrooms/{id}/announcements` | ClassroomDetail |
| `DELETE /classrooms/{id}/announcements/{aid}` | ClassroomDetail |
| `GET /classrooms/{id}/quizzes` | ClassroomDetail |
| `GET /classrooms/{id}/flashcards` | ClassroomDetail |
| `GET /classrooms/{id}/chat/sessions` | Learn |
| `POST /classrooms/{id}/chat/sessions` | Learn |
| `GET /classrooms/{id}/chat/sessions/{sid}` | Learn |
| `POST /classrooms/{id}/chat/sessions/{sid}/messages` | Learn |

---

## File Map

```
Frontend/src/
├── App.jsx                    # Routes, providers, auth guards
├── index.css                  # Tailwind import, theme CSS vars
├── main.jsx                   # Entry point
│
├── pages/
│   ├── Index.jsx              # Login/Register
│   ├── Dashboard.jsx          # Classroom list + create
│   ├── ClassroomDetail.jsx    # Multi-tab classroom
│   ├── Learn.jsx              # RAG chat interface
│   └── NotFound.jsx           # 404
│
├── layouts/
│   └── AppLayout.jsx          # Sidebar wrapper
│
├── components/
│   ├── AppSidebar.jsx         # Navigation sidebar
│   ├── classroom/
│   │   ├── index.js
│   │   ├── ClassroomNav.jsx
│   │   ├── ClassroomTabs.jsx
│   │   ├── OverviewTab.jsx
│   │   ├── StudentsTab.jsx
│   │   ├── ResourcesTab.jsx
│   │   └── ComingSoonTabs.jsx
│   └── chat/
│       └── ChatTab.jsx
│
├── components/ui/             # shadcn/ui primitives
│   ├── sidebar.jsx
│   ├── sheet.jsx
│   ├── dropdown-menu.jsx
│   ├── collapsible.jsx
│   ├── tooltip.jsx
│   ├── separator.jsx
│   ├── skeleton.jsx
│   ├── visually-hidden.jsx
│   ├── button.jsx
│   ├── card.jsx
│   ├── input.jsx
│   └── toaster.jsx
│
├── hooks/
│   ├── use-mobile.jsx
│   └── use-toast.jsx
│
└── lib/
    ├── api.js                 # Axios instance + JWT interceptors
    ├── supabase.js            # Supabase client
    └── utils.js               # cn() utility
```
