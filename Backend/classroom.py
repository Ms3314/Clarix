from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Annotated, List
from Backend.auth import get_current_teacher, get_current_student, get_current_user
from Backend.models import Users, Classroom, Enrollment
from Backend.Database import SessionLocal
from pydantic import BaseModel, EmailStr
from datetime import datetime
from Backend.Database import get_db

router = APIRouter(
    prefix="/classrooms",
    tags=["classrooms"]
)

db_dependency = Annotated[Session, Depends(get_db)]

class ClassroomCreate(BaseModel):
    name: str
    description: str = ""

class ClassroomResponse(BaseModel):
    id: int
    name: str
    description: str
    teacher_id: int
    invite_code: str
    created_at: datetime

class ClassroomDetailResponse(ClassroomResponse):
    student_count: int
    resource_count: int
    quiz_count: int

class EnrollStudentRequest(BaseModel):
    email: EmailStr

class JoinClassroomRequest(BaseModel):
    invite_code: str

class ClassroomUpdate(BaseModel):
    name: str
    description: str = ""

class StudentResponse(BaseModel):
    id: int
    username: str
    email: str
    unique_id: str
    enrolled_at: datetime

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_classroom(
    classroom_data: ClassroomCreate,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    print("what is this keywork typeshi")
    new_classroom = Classroom(
        name=classroom_data.name,
        description=classroom_data.description,
        teacher_id=teacher.id
    )
    db.add(new_classroom)
    db.commit()
    db.refresh(new_classroom)

    return {
        "message": "Classroom created successfully",
        "classroom": {
            "id": new_classroom.id,
            "name": new_classroom.name,
            "description": new_classroom.description,
            "invite_code": new_classroom.invite_code,
            "created_at": new_classroom.created_at
        }
    }

@router.get("/")
async def list_classrooms(
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user.role == "teacher":
        classrooms = db.query(Classroom).filter(Classroom.teacher_id == user.id).all()
    else:
        enrollments = db.query(Enrollment).filter(
            Enrollment.user_id == user.id,
            Enrollment.status == "approved"
        ).all()
        classroom_ids = [e.classroom_id for e in enrollments]
        classrooms = db.query(Classroom).filter(Classroom.id.in_(classroom_ids)).all()

    return {
        "classrooms": [
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "teacher_id": c.teacher_id,
                "invite_code": c.invite_code,
                "created_at": c.created_at,
                "student_count": db.query(Enrollment).filter(
                    Enrollment.classroom_id == c.id,
                    Enrollment.status == "approved"
                ).count()
            } for c in classrooms
        ]
    }

@router.get("/{classroom_id}")
async def get_classroom(
    classroom_id: int,
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    # Check if user has access
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

    approved_count = db.query(Enrollment).filter(
        Enrollment.classroom_id == classroom_id,
        Enrollment.status == "approved"
    ).count()

    return {
        "id": classroom.id,
        "name": classroom.name,
        "description": classroom.description,
        "teacher_id": classroom.teacher_id,
        "invite_code": classroom.invite_code,
        "created_at": classroom.created_at,
        "student_count": approved_count,
        "resource_count": len(classroom.resources),
        "quiz_count": len(classroom.quizzes)
    }

@router.put("/{classroom_id}")
async def update_classroom(
    classroom_id: int,
    request: ClassroomUpdate,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == teacher.id
    ).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    classroom.name = request.name
    classroom.description = request.description
    db.commit()
    db.refresh(classroom)

    approved_count = db.query(Enrollment).filter(
        Enrollment.classroom_id == classroom_id,
        Enrollment.status == "approved"
    ).count()

    return {
        "id": classroom.id,
        "name": classroom.name,
        "description": classroom.description,
        "teacher_id": classroom.teacher_id,
        "invite_code": classroom.invite_code,
        "created_at": classroom.created_at,
        "student_count": approved_count,
        "resource_count": len(classroom.resources),
        "quiz_count": len(classroom.quizzes)
    }

@router.post("/{classroom_id}/invite")
async def invite_student(
    classroom_id: int,
    request: EnrollStudentRequest,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == teacher.id
    ).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    student = db.query(Users).filter(Users.email == request.email).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student with this email not found")

    if student.role != "student":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is not a student")

    existing_enrollment = db.query(Enrollment).filter(
        Enrollment.user_id == student.id,
        Enrollment.classroom_id == classroom_id
    ).first()
    if existing_enrollment:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student already enrolled")

    enrollment = Enrollment(user_id=student.id, classroom_id=classroom_id, status="approved")
    db.add(enrollment)
    db.commit()

    return {"message": f"Student {student.username} invited successfully"}

@router.delete("/{classroom_id}/students/{student_id}")
async def remove_student(
    classroom_id: int,
    student_id: int,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == teacher.id
    ).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    enrollment = db.query(Enrollment).filter(
        Enrollment.user_id == student_id,
        Enrollment.classroom_id == classroom_id
    ).first()
    if not enrollment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not enrolled")

    db.delete(enrollment)
    db.commit()

    return {"message": "Student removed successfully"}

@router.get("/{classroom_id}/students")
async def list_students(
    classroom_id: int,
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    # Check access
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

    enrollments = db.query(Enrollment).filter(
        Enrollment.classroom_id == classroom_id,
        Enrollment.status == "approved"
    ).all()
    students = []
    for e in enrollments:
        student = db.query(Users).filter(Users.id == e.user_id).first()
        if student:
            students.append({
                "id": student.id,
                "username": student.username,
                "email": student.email,
                "unique_id": student.unique_id,
                "enrolled_at": e.enrolled_at
            })

    return {"students": students}

@router.post("/join")
async def join_classroom(
    request: JoinClassroomRequest,
    student: Users = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(Classroom.invite_code == request.invite_code.upper()).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invite code")

    existing = db.query(Enrollment).filter(
        Enrollment.user_id == student.id,
        Enrollment.classroom_id == classroom.id
    ).first()
    if existing:
        if existing.status == "approved":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already enrolled in this classroom")
        elif existing.status == "pending":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Join request already pending")
        else:
            # Previously rejected — re-apply
            existing.status = "pending"
            db.commit()
            return {"message": "Join request submitted for review"}

    enrollment = Enrollment(
        user_id=student.id,
        classroom_id=classroom.id,
        status="pending"
    )
    db.add(enrollment)
    db.commit()

    return {"message": "Join request submitted for teacher approval"}

@router.get("/{classroom_id}/pending")
async def list_pending_students(
    classroom_id: int,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == teacher.id
    ).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    enrollments = db.query(Enrollment).filter(
        Enrollment.classroom_id == classroom_id,
        Enrollment.status == "pending"
    ).all()

    pending = []
    for e in enrollments:
        student = db.query(Users).filter(Users.id == e.user_id).first()
        if student:
            pending.append({
                "id": student.id,
                "username": student.username,
                "email": student.email,
                "unique_id": student.unique_id,
                "requested_at": e.enrolled_at
            })

    return {"pending": pending}

@router.post("/{classroom_id}/pending/{student_id}/approve")
async def approve_student(
    classroom_id: int,
    student_id: int,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == teacher.id
    ).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    enrollment = db.query(Enrollment).filter(
        Enrollment.user_id == student_id,
        Enrollment.classroom_id == classroom_id,
        Enrollment.status == "pending"
    ).first()
    if not enrollment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pending request not found")

    enrollment.status = "approved"
    db.commit()

    return {"message": "Student approved successfully"}

@router.delete("/{classroom_id}/pending/{student_id}/reject")
async def reject_student(
    classroom_id: int,
    student_id: int,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == teacher.id
    ).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    enrollment = db.query(Enrollment).filter(
        Enrollment.user_id == student_id,
        Enrollment.classroom_id == classroom_id,
        Enrollment.status == "pending"
    ).first()
    if not enrollment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pending request not found")

    db.delete(enrollment)
    db.commit()

    return {"message": "Student request rejected"}

@router.delete("/{classroom_id}")
async def delete_classroom(
    classroom_id: int,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == teacher.id
    ).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    db.delete(classroom)
    db.commit()

    return {"message": "Classroom deleted successfully"}
