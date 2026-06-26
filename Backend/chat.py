from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import Annotated, Dict, List, Optional
from auth import get_current_user, get_current_teacher
from models import Users, Classroom, Enrollment, ClassroomTeacher, GroupChatMessage, PinnedGroupChatMessage
from Database import get_db
from datetime import datetime
import json
from urllib.parse import unquote

router = APIRouter(
    prefix="/chat",
    tags=["chat"]
)

# { classroom_id: [ (websocket, user_id, username, role) ] }
active_connections: Dict[int, List[tuple]] = {}
recent_client_messages: Dict[int, Dict[int, Dict[str, dict]]] = {}
MAX_RECENT_CLIENT_MESSAGES = 200


# ─── Helpers ──────────────────────────────────────────────────────────────────

def is_member(user: Users, classroom_id: int, db: Session) -> bool:
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        return False
    # Check if user is the main teacher
    if user.role == "teacher" and classroom.teacher_id == user.id:
        return True
    # Check if user is a co-teacher
    co_teacher = db.query(ClassroomTeacher).filter(
        ClassroomTeacher.classroom_id == classroom_id,
        ClassroomTeacher.teacher_id == user.id
    ).first()
    if co_teacher:
        return True
    # Check if user is an approved student
    enrollment = db.query(Enrollment).filter(
        Enrollment.user_id == user.id,
        Enrollment.classroom_id == classroom_id,
        Enrollment.status == "approved"
    ).first()
    return enrollment is not None


def is_admin(user: Users, classroom_id: int, db: Session) -> bool:
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        return False
    if classroom.teacher_id == user.id:
        return True
    co_teacher = db.query(ClassroomTeacher).filter(
        ClassroomTeacher.classroom_id == classroom_id,
        ClassroomTeacher.teacher_id == user.id
    ).first()
    return co_teacher is not None


def get_user_classroom_ids(user: Users, db: Session) -> List[int]:
    if user.role == "teacher":
        # Get classrooms where user is main teacher
        main_classrooms = db.query(Classroom).filter(Classroom.teacher_id == user.id).all()
        main_ids = [c.id for c in main_classrooms]
        # Get classrooms where user is co-teacher
        co_links = db.query(ClassroomTeacher).filter(ClassroomTeacher.teacher_id == user.id).all()
        co_ids = [link.classroom_id for link in co_links]
        return list(set(main_ids + co_ids))
    # For students
    enrollments = db.query(Enrollment).filter(
        Enrollment.user_id == user.id,
        Enrollment.status == "approved"
    ).all()
    return [e.classroom_id for e in enrollments]


async def broadcast(classroom_id: int, payload: dict):
    text = json.dumps(payload)
    dead = []
    for entry in active_connections.get(classroom_id, []):
        ws, *_ = entry
        try:
            await ws.send_text(text)
        except Exception as exc:
            print(f"[chat.broadcast] Failed to send payload to classroom {classroom_id}: {exc}")
            dead.append(entry)
    for entry in dead:
        remove_connection_entry(classroom_id, entry)


def remove_connection_entry(classroom_id: int, entry: tuple) -> bool:
    connections = active_connections.get(classroom_id)
    if not connections:
        return False

    if entry in connections:
        connections.remove(entry)

    if not connections:
        active_connections.pop(classroom_id, None)

    return True


def get_websocket_token(websocket: WebSocket, path_token: str) -> str:
    token = unquote(path_token or "").strip()
    if token:
        return token

    query_token = websocket.query_params.get("token", "").strip()
    if query_token:
        return query_token

    cookie_token = websocket.cookies.get("clarix_token", "").strip()
    if cookie_token:
        return cookie_token

    auth_header = websocket.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1].strip()

    return ""


def get_cached_client_message(classroom_id: int, user_id: int, client_message_id: Optional[str]) -> Optional[dict]:
    if not client_message_id:
        return None

    return recent_client_messages.get(classroom_id, {}).get(user_id, {}).get(client_message_id)


def remember_client_message(classroom_id: int, user_id: int, client_message_id: Optional[str], payload: dict):
    if not client_message_id:
        return

    classroom_cache = recent_client_messages.setdefault(classroom_id, {})
    user_cache = classroom_cache.setdefault(user_id, {})
    user_cache[client_message_id] = payload

    while len(user_cache) > MAX_RECENT_CLIENT_MESSAGES:
        oldest_key = next(iter(user_cache))
        user_cache.pop(oldest_key, None)


async def kick_user_from_chat(user_id: int, classroom_id: int, db: Session):
    """Kick a specific user from a classroom's chat WebSocket connections"""
    if classroom_id in active_connections:
        to_kick = []
        for entry in active_connections[classroom_id]:
            ws, uid, *_ = entry
            if uid == user_id:
                to_kick.append(entry)
                try:
                    await ws.close(code=1008)
                except Exception:
                    pass
        for entry in to_kick:
            remove_connection_entry(classroom_id, entry)
        # Update online count
        await broadcast(classroom_id, {
            "type": "online_count",
            "count": len(active_connections.get(classroom_id, []))
        })


# ─── REST ─────────────────────────────────────────────────────────────────────

@router.get("/rooms")
async def get_my_rooms(
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ids = get_user_classroom_ids(user, db)
    classrooms = db.query(Classroom).filter(Classroom.id.in_(ids)).all()
    rooms = []
    for c in classrooms:
        teacher = db.query(Users).filter(Users.id == c.teacher_id).first()
        # Get last message from database
        last_msg = db.query(GroupChatMessage).filter(
            GroupChatMessage.classroom_id == c.id,
            GroupChatMessage.is_deleted == False
        ).order_by(GroupChatMessage.timestamp.desc()).first()
        rooms.append({
            "classroom_id": c.id,
            "classroom_name": c.name,
            "teacher_name": teacher.username if teacher else "Unknown",
            "online_count": len(active_connections.get(c.id, [])),
            "last_message": {
                "type": "message",
                "sender_id": last_msg.sender_id,
                "sender": last_msg.sender.username,
                "role": last_msg.sender.role,
                "message": last_msg.message,
                "timestamp": last_msg.timestamp.isoformat()
            } if last_msg else None,
            "is_admin": is_admin(user, c.id, db)
        })
    return {"rooms": rooms}


@router.get("/rooms/{classroom_id}/history")
async def get_history(
    classroom_id: int,
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not is_member(user, classroom_id, db):
        raise HTTPException(status_code=403, detail="Not a member of this classroom")
    
    messages = db.query(GroupChatMessage).filter(
        GroupChatMessage.classroom_id == classroom_id,
        GroupChatMessage.is_deleted == False
    ).order_by(GroupChatMessage.timestamp).all()
    
    # Get pinned messages
    pinned = db.query(PinnedGroupChatMessage).filter(
        PinnedGroupChatMessage.classroom_id == classroom_id
    ).all()
    pinned_message_ids = [p.message_id for p in pinned]
    
    formatted_messages = []
    for msg in messages:
        formatted_msg = {
            "type": "message",
            "id": msg.id,
            "sender_id": msg.sender_id,
            "sender": msg.sender.username,
            "role": msg.sender.role,
            "message": msg.message,
            "timestamp": msg.timestamp.isoformat(),
            "is_pinned": msg.id in pinned_message_ids
        }
        formatted_messages.append(formatted_msg)
    
    return {"messages": formatted_messages, "pinned_message_ids": pinned_message_ids}


@router.delete("/rooms/{classroom_id}/history")
async def clear_history(
    classroom_id: int,
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not is_admin(user, classroom_id, db):
        raise HTTPException(status_code=403, detail="Not an admin of this classroom")
    
    # Soft delete all messages
    db.query(GroupChatMessage).filter(
        GroupChatMessage.classroom_id == classroom_id
    ).update({
        "is_deleted": True,
        "deleted_by": user.id,
        "deleted_at": datetime.utcnow()
    })
    db.commit()
    
    await broadcast(classroom_id, {
        "type": "system",
        "message": "Chat history cleared by instructor",
        "timestamp": datetime.utcnow().isoformat()
    })
    
    return {"message": "Chat history cleared"}


@router.delete("/rooms/{classroom_id}/messages/{message_id}")
async def delete_message(
    classroom_id: int,
    message_id: int,
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not is_member(user, classroom_id, db):
        raise HTTPException(status_code=403, detail="Not a member of this classroom")
    
    msg = db.query(GroupChatMessage).filter(
        GroupChatMessage.id == message_id,
        GroupChatMessage.classroom_id == classroom_id
    ).first()
    
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Only admin or message sender can delete
    if not is_admin(user, classroom_id, db) and msg.sender_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed to delete this message")
    
    # Soft delete
    msg.is_deleted = True
    msg.deleted_by = user.id
    msg.deleted_at = datetime.utcnow()
    db.commit()
    
    await broadcast(classroom_id, {
        "type": "message_deleted",
        "message_id": message_id,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    return {"message": "Message deleted"}


@router.post("/rooms/{classroom_id}/messages/{message_id}/pin")
async def pin_message(
    classroom_id: int,
    message_id: int,
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not is_admin(user, classroom_id, db):
        raise HTTPException(status_code=403, detail="Not an admin of this classroom")
    
    msg = db.query(GroupChatMessage).filter(
        GroupChatMessage.id == message_id,
        GroupChatMessage.classroom_id == classroom_id,
        GroupChatMessage.is_deleted == False
    ).first()
    
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Check if already pinned
    existing = db.query(PinnedGroupChatMessage).filter(
        PinnedGroupChatMessage.classroom_id == classroom_id,
        PinnedGroupChatMessage.message_id == message_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Message already pinned")
    
    pinned = PinnedGroupChatMessage(
        classroom_id=classroom_id,
        message_id=message_id,
        pinned_by=user.id
    )
    db.add(pinned)
    db.commit()
    
    await broadcast(classroom_id, {
        "type": "message_pinned",
        "message_id": message_id,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    return {"message": "Message pinned"}


@router.delete("/rooms/{classroom_id}/messages/{message_id}/pin")
async def unpin_message(
    classroom_id: int,
    message_id: int,
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not is_admin(user, classroom_id, db):
        raise HTTPException(status_code=403, detail="Not an admin of this classroom")
    
    pinned = db.query(PinnedGroupChatMessage).filter(
        PinnedGroupChatMessage.classroom_id == classroom_id,
        PinnedGroupChatMessage.message_id == message_id
    ).first()
    
    if not pinned:
        raise HTTPException(status_code=404, detail="Pinned message not found")
    
    db.delete(pinned)
    db.commit()
    
    await broadcast(classroom_id, {
        "type": "message_unpinned",
        "message_id": message_id,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    return {"message": "Message unpinned"}


@router.post("/rooms/{classroom_id}/members")
async def add_member(
    classroom_id: int,
    user_id: int,
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not is_admin(user, classroom_id, db):
        raise HTTPException(status_code=403, detail="Not an admin of this classroom")
    
    # Check if user exists
    target_user = db.query(Users).filter(Users.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if target_user.role == "teacher":
        # Add as co-teacher
        existing = db.query(ClassroomTeacher).filter(
            ClassroomTeacher.classroom_id == classroom_id,
            ClassroomTeacher.teacher_id == user_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="User is already a co-teacher")
        co_teacher = ClassroomTeacher(classroom_id=classroom_id, teacher_id=user_id)
        db.add(co_teacher)
    else:
        # Add as student
        existing = db.query(Enrollment).filter(
            Enrollment.classroom_id == classroom_id,
            Enrollment.user_id == user_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="User is already enrolled")
        enrollment = Enrollment(classroom_id=classroom_id, user_id=user_id, status="approved")
        db.add(enrollment)
    
    db.commit()
    
    return {"message": "Member added"}


@router.delete("/rooms/{classroom_id}/members/{user_id}")
async def remove_member(
    classroom_id: int,
    user_id: int,
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not is_admin(user, classroom_id, db):
        raise HTTPException(status_code=403, detail="Not an admin of this classroom")
    
    # Check if it's the main teacher
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if classroom and classroom.teacher_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot remove the main teacher")
    
    if user.role == "teacher":
        # Remove co-teacher
        co_teacher = db.query(ClassroomTeacher).filter(
            ClassroomTeacher.classroom_id == classroom_id,
            ClassroomTeacher.teacher_id == user_id
        ).first()
        if co_teacher:
            db.delete(co_teacher)
    else:
        # Remove student
        enrollment = db.query(Enrollment).filter(
            Enrollment.classroom_id == classroom_id,
            Enrollment.user_id == user_id
        ).first()
        if enrollment:
            db.delete(enrollment)
    
    db.commit()
    
    # Kick user from chat immediately
    await kick_user_from_chat(user_id, classroom_id, db)
    
    return {"message": "Member removed"}


@router.get("/verify")
async def verify_chat_membership(
    user: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    """Verify that all active class members have proper chat access"""
    # Get all classrooms
    classrooms = db.query(Classroom).all()
    issues = []
    
    for c in classrooms:
        # Check main teacher
        teacher = db.query(Users).filter(Users.id == c.teacher_id).first()
        if not teacher:
            issues.append({"classroom_id": c.id, "issue": "Main teacher not found"})
        
        # Check co-teachers
        co_teachers = db.query(ClassroomTeacher).filter(
            ClassroomTeacher.classroom_id == c.id
        ).all()
        for co in co_teachers:
            co_user = db.query(Users).filter(Users.id == co.teacher_id).first()
            if not co_user:
                issues.append({"classroom_id": c.id, "issue": f"Co-teacher {co.teacher_id} not found"})
        
        # Check students
        enrollments = db.query(Enrollment).filter(
            Enrollment.classroom_id == c.id,
            Enrollment.status == "approved"
        ).all()
        for e in enrollments:
            student = db.query(Users).filter(Users.id == e.user_id).first()
            if not student:
                issues.append({"classroom_id": c.id, "issue": f"Student {e.user_id} not found"})
    
    return {"status": "verified", "issues": issues}


@router.post("/sync")
async def sync_chat_membership(
    user: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    """Manual sync: kick any connected users who are no longer members"""
    kicked_count = 0
    for classroom_id in list(active_connections.keys()):
        # Check each connection
        to_kick = []
        for entry in active_connections[classroom_id]:
            ws, uid, uname, role = entry
            user_obj = db.query(Users).filter(Users.id == uid).first()
            if not user_obj or not is_member(user_obj, classroom_id, db):
                to_kick.append(entry)
                try:
                    await ws.close(code=1008)
                except Exception:
                    pass
                kicked_count += 1
        # Remove from active connections
        for entry in to_kick:
            remove_connection_entry(classroom_id, entry)
        
        # Update online count
        await broadcast(classroom_id, {
            "type": "online_count",
            "count": len(active_connections.get(classroom_id, []))
        })
    
    return {"message": "Sync complete", "kicked_count": kicked_count}


# ─── WebSocket ────────────────────────────────────────────────────────────────

@router.websocket("/ws/{classroom_id}/{token}")
async def chat_ws(
    websocket: WebSocket,
    classroom_id: int,
    token: str,
    db: Session = Depends(get_db)
):
    """
    Connect: ws://<host>/chat/ws/{classroom_id}/{jwt_token}

    Incoming:  { "message": "text" }
    Outgoing:
      { "type": "history",      "messages": [...] }
      { "type": "message",      "id", "sender_id", "sender", "role", "message", "timestamp", "is_pinned" }
      { "type": "join"|"leave", "sender_id", "sender", "role", "timestamp" }
      { "type": "system",       "message", "timestamp" }
      { "type": "online_count", "count" }
      { "type": "message_deleted", "message_id", "timestamp" }
      { "type": "message_pinned"|"message_unpinned", "message_id", "timestamp" }
    """
    from auth import SECRET_KEY, ALGORITHM
    from jose import JWTError, jwt as jose_jwt

    entry = None
    token = get_websocket_token(websocket, token)

    if not token:
        print(f"[chat_ws] Missing token for classroom {classroom_id}")
        await websocket.close(code=1008, reason="Missing chat token")
        return

    try:
        payload = jose_jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        user_id: Optional[int] = payload.get("id")
        if not username or user_id is None:
            print(f"[chat_ws] Invalid token payload for classroom {classroom_id}")
            await websocket.close(code=1008, reason="Invalid chat token")
            return
    except JWTError:
        print(f"[chat_ws] Token decode failed for classroom {classroom_id}")
        await websocket.close(code=1008, reason="Invalid or expired chat token")
        return

    user = db.query(Users).filter(Users.id == user_id).first()
    if not user or not is_member(user, classroom_id, db):
        print(f"[chat_ws] Membership check failed for user {username} in classroom {classroom_id}")
        await websocket.close(code=1008, reason="Not allowed in this classroom")
        return

    await websocket.accept()

    if classroom_id not in active_connections:
        active_connections[classroom_id] = []
    entry = (websocket, user.id, user.username, user.role)
    active_connections[classroom_id].append(entry)

    # Get history from database
    messages = db.query(GroupChatMessage).filter(
        GroupChatMessage.classroom_id == classroom_id,
        GroupChatMessage.is_deleted == False
    ).order_by(GroupChatMessage.timestamp).all()
    
    # Get pinned messages
    pinned = db.query(PinnedGroupChatMessage).filter(
        PinnedGroupChatMessage.classroom_id == classroom_id
    ).all()
    pinned_message_ids = [p.message_id for p in pinned]
    
    formatted_messages = []
    for msg in messages:
        formatted_msg = {
            "type": "message",
            "id": msg.id,
            "sender_id": msg.sender_id,
            "sender": msg.sender.username,
            "role": msg.sender.role,
            "message": msg.message,
            "timestamp": msg.timestamp.isoformat(),
            "is_pinned": msg.id in pinned_message_ids
        }
        formatted_messages.append(formatted_msg)

    await websocket.send_text(json.dumps({
        "type": "history",
        "messages": formatted_messages,
        "pinned_message_ids": pinned_message_ids
    }))

    await broadcast(classroom_id, {
        "type": "join",
        "sender_id": user.id,
        "sender": user.username,
        "role": user.role,
        "timestamp": datetime.utcnow().isoformat()
    })
    await broadcast(classroom_id, {
        "type": "online_count",
        "count": len(active_connections[classroom_id])
    })

    try:
        while True:
            raw = await websocket.receive_text()
            client_message_id = None
            try:
                data = json.loads(raw)
                if isinstance(data, dict):
                    text = str(data.get("message", "")).strip()
                    client_message_id = str(data.get("client_message_id", "")).strip() or None
                else:
                    text = str(data).strip()
            except json.JSONDecodeError:
                text = raw.strip()

            if not text:
                continue

            cached_message = get_cached_client_message(classroom_id, user.id, client_message_id)
            if cached_message:
                await websocket.send_text(json.dumps(cached_message))
                continue

            # Save message to database
            db_msg = GroupChatMessage(
                classroom_id=classroom_id,
                sender_id=user.id,
                message=text
            )
            db.add(db_msg)
            db.commit()
            db.refresh(db_msg)

            msg = {
                "type": "message",
                "id": db_msg.id,
                "sender_id": user.id,
                "sender": user.username,
                "role": user.role,
                "message": text,
                "timestamp": db_msg.timestamp.isoformat(),
                "is_pinned": False,
                "client_message_id": client_message_id
            }

            remember_client_message(classroom_id, user.id, client_message_id, msg)
            await broadcast(classroom_id, msg)

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        print(f"[chat_ws] Unexpected error in classroom {classroom_id} for user {user.username}: {exc}")
        try:
            await websocket.close(code=1011, reason="Chat server error")
        except Exception:
            pass
    finally:
        removed = entry and remove_connection_entry(classroom_id, entry)
        if removed:
            await broadcast(classroom_id, {
                "type": "leave",
                "sender_id": user.id,
                "sender": user.username,
                "role": user.role,
                "timestamp": datetime.utcnow().isoformat()
            })
            await broadcast(classroom_id, {
                "type": "online_count",
                "count": len(active_connections.get(classroom_id, []))
            })
