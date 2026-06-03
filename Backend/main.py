from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, status, Depends, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware
from pathlib import Path
from Backend import models, auth
from Backend.Database import engine, SessionLocal
from typing import Annotated
from sqlalchemy.orm import Session
from sqlalchemy import text
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

app.include_router(auth.router)
app.include_router(classroom_router)
app.include_router(resources_router)
app.include_router(quiz_router)
app.include_router(flashcard_router)
app.include_router(announcements_router)

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

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

db_dependency = Annotated[Session, Depends(get_db)]
