from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import Annotated, List
from pydantic import BaseModel
from Backend.auth import get_current_teacher, get_current_student, get_current_user
from Backend.models import Users, Classroom, Resource
from Backend.Database import SessionLocal
from Backend.rag_service import index_resource, generate_rag_response
import os
from datetime import datetime
from pathlib import Path

router = APIRouter(
    prefix="/classrooms",
    tags=["resources"]
)

db_dependency = Annotated[Session, Depends(SessionLocal)]

UPLOAD_DIR = "uploads/resources"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class ResourceResponse(BaseModel):
    id: int
    filename: str
    file_size: int
    indexed: bool
    created_at: datetime

class ChatRequest(BaseModel):
    query: str

class ChatResponse(BaseModel):
    response: str
    sources: list

def get_resource_response(resource: Resource):
    return {
        "id": resource.id,
        "filename": resource.filename,
        "file_size": resource.file_size,
        "indexed": resource.indexed,
        "created_at": resource.created_at,
        "classroom_id": resource.classroom_id
    }

@router.post("/{classroom_id}/resources")
async def upload_resource(
    classroom_id: int,
    file: UploadFile = File(...),
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(SessionLocal)
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == teacher.id
    ).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files are allowed")

    file_path = os.path.join(UPLOAD_DIR, f"{classroom_id}_{file.filename}")
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    resource = Resource(
        classroom_id=classroom_id,
        filename=file.filename,
        file_path=file_path,
        file_size=len(content),
        indexed=False
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)

    indexed = index_resource(file_path, classroom_id, resource.id)
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
    db: Session = Depends(SessionLocal)
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

@router.post("/{classroom_id}/chat")
async def chat_with_resources(
    classroom_id: int,
    request: ChatRequest,
    user: Users = Depends(get_current_user),
    db: Session = Depends(SessionLocal)
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
    db: Session = Depends(SessionLocal)
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

    if os.path.exists(resource.file_path):
        os.remove(resource.file_path)

    db.delete(resource)
    db.commit()

    return {"message": "Resource deleted successfully"}
