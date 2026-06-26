from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Annotated, List
from auth import get_current_teacher, get_current_student, get_current_user
from models import Users, Classroom, Flashcard, Enrollment
from Database import SessionLocal
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(
    prefix="/classrooms",
    tags=["flashcards"]
)

db_dependency = Annotated[Session, Depends(SessionLocal)]

class FlashcardCreate(BaseModel):
    front: str
    back: str

class FlashcardUpdate(BaseModel):
    front: str = None
    back: str = None

class FlashcardResponse(BaseModel):
    id: int
    front: str
    back: str
    created_at: datetime

@router.post("/{classroom_id}/flashcards", status_code=status.HTTP_201_CREATED)
async def create_flashcard(
    classroom_id: int,
    flashcard_data: FlashcardCreate,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(SessionLocal)
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == teacher.id
    ).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    flashcard = Flashcard(
        classroom_id=classroom_id,
        front=flashcard_data.front,
        back=flashcard_data.back,
        created_by=teacher.id
    )
    db.add(flashcard)
    db.commit()
    db.refresh(flashcard)

    return {
        "message": "Flashcard created successfully",
        "flashcard": {
            "id": flashcard.id,
            "front": flashcard.front,
            "back": flashcard.back,
            "created_at": flashcard.created_at
        }
    }

@router.get("/{classroom_id}/flashcards")
async def list_flashcards(
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
        enrollment = db.query(Enrollment).filter(
            Enrollment.user_id == user.id,
            Enrollment.classroom_id == classroom_id,
            Enrollment.status == "approved"
        ).first()
        if not enrollment:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    flashcards = db.query(Flashcard).filter(Flashcard.classroom_id == classroom_id).all()

    return {
        "flashcards": [
            {
                "id": f.id,
                "front": f.front,
                "back": f.back,
                "created_at": f.created_at
            } for f in flashcards
        ]
    }

@router.put("/{classroom_id}/flashcards/{flashcard_id}")
async def update_flashcard(
    classroom_id: int,
    flashcard_id: int,
    update_data: FlashcardUpdate,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(SessionLocal)
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == teacher.id
    ).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    flashcard = db.query(Flashcard).filter(
        Flashcard.id == flashcard_id,
        Flashcard.classroom_id == classroom_id
    ).first()
    if not flashcard:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flashcard not found")

    if update_data.front is not None:
        flashcard.front = update_data.front
    if update_data.back is not None:
        flashcard.back = update_data.back

    db.commit()

    return {
        "message": "Flashcard updated successfully",
        "flashcard": {
            "id": flashcard.id,
            "front": flashcard.front,
            "back": flashcard.back,
            "created_at": flashcard.created_at
        }
    }

@router.delete("/{classroom_id}/flashcards/{flashcard_id}")
async def delete_flashcard(
    classroom_id: int,
    flashcard_id: int,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(SessionLocal)
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == teacher.id
    ).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    flashcard = db.query(Flashcard).filter(
        Flashcard.id == flashcard_id,
        Flashcard.classroom_id == classroom_id
    ).first()
    if not flashcard:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flashcard not found")

    db.delete(flashcard)
    db.commit()

    return {"message": "Flashcard deleted successfully"}
