# Clarix Backend

FastAPI backend for the Clarix classroom management platform with RAG-powered resource Q&A.

## Folder Structure

```
Backend/
├── main.py                  # FastAPI app entrypoint. Sets up CORS middleware,
│                            # includes all routers, defines WebSocket room manager
│                            # for real-time chat, and creates DB tables on startup.
│
├── Database.py              # SQLAlchemy engine + session config. Uses SQLite
│                            # (todosapp.db) with `check_same_thread=False`.
│
├── models.py                # All SQLAlchemy ORM models:
│                            #   Users, Classroom, Enrollment, Resource, Quiz,
│                            #   QuizQuestion, QuizAttempt, Flashcard,
│                            #   Announcement, ChatSession, ChatMessage
│
├── auth.py                  # JWT auth with bcrypt password hashing.
│                            # Routes: POST /auth/signup, POST /auth/login,
│                            # GET /auth/me. Dependencies: get_current_user,
│                            # get_current_teacher, get_current_student.
│                            # Token stored in httpOnly cookie (clarix_token).
│
├── classroom.py             # Classroom CRUD + student management.
│                            # Routes (all under /classrooms):
│                            #   POST /          — teacher creates classroom
│                            #   GET /           — list user's classrooms
│                            #   GET /{id}       — classroom detail
│                            #   PUT /{id}       — update classroom
│                            #   DELETE /{id}    — delete classroom
│                            #   POST /{id}/invite — invite student by email
│                            #   GET /{id}/students — list enrolled students
│                            #   DELETE /{id}/students/{sid} — remove student
│
├── resources.py             # PDF resource upload & RAG chat.
│                            # Routes (under /classrooms/{id}):
│                            #   POST /resources/generate-upload-url — Supabase upload URL
│                            #   POST /resources — create resource (triggers indexing)
│                            #   GET /resources — list resources
│                            #   PUT /resources/{rid} — rename resource
│                            #   DELETE /resources/{rid} — delete resource + Supabase file
│                            #   POST /chat — ask questions about indexed PDFs
│                            #   GET /chat/history — chat history
│
├── quiz.py                  # Quiz creation + student attempts.
│                            # Routes (under /classrooms/{id}):
│                            #   POST /quizzes — create quiz with questions
│                            #   GET /quizzes — list quizzes
│                            #   GET /quizzes/{qid} — quiz detail (hides answers from students)
│                            #   POST /quizzes/{qid}/attempt — submit answers
│                            #   GET /quizzes/{qid}/attempts — teacher view of results
│
├── flashcard.py             # Flashcard CRUD for teachers.
│                            # Routes (under /classrooms/{id}):
│                            #   POST /flashcards — create
│                            #   GET /flashcards — list
│                            #   PUT /flashcards/{fid} — update
│                            #   DELETE /flashcards/{fid} — delete
│
├── announcements.py         # Classroom announcements.
│                            # Routes (under /classrooms/{id}):
│                            #   GET /announcements — list (teacher/student)
│                            #   POST /announcements — create (teacher only)
│                            #   DELETE /announcements/{aid} — delete (teacher only)
│
├── rag_service.py           # RAG integration layer. Orchestrates PDF download,
│                            # indexing via rag_pipeline, and query answering
│                            # using LangChain Chroma + GPT-4o-mini.
│                            # Functions: index_resource_from_url(),
│                            # query_resources(), generate_rag_response()
│
├── streamlit_app.py         # Standalone Streamlit UI for testing the RAG
│                            # pipeline independently (upload PDFs, chat).
│
├── requirements.txt         # Python dependencies (FastAPI, LangChain, Chroma,
│                            # PyMuPDF, Tesseract, sentence-transformers, etc.)
│
├── .env                     # Environment variables (SECRET_KEY, OPENAI_API_KEY,
│                            # SUPABASE_URL, SUPABASE_SERVICE_KEY, etc.)
│
├── .gitignore
│
├── rag_pipeline/            # LangGraph-based PDF indexing pipeline
│   ├── __init__.py
│   └── indexing/
│       ├── __init__.py
│       ├── pipeline.py      # Orchestrates the full pipeline: detect → extract
│       │                    # → chunk → index via LangGraph StateGraph
│       ├── graph.py         # LangGraph graph definition (4 nodes, sequential)
│       ├── state.py         # PipelineState TypedDict (pdf_path, is_handwritten,
│       │                    # pages, chunks, doc_ids, result, error)
│       ├── nodes.py         # LangGraph node functions: detect_document_type(),
│       │                    # extract_pages(), chunk_documents(),
│       │                    # index_to_vectorstore()
│       ├── detector.py      # Detects handwritten vs text PDFs using Tesseract
│       │                    # OCR confidence scoring. is_handwritten() with
│       │                    # configurable threshold (default 0.3)
│       ├── extractors.py    # Text extraction: PyMuPDF for text PDFs, Tesseract
│       │                    # OCR for handwritten PDFs
│       ├── chunker.py       # Text chunking with sentence-aware boundaries,
│       │                    # configurable chunk_size (500) and overlap (50).
│       │                    # Also creates LangChain Document objects
│       ├── chroma_client.py # ChromaDB cloud client with SentenceTransformer
│       │                    # embeddings (all-MiniLM-L6-v2)
│       └── embedder.py      # Standalone embedding function
│
├── templates/               # Legacy Jinja2 HTML templates (replaced by React
│   ├── Login.html           # frontend, kept for reference)
│   ├── Dashboard.html
│   └── Chat.html
│
├── uploads/resources/       # Local upload directory (currently unused —
│                            # uploads go to Supabase storage)
│
└── todosapp.db              # SQLite database file
```

## Tech Stack

- **FastAPI** — web framework
- **SQLAlchemy** + **SQLite** — ORM + database
- **JWT** (python-jose) + **bcrypt** — authentication
- **LangChain** + **LangGraph** — RAG pipeline orchestration
- **ChromaDB** (cloud) — vector store
- **Sentence-Transformers** (all-MiniLM-L6-v2) — embeddings
- **GPT-4o-mini** — LLM for answer generation
- **PyMuPDF** + **Tesseract OCR** — PDF text extraction (handwriting-aware)
- **Supabase Storage** — file hosting
- **Streamlit** — standalone RAG testing UI

## Running

```bash
cd Backend && uvicorn main:app --reload
```

The API runs at `http://localhost:8000`.

## API Prefixes

| Prefix | Module | Auth Required |
|--------|--------|--------------|
| `/auth` | auth.py | No (signup/login) |
| `/classrooms` | classroom.py | Yes |
| `/classrooms/{id}/resources` | resources.py | Yes |
| `/classrooms/{id}/quizzes` | quiz.py | Yes |
| `/classrooms/{id}/flashcards` | flashcard.py | Yes |
| `/classrooms/{id}/announcements` | announcements.py | Yes |
| `/ws/{room}/{username}` | main.py | No (WebSocket) |
