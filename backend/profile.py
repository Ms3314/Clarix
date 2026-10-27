from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import Annotated
from pydantic import BaseModel
from backend.auth import get_current_user
from backend.models import Users
from backend.Database import get_db
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(
    prefix="/profile",
    tags=["profile"]
)

BUCKET_NAME = "profile-pictures"

db_dependency = Annotated[Session, Depends(get_db)]

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


class ProfileUpdateRequest(BaseModel):
    profile_picture_url: str | None = None


@router.post("/picture/upload")
async def upload_profile_picture(
    file: UploadFile = File(...),
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload or update profile picture for authenticated user"""
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )

    # Validate file size (max 5MB)
    file_content = await file.read()
    if len(file_content) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size must be less than 5MB"
        )

    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Storage service unavailable"
        )

    # Generate file path
    file_extension = file.filename.split(".")[-1]
    file_path = f"{user.id}_{datetime.utcnow().timestamp()}.{file_extension}"

    try:
        # Upload to Supabase
        supabase.storage.from_(BUCKET_NAME).upload(
            file_path,
            file_content,
            {"content-type": file.content_type, "upsert": "true"}
        )

        # Generate public URL
        supabase_url = os.getenv("SUPABASE_URL")
        profile_picture_url = f"{supabase_url}/storage/v1/object/public/{BUCKET_NAME}/{file_path}"

        # Update user profile picture URL
        db_user = db.query(Users).filter(Users.id == user.id).first()
        db_user.profile_picture_url = profile_picture_url
        db_user.profile_picture_updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_user)

        return {
            "message": "Profile picture uploaded successfully",
            "profile_picture_url": db_user.profile_picture_url
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload profile picture: {str(e)}"
        )


@router.delete("/picture")
async def delete_profile_picture(
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete profile picture for authenticated user"""
    if not user.profile_picture_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No profile picture to delete"
        )

    db_user = db.query(Users).filter(Users.id == user.id).first()
    db_user.profile_picture_url = None
    db_user.profile_picture_updated_at = None
    db.commit()

    return {"message": "Profile picture deleted successfully"}


@router.get("/{user_id}/picture")
async def get_user_profile_picture(
    user_id: int,
    db: Session = Depends(get_db)
):
    """Get profile picture URL for a specific user"""
    user = db.query(Users).filter(Users.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return {
        "id": user.id,
        "username": user.username,
        "profile_picture_url": user.profile_picture_url
    }


@router.get("/me/details")
async def get_my_profile(
    user: Users = Depends(get_current_user),
):
    """Get current user's profile details"""
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "profile_picture_url": user.profile_picture_url,
        "profile_picture_updated_at": user.profile_picture_updated_at.isoformat() if user.profile_picture_updated_at else None
    }
