from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Annotated
from pydantic import BaseModel
from Backend.auth import get_current_teacher, get_current_user
from Backend.models import Users, Classroom, Resource
from Backend.Database import get_db
from Backend.rag_service import index_resource_from_url, generate_rag_response
import os
from datetime import datetime

router = APIRouter(
    prefix="/classrooms",
    tags=["resources"]
)

BUCKET_NAME = "resources"

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


class UploadUrlRequest(BaseModel):
    filename: str
    file_size: int


class CreateResourceRequest(BaseModel):
    filename: str
    file_size: int
    file_path: str


class ChatRequest(BaseModel):
    query: str


class UpdateResourceRequest(BaseModel):
    filename: str


def get_resource_response(resource: Resource):
    return {
        "id": resource.id,
        "filename": resource.filename,
        "file_size": resource.file_size,
        "indexed": resource.indexed,
        "created_at": resource.created_at,
        "classroom_id": resource.classroom_id,
        "file_url": resource.file_path,
    }


@router.post("/{classroom_id}/resources/generate-upload-url")
async def generate_upload_url(
    classroom_id: int,
    request: UploadUrlRequest,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == teacher.id
    ).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    if not request.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files are allowed")

    supabase_url = os.getenv("SUPABASE_URL")
    if not supabase_url or "your-project" in supabase_url:
        raise HTTPException(
            status_code=503,
            detail="Supabase storage not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env"
        )

    import time
    timestamp = int(time.time() * 1000)
    file_path = f"public/{timestamp}-{request.filename}"
    upload_url = f"{supabase_url}/storage/v1/object/{BUCKET_NAME}/{file_path}"

    return {"upload_url": upload_url, "file_path": file_path}


@router.post("/{classroom_id}/resources")
async def create_resource(
    classroom_id: int,
    request: CreateResourceRequest,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == teacher.id
    ).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    if not request.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files are allowed")

    supabase_url = os.getenv("SUPABASE_URL")
    full_url = f"{supabase_url}/storage/v1/object/public/{BUCKET_NAME}/{request.file_path}"

    resource = Resource(
        classroom_id=classroom_id,
        filename=request.filename,
        file_path=full_url,
        file_size=request.file_size,
        indexed=False
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)

    # Download from Supabase → detect handwriting → OCR or text extract → index in Chroma
    indexed = index_resource_from_url(full_url, classroom_id, resource.id)
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
        from Backend.models import Enrollment
        enrollment = db.query(Enrollment).filter(
            Enrollment.user_id == user.id,
            Enrollment.classroom_id == classroom_id
        ).first()
        if not enrollment:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    resources = db.query(Resource).filter(Resource.classroom_id == classroom_id).all()
    return {"resources": [get_resource_response(r) for r in resources]}


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
        from Backend.models import Enrollment
        enrollment = db.query(Enrollment).filter(
            Enrollment.user_id == user.id,
            Enrollment.classroom_id == classroom_id
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
        from Backend.models import Enrollment
        enrollment = db.query(Enrollment).filter(
            Enrollment.user_id == user.id,
            Enrollment.classroom_id == classroom_id
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
            # Extract the storage path from the full public URL
            marker = f"/object/public/{BUCKET_NAME}/"
            if marker in resource.file_path:
                storage_path = resource.file_path.split(marker)[-1]
                supabase.storage.from_(BUCKET_NAME).remove([storage_path])
    except Exception as e:
        print(f"[Resources] Failed to delete from Supabase: {e}")

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
