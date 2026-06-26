from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Annotated
from auth import get_current_teacher, get_current_user
from models import Users, Classroom, Enrollment, Announcement
from Database import get_db
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/classrooms", tags=["announcements"])

db_dependency = Annotated[Session, Depends(get_db)]


class AnnouncementCreate(BaseModel):
    title: str
    content: str


def _check_classroom_access(classroom_id: int, user: Users, db: Session) -> Classroom:
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")
    if user.role == "teacher" and classroom.teacher_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if user.role == "student":
        enrolled = db.query(Enrollment).filter(
            Enrollment.user_id == user.id,
            Enrollment.classroom_id == classroom_id,
            Enrollment.status == "approved"
        ).first()
        if not enrolled:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return classroom


@router.get("/{classroom_id}/announcements")
async def list_announcements(
    classroom_id: int,
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_classroom_access(classroom_id, user, db)
    announcements = (
        db.query(Announcement)
        .filter(Announcement.classroom_id == classroom_id)
        .order_by(Announcement.created_at.desc())
        .all()
    )
    return {
        "announcements": [
            {
                "id": a.id,
                "title": a.title,
                "content": a.content,
                "teacher_name": a.teacher.username,
                "created_at": a.created_at,
            }
            for a in announcements
        ]
    }


@router.post("/{classroom_id}/announcements", status_code=status.HTTP_201_CREATED)
async def create_announcement(
    classroom_id: int,
    data: AnnouncementCreate,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == teacher.id,
    ).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    announcement = Announcement(
        classroom_id=classroom_id,
        teacher_id=teacher.id,
        title=data.title,
        content=data.content,
    )
    db.add(announcement)
    db.commit()
    db.refresh(announcement)

    return {
        "message": "Announcement posted",
        "announcement": {
            "id": announcement.id,
            "title": announcement.title,
            "content": announcement.content,
            "teacher_name": teacher.username,
            "created_at": announcement.created_at,
        },
    }


@router.delete("/{classroom_id}/announcements/{announcement_id}", status_code=status.HTTP_200_OK)
async def delete_announcement(
    classroom_id: int,
    announcement_id: int,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == teacher.id,
    ).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    announcement = db.query(Announcement).filter(
        Announcement.id == announcement_id,
        Announcement.classroom_id == classroom_id,
    ).first()
    if not announcement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")

    db.delete(announcement)
    db.commit()
    return {"message": "Announcement deleted"}
