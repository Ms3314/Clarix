from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, status, Depends, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from Backend import models, auth
from Backend.Database import engine, SessionLocal
from typing import Annotated
from sqlalchemy.orm import Session
import os
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

app = FastAPI(title="Clarix API", version="1.0.0")

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include routers
from Backend.classroom import router as classroom_router
from Backend.resources import router as resources_router
from Backend.quiz import router as quiz_router
from Backend.flashcard import router as flashcard_router

app.include_router(auth.router)
app.include_router(classroom_router)
app.include_router(resources_router)
app.include_router(quiz_router)
app.include_router(flashcard_router)

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

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

db_dependency = Annotated[Session, Depends(get_db)]
