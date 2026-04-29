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
        print("classrooms for teacher",classrooms)
    else:
        enrollments = db.query(Enrollment).filter(Enrollment.user_id == user.id).all()
        classroom_ids = [e.classroom_id for e in enrollments]
        classrooms = db.query(Classroom).filter(Classroom.id.in_(classroom_ids)).all()
        print("classrooms for student",classrooms)

    return {
        "classrooms": [
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "teacher_id": c.teacher_id,
                "invite_code": c.invite_code,
                "created_at": c.created_at,
                "student_count": len(c.enrollments)
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
            Enrollment.classroom_id == classroom_id
        ).first()
        if not enrollment:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return {
        "id": classroom.id,
        "name": classroom.name,
        "description": classroom.description,
        "teacher_id": classroom.teacher_id,
        "invite_code": classroom.invite_code,
        "created_at": classroom.created_at,
        "student_count": len(classroom.enrollments),
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

    return {
        "id": classroom.id,
        "name": classroom.name,
        "description": classroom.description,
        "teacher_id": classroom.teacher_id,
        "invite_code": classroom.invite_code,
        "created_at": classroom.created_at,
        "student_count": len(classroom.enrollments),
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

    enrollment = Enrollment(user_id=student.id, classroom_id=classroom_id)
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
            Enrollment.classroom_id == classroom_id
        ).first()
        if not enrollment:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    enrollments = db.query(Enrollment).filter(Enrollment.classroom_id == classroom_id).all()
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
