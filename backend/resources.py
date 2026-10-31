from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Annotated, Optional
from pydantic import BaseModel
from backend.auth import get_current_teacher, get_current_user
from backend.models import Users, Classroom, Resource, Folder, ChatSession, ChatMessage
from backend.Database import get_db
from backend.rag_service import index_resource, generate_rag_response, generate_conversation_title, delete_resource_from_vectorstore
import os
import tempfile
import time
from datetime import datetime

router = APIRouter(
    prefix="/classrooms",
    tags=["resources"]
)

BUCKET_NAME = "classroom-resources"

_supabase_client = None


def get_supabase_client():
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    from supabase import create_client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")

    if not url or not key or "your-project" in url:
        return None

    _supabase_client = create_client(url, key)
    return _supabase_client


def _upload_to_supabase(file_bytes: bytes, file_path: str, content_type: str) -> str:
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    supabase.storage.from_(BUCKET_NAME).upload(
        file_path, file_bytes,
        {"content-type": content_type, "upsert": "true"}
    )
    supabase_url = os.getenv("SUPABASE_URL")
    return f"{supabase_url}/storage/v1/object/public/{BUCKET_NAME}/{file_path}"


class ChatRequest(BaseModel):
    query: str


class CreateSessionRequest(BaseModel):
    title: str | None = None


class SendMessageRequest(BaseModel):
    query: str


class UpdateResourceRequest(BaseModel):
    filename: str


class CreateFolderRequest(BaseModel):
    name: str
    parent_id: int | None = None


class RenameFolderRequest(BaseModel):
    name: str


class MoveResourceRequest(BaseModel):
    folder_id: int | None = None


class BatchMoveItem(BaseModel):
    resource_id: int
    folder_id: int | None = None


def get_resource_response(resource: Resource):
    return {
        "id": resource.id,
        "filename": resource.filename,
        "file_size": resource.file_size,
        "resource_type": resource.resource_type,
        "indexed": resource.indexed,
        "created_at": resource.created_at,
        "classroom_id": resource.classroom_id,
        "folder_id": resource.folder_id,
        "file_url": resource.file_path,
    }


def _check_teacher_access(classroom_id: int, teacher_id: int, db: Session):
    from backend.models import ClassroomTeacher
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    if classroom.teacher_id == teacher_id:
        return classroom
    ct = db.query(ClassroomTeacher).filter(
        ClassroomTeacher.classroom_id == classroom_id,
        ClassroomTeacher.teacher_id == teacher_id
    ).first()
    if ct:
        return classroom
    raise HTTPException(status_code=403, detail="Access denied")


# ── Folder endpoints ──

@router.get("/{classroom_id}/folders")
async def list_folders(
    classroom_id: int,
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    if user.role == "teacher" and classroom.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    elif user.role == "student":
        from backend.models import Enrollment
        enrollment = db.query(Enrollment).filter(
            Enrollment.user_id == user.id,
            Enrollment.classroom_id == classroom_id,
            Enrollment.status == "approved"
        ).first()
        if not enrollment:
            raise HTTPException(status_code=403, detail="Access denied")

    folders = db.query(Folder).filter(Folder.classroom_id == classroom_id).all()
    return {"folders": [{"id": f.id, "name": f.name, "parent_id": f.parent_id, "created_at": f.created_at} for f in folders]}


@router.post("/{classroom_id}/folders", status_code=201)
async def create_folder(
    classroom_id: int,
    request: CreateFolderRequest,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    _check_teacher_access(classroom_id, teacher.id, db)
    folder = Folder(classroom_id=classroom_id, name=request.name, parent_id=request.parent_id)
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return {"id": folder.id, "name": folder.name, "parent_id": folder.parent_id}


@router.put("/{classroom_id}/folders/{folder_id}")
async def rename_folder(
    classroom_id: int,
    folder_id: int,
    request: RenameFolderRequest,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    _check_teacher_access(classroom_id, teacher.id, db)
    folder = db.query(Folder).filter(Folder.id == folder_id, Folder.classroom_id == classroom_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    folder.name = request.name
    db.commit()
    return {"message": "Folder renamed"}


@router.delete("/{classroom_id}/folders/{folder_id}")
async def delete_folder(
    classroom_id: int,
    folder_id: int,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    _check_teacher_access(classroom_id, teacher.id, db)
    folder = db.query(Folder).filter(Folder.id == folder_id, Folder.classroom_id == classroom_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    # Move all resources and sub-folders to parent (or root)
    db.query(Resource).filter(Resource.folder_id == folder_id).update({"folder_id": folder.parent_id})
    db.query(Folder).filter(Folder.parent_id == folder_id).update({"parent_id": folder.parent_id})
    db.delete(folder)
    db.commit()
    return {"message": "Folder deleted"}


# ── Resource move endpoints ──

@router.put("/{classroom_id}/resources/{resource_id}/move")
async def move_resource(
    classroom_id: int,
    resource_id: int,
    request: MoveResourceRequest,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    _check_teacher_access(classroom_id, teacher.id, db)
    resource = db.query(Resource).filter(Resource.id == resource_id, Resource.classroom_id == classroom_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    resource.folder_id = request.folder_id
    db.commit()
    return {"message": "Resource moved"}


@router.put("/{classroom_id}/resources/move-batch")
async def move_resources_batch(
    classroom_id: int,
    request: list[BatchMoveItem],
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    _check_teacher_access(classroom_id, teacher.id, db)
    for item in request:
        resource = db.query(Resource).filter(Resource.id == item.resource_id, Resource.classroom_id == classroom_id).first()
        if resource:
            resource.folder_id = item.folder_id
    db.commit()
    return {"message": "Resources moved"}


@router.get("/{classroom_id}/resources/{resource_id}/annotations")
async def get_annotations(
    classroom_id: int,
    resource_id: int,
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resource = db.query(Resource).filter(Resource.id == resource_id, Resource.classroom_id == classroom_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    if not resource.annotations_data:
        return {"annotations": None}
    import json
    return {"annotations": json.loads(resource.annotations_data)}


class SaveAnnotationsRequest(BaseModel):
    annotations: list


@router.put("/{classroom_id}/resources/{resource_id}/annotations")
async def save_annotations(
    classroom_id: int,
    resource_id: int,
    request: SaveAnnotationsRequest,
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resource = db.query(Resource).filter(Resource.id == resource_id, Resource.classroom_id == classroom_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    import json
    resource.annotations_data = json.dumps(request.annotations)
    db.commit()
    return {"message": "Annotations saved"}


@router.post("/{classroom_id}/resources/upload", status_code=status.HTTP_201_CREATED)
async def upload_resource(
    classroom_id: int,
    file: UploadFile = File(...),
    folder_id: Optional[int] = Form(None),
    resource_type: str = Form('notes'),
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == teacher.id
    ).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    if folder_id:
        folder = db.query(Folder).filter(Folder.id == folder_id, Folder.classroom_id == classroom_id).first()
        if not folder:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files are allowed")

    file_bytes = await file.read()
    file_size = len(file_bytes)
    timestamp = int(time.time() * 1000)
    file_path = f"public/{timestamp}-{file.filename}"

    full_url = _upload_to_supabase(file_bytes, file_path, "application/pdf")

    resource = Resource(
        classroom_id=classroom_id,
        folder_id=folder_id,
        filename=file.filename,
        file_path=full_url,
        file_size=file_size,
        resource_type=resource_type,
        indexed=False
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)

    # Index the resource (PYQs use QP chunker, notes/other use regular chunker)
    indexed = False
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        indexed = index_resource(tmp_path, classroom_id, resource.id, resource_type)
        os.remove(tmp_path)
    except Exception as e:
        print(f"[Resources] Error indexing resource: {e}")
        import traceback
        traceback.print_exc()

    resource.indexed = indexed
    resource.indexed_at = datetime.utcnow() if indexed else None
    db.commit()

    return {
        "message": "Resource uploaded successfully",
        "resource": get_resource_response(resource)
    }


@router.get("/{classroom_id}/resources")
async def list_resources(
    classroom_id: int,
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    if user.role == "teacher" and classroom.teacher_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    elif user.role == "student":
        from backend.models import Enrollment
        enrollment = db.query(Enrollment).filter(
            Enrollment.user_id == user.id,
            Enrollment.classroom_id == classroom_id,
            Enrollment.status == "approved"
        ).first()
        if not enrollment:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    resources = db.query(Resource).filter(Resource.classroom_id == classroom_id).all()
    return {"resources": [get_resource_response(r) for r in resources]}


@router.get("/{classroom_id}/chat/sessions")
async def list_sessions(
    classroom_id: int,
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    if user.role == "teacher" and classroom.teacher_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    elif user.role == "student":
        from backend.models import Enrollment
        enrollment = db.query(Enrollment).filter(
            Enrollment.user_id == user.id,
            Enrollment.classroom_id == classroom_id,
            Enrollment.status == "approved"
        ).first()
        if not enrollment:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    sessions = db.query(ChatSession).filter(
        ChatSession.classroom_id == classroom_id,
        ChatSession.user_id == user.id
    ).order_by(ChatSession.created_at.desc()).all()

    result = []
    for s in sessions:
        message_count = db.query(ChatMessage).filter(ChatMessage.session_id == s.id).count()
        last_message = db.query(ChatMessage).filter(ChatMessage.session_id == s.id).order_by(ChatMessage.created_at.desc()).first()
        result.append({
            "id": s.id,
            "title": s.title or "New Conversation",
            "message_count": message_count,
            "last_message_preview": last_message.content[:80] + "..." if last_message and len(last_message.content) > 80 else (last_message.content if last_message else None),
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })

    return {"sessions": result}


@router.post("/{classroom_id}/chat/sessions")
async def create_session(
    classroom_id: int,
    request: CreateSessionRequest,
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    if user.role == "teacher" and classroom.teacher_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    elif user.role == "student":
        from backend.models import Enrollment
        enrollment = db.query(Enrollment).filter(
            Enrollment.user_id == user.id,
            Enrollment.classroom_id == classroom_id,
            Enrollment.status == "approved"
        ).first()
        if not enrollment:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    session = ChatSession(
        classroom_id=classroom_id,
        user_id=user.id,
        title=request.title
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "session": {
            "id": session.id,
            "title": session.title or "New Conversation",
            "message_count": 0,
            "created_at": session.created_at.isoformat() if session.created_at else None,
        }
    }


@router.get("/{classroom_id}/chat/sessions/{session_id}")
async def get_session(
    classroom_id: int,
    session_id: int,
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    if user.role == "teacher" and classroom.teacher_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    elif user.role == "student":
        from backend.models import Enrollment
        enrollment = db.query(Enrollment).filter(
            Enrollment.user_id == user.id,
            Enrollment.classroom_id == classroom_id,
            Enrollment.status == "approved"
        ).first()
        if not enrollment:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.classroom_id == classroom_id,
        ChatSession.user_id == user.id
    ).first()

    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.created_at.asc()).all()

    return {
        "session": {
            "id": session.id,
            "title": session.title or "New Conversation",
            "created_at": session.created_at.isoformat() if session.created_at else None,
        },
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ]
    }


@router.post("/{classroom_id}/chat/sessions/{session_id}/messages")
async def send_message(
    classroom_id: int,
    session_id: int,
    request: SendMessageRequest,
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    if user.role == "teacher" and classroom.teacher_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    elif user.role == "student":
        from backend.models import Enrollment
        enrollment = db.query(Enrollment).filter(
            Enrollment.user_id == user.id,
            Enrollment.classroom_id == classroom_id,
            Enrollment.status == "approved"
        ).first()
        if not enrollment:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.classroom_id == classroom_id,
        ChatSession.user_id == user.id
    ).first()

    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # Save user message
    user_msg = ChatMessage(session_id=session_id, role="user", content=request.query)
    db.add(user_msg)

    # Auto-title: if first message and no title, generate with AI
    message_count = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).count()
    if message_count <= 1 and not session.title:
        session.title = generate_conversation_title(request.query)

    # Get past messages for context (excluding current user message which is already saved)
    past_messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.created_at.asc()).all()

    conversation_history = [
        {"role": m.role, "content": m.content}
        for m in past_messages[:-1]  # exclude the user message we just added
    ]

    # Call RAG with conversation context
    response = generate_rag_response(request.query, classroom_id, conversation_history)

    # Save assistant response
    assistant_msg = ChatMessage(session_id=session_id, role="assistant", content=response)
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    db.refresh(session)

    return {
        "response": response,
        "message": {
            "id": assistant_msg.id,
            "role": "assistant",
            "content": response,
            "created_at": assistant_msg.created_at.isoformat() if assistant_msg.created_at else None,
        },
        "session": {
            "id": session.id,
            "title": session.title or "New Conversation",
        }
    }


@router.get("/{classroom_id}/chat/history")
async def get_chat_history(
    classroom_id: int,
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    if user.role == "teacher" and classroom.teacher_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    elif user.role == "student":
        from backend.models import Enrollment
        enrollment = db.query(Enrollment).filter(
            Enrollment.user_id == user.id,
            Enrollment.classroom_id == classroom_id,
            Enrollment.status == "approved"
        ).first()
        if not enrollment:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return {"messages": []}


@router.post("/{classroom_id}/chat")
async def chat_with_resources(
    classroom_id: int,
    request: ChatRequest,
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    if user.role == "teacher" and classroom.teacher_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    elif user.role == "student":
        from backend.models import Enrollment
        enrollment = db.query(Enrollment).filter(
            Enrollment.user_id == user.id,
            Enrollment.classroom_id == classroom_id,
            Enrollment.status == "approved"
        ).first()
        if not enrollment:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    response = generate_rag_response(request.query, classroom_id)
    return {"response": response}


@router.delete("/{classroom_id}/resources/{resource_id}")
async def delete_resource(
    classroom_id: int,
    resource_id: int,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == teacher.id
    ).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    resource = db.query(Resource).filter(
        Resource.id == resource_id,
        Resource.classroom_id == classroom_id
    ).first()
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

    try:
        supabase = get_supabase_client()
        if supabase and resource.file_path:
            marker = f"/object/public/{BUCKET_NAME}/"
            if marker in resource.file_path:
                storage_path = resource.file_path.split(marker)[-1]
                supabase.storage.from_(BUCKET_NAME).remove([storage_path])
    except Exception as e:
        print(f"[Resources] Failed to delete from Supabase: {e}")

    # Remove from ChromaDB vectorstore
    delete_resource_from_vectorstore(resource.classroom_id, resource.id)

    db.delete(resource)
    db.commit()
    return {"message": "Resource deleted successfully"}


@router.put("/{classroom_id}/resources/{resource_id}")
async def update_resource(
    classroom_id: int,
    resource_id: int,
    request: UpdateResourceRequest,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == teacher.id
    ).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    resource = db.query(Resource).filter(
        Resource.id == resource_id,
        Resource.classroom_id == classroom_id
    ).first()
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

    resource.filename = request.filename
    db.commit()
    db.refresh(resource)

    return {
        "message": "Resource updated successfully",
        "resource": get_resource_response(resource)
    }
