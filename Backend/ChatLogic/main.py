from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.templating import Jinja2Templates
from pathlib import Path

app = FastAPI()

# ✅ Fix template path (IMPORTANT)
BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


# ✅ Connection Manager with ROOM support
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
        print("STORE FUNCTION CALLED:", room, message)
        if room not in self.messages:
            self.messages[room] = []
        self.messages[room].append(message)
        print("UPDATED MESSAGES:", self.messages)
        
    def disconnect(self, websocket: WebSocket, room: str):
        if room in self.rooms:
            if websocket in self.rooms[room]:
                self.rooms[room].remove(websocket)
            if not self.rooms[room]:
                del self.rooms[room]

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str, room: str):
        for connection in list(self.rooms.get(room, [])):  # copy list
            try:
                await connection.send_text(message)
            except:
                self.rooms[room].remove(connection)  # remove dead connection

manager = ConnectionManager()


# ✅ Route to load chat page
@app.get("/chat")
async def chat(request: Request):
    return templates.TemplateResponse("Chat.html", {"request": request})
@app.get("/dash")
async def dash(request: Request):
    return templates.TemplateResponse("Dashboard.html", {"request": request})

@app.websocket("/ws/{room}/{username}")
async def websocket_endpoint(websocket: WebSocket, room: str, username: str):
    await manager.connect(websocket, room)

    # ✅ Send old messages FIRST
    if room in manager.messages:
        for msg in manager.messages[room]:
            await manager.send_personal_message(msg, websocket)

    try:
        # ✅ Then notify join
        await manager.broadcast(f"🔵 {username} joined the room", room)

        while True:
            data = await websocket.receive_text()

            # ✅ Store message
            manager.store_message(room, f"💬 {username}: {data}")

            # ✅ Broadcast message
            await manager.broadcast(f"💬 {username}: {data}", room)

    except WebSocketDisconnect:
        # ✅ Remove first
        manager.disconnect(websocket, room)

        # ✅ Then notify others
        await manager.broadcast(f"🔴 {username} left the room", room)