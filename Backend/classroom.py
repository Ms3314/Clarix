from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import Annotated, List
from Backend.auth import get_current_teacher, get_current_student, get_current_user
from Backend.models import Users, Classroom, Enrollment, ClassroomTeacher
from Backend.Database import SessionLocal
from pydantic import BaseModel, EmailStr
from datetime import datetime
import os
import time
from Backend.Database import get_db

BUCKET_NAME = "classroom-resources"

_supabase_client = None


def _get_supabase():
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


router = APIRouter(
    prefix="/classrooms",
    tags=["classrooms"]
)

db_dependency = Annotated[Session, Depends(get_db)]


def _is_teacher_or_co_teacher(db: Session, classroom_id: int, user_id: int) -> bool:
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        return False
    if classroom.teacher_id == user_id:
        return True
    return db.query(ClassroomTeacher).filter(
        ClassroomTeacher.classroom_id == classroom_id,
        ClassroomTeacher.teacher_id == user_id
    ).first() is not None


class ClassroomCreate(BaseModel):
    name: str
    description: str = ""
    subject: str = ""
    icon: str = "sigma"
    banner: str = ""
    is_public: bool = False
    teacher_emails: List[str] = []

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
    subject: str = ""
    icon: str = "sigma"
    banner: str = ""
    is_public: bool = False
    resources_enabled: bool = True
    quizzes_enabled: bool = True
    flashcards_enabled: bool = True
    announcements_enabled: bool = True

class StudentResponse(BaseModel):
    id: int
    username: str
    email: str
    unique_id: str
    enrolled_at: datetime

@router.post("/upload-banner")
async def upload_banner(
    file: UploadFile = File(...),
    teacher: Users = Depends(get_current_teacher),
):
    supabase = _get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    file_path = f"banners/{int(time.time() * 1000)}-{os.urandom(4).hex()}.{ext}"
    file_bytes = await file.read()

    supabase.storage.from_(BUCKET_NAME).upload(
        file_path, file_bytes,
        {"content-type": file.content_type or "image/png", "upsert": "true"}
    )
    supabase_url = os.getenv("SUPABASE_URL")
    public_url = f"{supabase_url}/storage/v1/object/public/{BUCKET_NAME}/{file_path}"
    return {"url": public_url}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_classroom(
    classroom_data: ClassroomCreate,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    new_classroom = Classroom(
        name=classroom_data.name,
        description=classroom_data.description,
        subject=classroom_data.subject,
        icon=classroom_data.icon,
        banner=classroom_data.banner or None,
        is_public=classroom_data.is_public,
        teacher_id=teacher.id
    )
    db.add(new_classroom)
    db.commit()
    db.refresh(new_classroom)

    # Add co-teachers
    co_teachers = []
    for email in classroom_data.teacher_emails:
        if not email.strip():
            continue
        t = db.query(Users).filter(Users.email == email.strip(), Users.role == "teacher").first()
        if t and t.id != teacher.id:
            existing = db.query(ClassroomTeacher).filter(
                ClassroomTeacher.classroom_id == new_classroom.id,
                ClassroomTeacher.teacher_id == t.id
            ).first()
            if not existing:
                link = ClassroomTeacher(classroom_id=new_classroom.id, teacher_id=t.id)
                db.add(link)
                co_teachers.append({"id": t.id, "username": t.username, "email": t.email})

    db.commit()

    return {
        "message": "Classroom created successfully",
        "classroom": {
            "id": new_classroom.id,
            "name": new_classroom.name,
            "description": new_classroom.description,
            "subject": new_classroom.subject,
            "icon": new_classroom.icon,
            "banner": new_classroom.banner,
            "is_public": new_classroom.is_public,
            "invite_code": new_classroom.invite_code,
            "created_at": new_classroom.created_at,
            "co_teachers": co_teachers,
        }
    }

@router.get("/")
async def list_classrooms(
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user.role == "teacher":
        owned = db.query(Classroom).filter(Classroom.teacher_id == user.id).all()
        co_teaching_ids = db.query(ClassroomTeacher.classroom_id).filter(ClassroomTeacher.teacher_id == user.id).subquery()
        co_taught = db.query(Classroom).filter(Classroom.id.in_(co_teaching_ids)).all()
        classrooms = list({c.id: c for c in owned + co_taught}.values())
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
                "subject": c.subject,
                "icon": c.icon,
                "banner": c.banner,
                "is_public": c.is_public,
                "resources_enabled": c.resources_enabled,
                "quizzes_enabled": c.quizzes_enabled,
                "flashcards_enabled": c.flashcards_enabled,
                "announcements_enabled": c.announcements_enabled,
                "teacher_id": c.teacher_id,
                "teacher_name": c.teacher.username if c.teacher else None,
                "teacher_profile_picture": c.teacher.profile_picture_url if c.teacher else None,
                "invite_code": c.invite_code,
                "created_at": c.created_at,
                "student_count": db.query(Enrollment).filter(
                    Enrollment.classroom_id == c.id,
                    Enrollment.status == "approved"
                ).count()
            } for c in classrooms
        ]
    }

@router.get("/info/{invite_code}")
async def get_classroom_by_invite(
    invite_code: str,
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(Classroom.invite_code == invite_code.upper()).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invite code")

    teacher_name = classroom.teacher.username if classroom.teacher else None
    teacher_profile_picture = classroom.teacher.profile_picture_url if classroom.teacher else None
    co_teachers = [{"id": ct.teacher.id, "username": ct.teacher.username, "email": ct.teacher.email, "profile_picture_url": ct.teacher.profile_picture_url} for ct in classroom.co_teacher_links]

    return {
        "id": classroom.id,
        "name": classroom.name,
        "description": classroom.description,
        "subject": classroom.subject,
        "banner": classroom.banner,
        "is_public": classroom.is_public,
        "resources_enabled": classroom.resources_enabled,
        "quizzes_enabled": classroom.quizzes_enabled,
        "flashcards_enabled": classroom.flashcards_enabled,
        "announcements_enabled": classroom.announcements_enabled,
        "teacher_id": classroom.teacher_id,
        "teacher_name": teacher_name,
        "teacher_profile_picture": teacher_profile_picture,
        "co_teachers": co_teachers,
        "student_count": db.query(Enrollment).filter(Enrollment.classroom_id == classroom.id, Enrollment.status == "approved").count(),
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
    if user.role == "teacher":
        is_owner = classroom.teacher_id == user.id
        is_co_teacher = db.query(ClassroomTeacher).filter(
            ClassroomTeacher.classroom_id == classroom_id,
            ClassroomTeacher.teacher_id == user.id
        ).first() is not None
        if not is_owner and not is_co_teacher:
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

    co_teachers = []
    for link in classroom.co_teacher_links:
        co_teachers.append({"id": link.teacher.id, "username": link.teacher.username, "email": link.teacher.email})

    return {
        "id": classroom.id,
        "name": classroom.name,
        "description": classroom.description,
        "subject": classroom.subject,
        "icon": classroom.icon,
        "banner": classroom.banner,
        "is_public": classroom.is_public,
        "resources_enabled": classroom.resources_enabled,
        "quizzes_enabled": classroom.quizzes_enabled,
        "flashcards_enabled": classroom.flashcards_enabled,
        "announcements_enabled": classroom.announcements_enabled,
        "teacher_id": classroom.teacher_id,
        "invite_code": classroom.invite_code,
        "created_at": classroom.created_at,
        "student_count": approved_count,
        "resource_count": len(classroom.resources),
        "quiz_count": len(classroom.quizzes),
        "co_teachers": co_teachers,
    }

@router.put("/{classroom_id}")
async def update_classroom(
    classroom_id: int,
    request: ClassroomUpdate,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    if not _is_teacher_or_co_teacher(db, classroom_id, teacher.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()

    classroom.name = request.name
    classroom.description = request.description
    classroom.subject = request.subject
    classroom.icon = request.icon
    classroom.banner = request.banner or None
    classroom.is_public = request.is_public
    classroom.resources_enabled = request.resources_enabled
    classroom.quizzes_enabled = request.quizzes_enabled
    classroom.flashcards_enabled = request.flashcards_enabled
    classroom.announcements_enabled = request.announcements_enabled
    db.commit()
    db.refresh(classroom)

    approved_count = db.query(Enrollment).filter(
        Enrollment.classroom_id == classroom_id,
        Enrollment.status == "approved"
    ).count()

    co_teachers = []
    for link in classroom.co_teacher_links:
        co_teachers.append({"id": link.teacher.id, "username": link.teacher.username, "email": link.teacher.email})

    return {
        "id": classroom.id,
        "name": classroom.name,
        "description": classroom.description,
        "subject": classroom.subject,
        "icon": classroom.icon,
        "banner": classroom.banner,
        "is_public": classroom.is_public,
        "resources_enabled": classroom.resources_enabled,
        "quizzes_enabled": classroom.quizzes_enabled,
        "flashcards_enabled": classroom.flashcards_enabled,
        "announcements_enabled": classroom.announcements_enabled,
        "teacher_id": classroom.teacher_id,
        "invite_code": classroom.invite_code,
        "created_at": classroom.created_at,
        "student_count": approved_count,
        "resource_count": len(classroom.resources),
        "quiz_count": len(classroom.quizzes),
        "co_teachers": co_teachers,
    }

@router.post("/{classroom_id}/invite")
async def invite_student(
    classroom_id: int,
    request: EnrollStudentRequest,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    if not _is_teacher_or_co_teacher(db, classroom_id, teacher.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()

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
    if not _is_teacher_or_co_teacher(db, classroom_id, teacher.id):
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
    if user.role == "teacher" and not _is_teacher_or_co_teacher(db, classroom_id, user.id):
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
                "profile_picture_url": student.profile_picture_url,
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
            existing.status = "approved" if classroom.is_public else "pending"
            db.commit()
            return {"message": "Join request submitted for review", "status": existing.status}

    if classroom.is_public:
        enrollment = Enrollment(
            user_id=student.id,
            classroom_id=classroom.id,
            status="approved"
        )
        db.add(enrollment)
        db.commit()
        return {"message": "You've joined the classroom!", "status": "approved"}
    else:
        enrollment = Enrollment(
            user_id=student.id,
            classroom_id=classroom.id,
            status="pending"
        )
        db.add(enrollment)
        db.commit()
        return {"message": "Join request submitted for teacher approval", "status": "pending"}

@router.get("/{classroom_id}/pending")
async def list_pending_students(
    classroom_id: int,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    if not _is_teacher_or_co_teacher(db, classroom_id, teacher.id):
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
    if not _is_teacher_or_co_teacher(db, classroom_id, teacher.id):
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
    if not _is_teacher_or_co_teacher(db, classroom_id, teacher.id):
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
