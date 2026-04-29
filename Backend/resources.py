from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Annotated, List
from pydantic import BaseModel
from Backend.auth import get_current_teacher, get_current_student, get_current_user
from Backend.models import Users, Classroom, Resource
from Backend.Database import SessionLocal
from Backend.rag_service import index_resource_from_url, generate_rag_response
import os
from datetime import datetime
from Backend.Database import get_db

router = APIRouter(
    prefix="/classrooms",
    tags=["resources"]
)

db_dependency = Annotated[Session, Depends(get_db)]

BUCKET_NAME = "resources"

_supabase_client = None

def get_supabase_client():
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
    
    from supabase import create_client, Client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if not url or not key or url == "https://your-project.supabase.co":
        return None
    
    _supabase_client = create_client(url, key)
    return _supabase_client

class ResourceResponse(BaseModel):
    id: int
    filename: str
    file_size: int
    indexed: bool
    created_at: datetime
    file_url: str = None

class ChatRequest(BaseModel):
    query: str

class ChatResponse(BaseModel):
    response: str
    sources: list

class UploadUrlRequest(BaseModel):
    filename: str
    file_size: int

class CreateResourceRequest(BaseModel):
    filename: str
    file_size: int
    file_path: str

def get_resource_response(resource: Resource):
    return {
        "id": resource.id,
        "filename": resource.filename,
        "file_size": resource.file_size,
        "indexed": resource.indexed,
        "created_at": resource.created_at,
        "classroom_id": resource.classroom_id,
        "file_url": resource.file_path
    }

@router.post("/{classroom_id}/resources/generate-upload-url")
async def generate_upload_url(
    classroom_id: int,
    request: UploadUrlRequest,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    print("are u fine brooo????")
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == teacher.id
    ).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    if not request.filename.endswith('.pdf'):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files are allowed")

    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(
            status_code=503, 
            detail="Supabase storage not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env"
        )

    try:
        file_path = f"classrooms/{classroom_id}/{classroom_id}_{request.filename}"
        
        # presigned_data = supabase.storage.from_(BUCKET_NAME).create_signed_url(
        #     file_path,
        #     expires_in=3600
        # )
        
        return {
            "upload_url": presigned_data["signedURL"],
            "file_path": file_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate upload URL {e}:  {str(e)}")

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

    if not request.filename.endswith('.pdf'):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files are allowed")

    supabase = get_supabase_client()
    public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(request.file_path)
    full_url = f"{os.getenv('SUPABASE_URL')}/storage/v1/object/public/{BUCKET_NAME}/{request.file_path}"

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
        file_path = resource.file_path.split("/object/public/")[-1]
        supabase.storage.from_(BUCKET_NAME).remove([file_path])
    except Exception as e:
        print(f"Failed to delete from Supabase: {e}")

    db.delete(resource)
    db.commit()

    return {"message": "Resource deleted successfully"}