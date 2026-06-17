from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, status, Depends, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware
from pathlib import Path
from Backend import models, auth

from dotenv import load_dotenv
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)
from Backend.Database import engine, SessionLocal
from typing import Annotated
from sqlalchemy.orm import Session
from sqlalchemy import text
from Backend.models import Users, Resource, Classroom
from Backend.auth import get_current_teacher, get_current_user
from Backend.Database import get_db
import os
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

app = FastAPI(title="Clarix API", version="1.0.0")

class CORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin", "")
        if request.method == "OPTIONS":
            response = Response(status_code=200)
        else:
            response = await call_next(request)
        response.headers["Access-Control-Allow-Origin"] = origin or "*"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Cookie"
        return response

app.add_middleware(CORSMiddleware)

# Import and include routers
from Backend.classroom import router as classroom_router
from Backend.resources import router as resources_router
from Backend.quiz import router as quiz_router
from Backend.flashcard import router as flashcard_router
from Backend.announcements import router as announcements_router
from Backend.profile import router as profile_router

app.include_router(auth.router)
app.include_router(classroom_router)
app.include_router(resources_router)
app.include_router(quiz_router)
app.include_router(flashcard_router)
app.include_router(announcements_router)
app.include_router(profile_router)

# Connection Manager with ROOM support (kept for potential WebSocket features)
class ConnectionManager:
    def __init__(self):
        self.rooms: dict[str, list[WebSocket]] = {}
        self.messages: dict[str, list[str]] = {}

    async def connect(self, websocket: WebSocket, room: str):
        await websocket.accept()
        if room not in self.rooms:
            self.rooms[room] = []
        self.rooms[room].append(websocket)

    def store_message(self, room: str, message: str):
        if room not in self.messages:
            self.messages[room] = []
        self.messages[room].append(message)

    def disconnect(self, websocket: WebSocket, room: str):
        if room in self.rooms:
            if websocket in self.rooms[room]:
                self.rooms[room].remove(websocket)
            if not self.rooms[room]:
                del self.rooms[room]

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str, room: str):
        for connection in list(self.rooms.get(room, [])):
            try:
                await connection.send_text(message)
            except:
                self.rooms[room].remove(connection)

manager = ConnectionManager()

@app.get("/")
async def root():
    return {"message": "Clarix API is running", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/teacher/resources")
async def get_teacher_resources(
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    resources = db.query(Resource).join(Classroom, Resource.classroom_id == Classroom.id).filter(
        Classroom.teacher_id == teacher.id
    ).order_by(Resource.created_at.desc()).all()
    return {"resources": [
        {
            "id": r.id,
            "filename": r.filename,
            "file_size": r.file_size,
            "indexed": r.indexed,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "classroom_id": r.classroom_id,
            "classroom_name": r.classroom.name if r.classroom else None,
        }
        for r in resources
    ]}

# WebSocket endpoint (kept for future real-time features)
@app.websocket("/ws/{room}/{username}")
async def websocket_endpoint(websocket: WebSocket, room: str, username: str):
    await manager.connect(websocket, room)

    if room in manager.messages:
        for msg in manager.messages[room]:
            await manager.send_personal_message(msg, websocket)

    try:
        await manager.broadcast(f"🔵 {username} joined the room", room)

        while True:
            data = await websocket.receive_text()
            manager.store_message(room, f"💬 {username}: {data}")
            await manager.broadcast(f"💬 {username}: {data}", room)

    except WebSocketDisconnect:
        manager.disconnect(websocket, room)
        await manager.broadcast(f"🔴 {username} left the room", room)

# Create tables on startup
@app.on_event("startup")
async def startup_event():
    models.Base.metadata.create_all(bind=engine)

    # Add title column to chat_sessions if missing (idempotent migration)
    try:
        from sqlalchemy import inspect
        inspector = inspect(engine)
        columns = [c['name'] for c in inspector.get_columns('chat_sessions')]
        if 'title' not in columns:
            with engine.connect() as conn:
                conn.exec_driver_sql("ALTER TABLE chat_sessions ADD COLUMN title VARCHAR")
                conn.commit()
            print("[Startup] Added title column to chat_sessions")
    except Exception as e:
        print(f"[Startup] Migration note: {e}")

    # Add new columns to classrooms table if missing
    try:
        from sqlalchemy import inspect
        inspector = inspect(engine)
        cls_columns = [c['name'] for c in inspector.get_columns('classrooms')]
        with engine.connect() as conn:
            if 'subject' not in cls_columns:
                conn.exec_driver_sql("ALTER TABLE classrooms ADD COLUMN subject VARCHAR")
                print("[Startup] Added subject column to classrooms")
            if 'icon' not in cls_columns:
                conn.exec_driver_sql("ALTER TABLE classrooms ADD COLUMN icon VARCHAR DEFAULT 'sigma'")
                print("[Startup] Added icon column to classrooms")
            if 'is_public' not in cls_columns:
                conn.exec_driver_sql("ALTER TABLE classrooms ADD COLUMN is_public BOOLEAN DEFAULT FALSE")
                print("[Startup] Added is_public column to classrooms")
            if 'banner' not in cls_columns:
                conn.exec_driver_sql("ALTER TABLE classrooms ADD COLUMN banner VARCHAR")
                print("[Startup] Added banner column to classrooms")
            conn.commit()
    except Exception as e:
        print(f"[Startup] Classroom migration note: {e}")

    # Create folders table if missing
    try:
        with engine.connect() as conn:
            conn.exec_driver_sql("""
                CREATE TABLE IF NOT EXISTS folders (
                    id SERIAL PRIMARY KEY,
                    classroom_id INTEGER NOT NULL REFERENCES classrooms(id),
                    name VARCHAR NOT NULL,
                    parent_id INTEGER REFERENCES folders(id),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()
            print("[Startup] Ensured folders table exists")
    except Exception as e:
        print(f"[Startup] Folders table migration note: {e}")

    # Add folder_id to resources if missing
    try:
        from sqlalchemy import inspect
        inspector = inspect(engine)
        res_columns = [c['name'] for c in inspector.get_columns('resources')]
        if 'folder_id' not in res_columns:
            with engine.connect() as conn:
                conn.exec_driver_sql("ALTER TABLE resources ADD COLUMN folder_id INTEGER REFERENCES folders(id)")
                conn.commit()
                print("[Startup] Added folder_id column to resources")
    except Exception as e:
        print(f"[Startup] Resources folder_id migration note: {e}")

    # Add profile columns to users if missing
    try:
        from sqlalchemy import inspect
        inspector = inspect(engine)
        user_columns = [c['name'] for c in inspector.get_columns('users')]
        with engine.connect() as conn:
            if 'profile_picture_url' not in user_columns:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN profile_picture_url VARCHAR")
                conn.commit()
                print("[Startup] Added profile_picture_url column to users")
            if 'profile_picture_updated_at' not in user_columns:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN profile_picture_updated_at TIMESTAMP")
                conn.commit()
                print("[Startup] Added profile_picture_updated_at column to users")
    except Exception as e:
        print(f"[Startup] Users profile migration note: {e}")

    # Ensure Supabase storage buckets exist
    try:
        from supabase import create_client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
        if supabase_url and supabase_key and "your-project" not in supabase_url:
            supabase = create_client(supabase_url, supabase_key)
            for bucket_name in ("classroom-resources", "profile-pictures"):
                try:
                    supabase.storage.get_bucket(bucket_name)
                    print(f"[Startup] Found storage bucket: {bucket_name}")
                except Exception:
                    supabase.storage.create_bucket(bucket_name, options={"public": True})
                    print(f"[Startup] Created storage bucket: {bucket_name}")
    except Exception as e:
        print(f"[Startup] Bucket initialization note: {e}")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

db_dependency = Annotated[Session, Depends(get_db)]
