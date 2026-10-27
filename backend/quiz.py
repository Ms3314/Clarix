from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Annotated, List
from backend.auth import get_current_teacher, get_current_student, get_current_user
from backend.models import Users, Classroom, Quiz, QuizQuestion, QuizAttempt, Enrollment
from backend.Database import SessionLocal, get_db
from pydantic import BaseModel
from datetime import datetime
import json
from backend.quiz_ai import generate_quiz

router = APIRouter(
    prefix="/classrooms",
    tags=["quizzes"]
)

db_dependency = Annotated[Session, Depends(SessionLocal)]

class QuestionCreate(BaseModel):
    question: str
    options: List[str]
    correct_answer: int
    order: int = 0

class QuizCreate(BaseModel):
    title: str
    description: str = ""
    questions: List[QuestionCreate]
    is_ai_generated: bool = False

class QuizUpdate(BaseModel):
    title: str = None
    description: str = None
    questions: List[QuestionCreate] = None

class QuizAttemptRequest(BaseModel):
    answers: List[int]

class QuizResponse(BaseModel):
    id: int
    title: str
    description: str
    is_ai_generated: bool
    created_at: datetime
    question_count: int

class GenerateQuizRequest(BaseModel):
    title: str
    topic: str
    difficulty: str = "medium"
    num_questions: int = 5


@router.post("/{classroom_id}/quizzes", status_code=status.HTTP_201_CREATED)
async def create_quiz(
    classroom_id: int,
    quiz_data: QuizCreate,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == teacher.id
    ).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    quiz = Quiz(
        classroom_id=classroom_id,
        title=quiz_data.title,
        description=quiz_data.description,
        created_by=teacher.id,
        is_ai_generated=quiz_data.is_ai_generated
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)

    for q_data in quiz_data.questions:
        question = QuizQuestion(
            quiz_id=quiz.id,
            question=q_data.question,
            options=json.dumps(q_data.options),
            correct_answer=q_data.correct_answer,
            order=q_data.order
        )
        db.add(question)

    db.commit()

    return {
        "message": "Quiz created successfully",
        "quiz_id": quiz.id,
        "question_count": len(quiz_data.questions)
    }

@router.get("/{classroom_id}/quizzes")
async def list_quizzes(
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
        enrollment = db.query(Enrollment).filter(
            Enrollment.user_id == user.id,
            Enrollment.classroom_id == classroom_id,
            Enrollment.status == "approved"
        ).first()
        if not enrollment:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    quizzes = db.query(Quiz).filter(Quiz.classroom_id == classroom_id).all()

    return {
        "quizzes": [
            {
                "id": q.id,
                "title": q.title,
                "description": q.description,
                "is_ai_generated": q.is_ai_generated,
                "created_at": q.created_at,
                "question_count": len(q.questions)
            } for q in quizzes
        ]
    }

@router.get("/{classroom_id}/quizzes/{quiz_id}")
async def get_quiz(
    classroom_id: int,
    quiz_id: int,
    user: Users = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    quiz = db.query(Quiz).filter(
        Quiz.id == quiz_id,
        Quiz.classroom_id == classroom_id
    ).first()
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")

    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()

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

    questions = []
    for q in quiz.questions:
        questions.append({
            "id": q.id,
            "question": q.question,
            "options": json.loads(q.options),
            "correct_answer": q.correct_answer if user.role == "teacher" else None,
            "order": q.order
        })

    return {
        "id": quiz.id,
        "title": quiz.title,
        "description": quiz.description,
        "is_ai_generated": quiz.is_ai_generated,
        "created_at": quiz.created_at,
        "questions": questions
    }

@router.post("/{classroom_id}/quizzes/{quiz_id}/attempt")
async def attempt_quiz(
    classroom_id: int,
    quiz_id: int,
    attempt_data: QuizAttemptRequest,
    student: Users = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    quiz = db.query(Quiz).filter(
        Quiz.id == quiz_id,
        Quiz.classroom_id == classroom_id
    ).first()
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")

    enrollment = db.query(Enrollment).filter(
        Enrollment.user_id == student.id,
        Enrollment.classroom_id == classroom_id,
        Enrollment.status == "approved"
    ).first()
    if not enrollment:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enrolled in this classroom")
    
    existing_attempt = db.query(QuizAttempt).filter(QuizAttempt.quiz_id == quiz_id,QuizAttempt.student_id == student.id).first()

    if existing_attempt:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="You have already attempted this quiz")

    questions = db.query(QuizQuestion).filter(QuizQuestion.quiz_id == quiz_id).order_by(QuizQuestion.order).all()
    total_questions = len(questions)
    correct_answers = 0

    for i, q in enumerate(questions):
        if i < len(attempt_data.answers) and attempt_data.answers[i] == q.correct_answer:
            correct_answers += 1

    score = (correct_answers / total_questions) * 100 if total_questions > 0 else 0

    attempt = QuizAttempt(
        quiz_id=quiz_id,
        student_id=student.id,
        score=score,
        total_questions=total_questions,
        answers=json.dumps(attempt_data.answers)
    )
    db.add(attempt)
    db.commit()

    return {
        "message": "Quiz submitted successfully",
        "score": score,
        "correct_answers": correct_answers,
        "total_questions": total_questions
    }

@router.get("/{classroom_id}/quizzes/{quiz_id}/attempts")
async def get_quiz_attempts(
    classroom_id: int,
    quiz_id: int,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == teacher.id
    ).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    attempts = db.query(QuizAttempt).filter(QuizAttempt.quiz_id == quiz_id).all()

    return {
        "attempts": [
            {
                "id": a.id,
                "student_id": a.student_id,
                "student_name": db.query(Users).filter(Users.id == a.student_id).first().username,
                "score": a.score,
                "total_questions": a.total_questions,
                "attempted_at": a.attempted_at
            } for a in attempts
        ]
    }


@router.get("/{classroom_id}/quizzes/{quiz_id}/leaderboard")
async def get_quiz_leaderboard(
    classroom_id: int,
    quiz_id: int,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    quiz = db.query(Quiz).filter(
        Quiz.id == quiz_id,
        Quiz.classroom_id == classroom_id
    ).first()

    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    
    attempts = db.query(QuizAttempt).filter(QuizAttempt.quiz_id == quiz_id).order_by(QuizAttempt.score.desc()).all()
    leaderboard = []
    for rank, attempt in enumerate(attempts, start=1):
        student = db.query(Users).filter(Users.id == attempt.student_id).first()

        leaderboard.append({
            "rank": rank,
            "student_id": attempt.student_id,
            "student_name": student.username,
            "score": attempt.score,
            "attempted_at": attempt.attempted_at
        })
    return {"quiz_id": quiz_id, "quiz_title": quiz.title, "leaderboard": leaderboard}



@router.post("/{classroom_id}/quizzes/generate")
async def generate_ai_quiz(
    classroom_id: int,
    data: GenerateQuizRequest,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == teacher.id
    ).first()

    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found"
        )

    questions = generate_quiz(
        topic=data.topic,
        difficulty=data.difficulty,
        num_questions=data.num_questions
    )

    quiz = Quiz(
        classroom_id=classroom_id,
        title=data.title,
        description=f"AI Generated Quiz on {data.topic}",
        created_by=teacher.id,
        is_ai_generated=True
    )

    db.add(quiz)
    db.commit()
    db.refresh(quiz)

    for index, q in enumerate(questions):

        question = QuizQuestion(
            quiz_id=quiz.id,
            question=q["question"],
            options=json.dumps(q["options"]),
            correct_answer=q["correct_answer"],
            order=index + 1
        )

        db.add(question)

    db.commit()

    return {
        "message": "AI Quiz created successfully",
        "quiz_id": quiz.id,
        "question_count": len(questions)
    }

@router.put("/{classroom_id}/quizzes/{quiz_id}")
async def update_quiz(
    classroom_id: int,
    quiz_id: int,
    quiz_data: QuizUpdate,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == teacher.id
    ).first()

    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found"
        )

    quiz = db.query(Quiz).filter(
        Quiz.id == quiz_id,
        Quiz.classroom_id == classroom_id
    ).first()

    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found"
        )

    # Update title
    if quiz_data.title is not None:
        quiz.title = quiz_data.title

    # Update description
    if quiz_data.description is not None:
        quiz.description = quiz_data.description

    # Update questions
    if quiz_data.questions is not None:

        # Delete existing questions
        db.query(QuizQuestion).filter(
            QuizQuestion.quiz_id == quiz_id
        ).delete()

        # Add new questions
        for q_data in quiz_data.questions:
            question = QuizQuestion(
                quiz_id=quiz.id,
                question=q_data.question,
                options=json.dumps(q_data.options),
                correct_answer=q_data.correct_answer,
                order=q_data.order
            )

            db.add(question)

    db.commit()

    return {
        "message": "Quiz updated successfully",
        "quiz_id": quiz.id
    }

@router.delete("/{classroom_id}/quizzes/{quiz_id}")
async def delete_quiz(
    classroom_id: int,
    quiz_id: int,
    teacher: Users = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == teacher.id
    ).first()

    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classroom not found"
        )

    quiz = db.query(Quiz).filter(
        Quiz.id == quiz_id,
        Quiz.classroom_id == classroom_id
    ).first()

    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found"
        )

    # Delete quiz questions
    db.query(QuizQuestion).filter(
        QuizQuestion.quiz_id == quiz_id
    ).delete()

    # Delete quiz attempts
    db.query(QuizAttempt).filter(
        QuizAttempt.quiz_id == quiz_id
    ).delete()

    # Delete quiz
    db.delete(quiz)

    db.commit()

    return {
        "message": "Quiz deleted successfully"
    }

