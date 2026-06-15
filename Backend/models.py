from Backend.Database import Base
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

class Users(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default='student')  # 'teacher' or 'student'
    unique_id = Column(String, unique=True, default=lambda: str(uuid.uuid4())[:8])
    is_active = Column(Boolean, default=True)
    profile_picture_url = Column(String, nullable=True)
    profile_picture_updated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    classrooms_created = relationship("Classroom", back_populates="teacher")
    co_teaching_links = relationship("ClassroomTeacher", back_populates="teacher")
    enrollments = relationship("Enrollment", back_populates="student")
    quiz_attempts = relationship("QuizAttempt", back_populates="student")
    flashcards_created = relationship("Flashcard", back_populates="creator")
    quizzes_created = relationship("Quiz", back_populates="creator")
    announcements_made = relationship("Announcement", back_populates="teacher")

class ClassroomTeacher(Base):
    __tablename__ = 'classroom_teachers'

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey('classrooms.id'), nullable=False)
    teacher_id = Column(Integer, ForeignKey('users.id'), nullable=False)

    classroom = relationship("Classroom", back_populates="co_teacher_links")
    teacher = relationship("Users", back_populates="co_teaching_links")


class Classroom(Base):
    __tablename__ = 'classrooms'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    subject = Column(String, nullable=True)
    icon = Column(String, default='sigma')
    banner = Column(String, nullable=True)
    is_public = Column(Boolean, default=False)
    teacher_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    invite_code = Column(String, unique=True, default=lambda: str(uuid.uuid4())[:6].upper())
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    teacher = relationship("Users", back_populates="classrooms_created")
    co_teacher_links = relationship("ClassroomTeacher", back_populates="classroom", cascade="all, delete-orphan")
    enrollments = relationship("Enrollment", back_populates="classroom", cascade="all, delete-orphan")
    resources = relationship("Resource", back_populates="classroom", cascade="all, delete-orphan")
    folders = relationship("Folder", back_populates="classroom", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="classroom", cascade="all, delete-orphan")
    flashcards = relationship("Flashcard", back_populates="classroom", cascade="all, delete-orphan")
    announcements = relationship("Announcement", back_populates="classroom", cascade="all, delete-orphan")

class Enrollment(Base):
    __tablename__ = 'enrollments'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    classroom_id = Column(Integer, ForeignKey('classrooms.id'), nullable=False)
    status = Column(String, default='approved')  # 'pending', 'approved', 'rejected'
    enrolled_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    student = relationship("Users", back_populates="enrollments")
    classroom = relationship("Classroom", back_populates="enrollments")

class Folder(Base):
    __tablename__ = 'folders'

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey('classrooms.id'), nullable=False)
    name = Column(String, nullable=False)
    parent_id = Column(Integer, ForeignKey('folders.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    classroom = relationship("Classroom")
    parent = relationship("Folder", remote_side=[id], back_populates="children")
    children = relationship("Folder", back_populates="parent", cascade="all, delete-orphan")
    resources = relationship("Resource", back_populates="folder", cascade="all, delete-orphan")


class Resource(Base):
    __tablename__ = 'resources'

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey('classrooms.id'), nullable=False)
    folder_id = Column(Integer, ForeignKey('folders.id'), nullable=True)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=True)
    indexed = Column(Boolean, default=False)
    indexed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    classroom = relationship("Classroom", back_populates="resources")
    folder = relationship("Folder", back_populates="resources")

class Quiz(Base):
    __tablename__ = 'quizzes'

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey('classrooms.id'), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    is_ai_generated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    classroom = relationship("Classroom", back_populates="quizzes")
    creator = relationship("Users", back_populates="quizzes_created")
    questions = relationship("QuizQuestion", back_populates="quiz", cascade="all, delete-orphan")
    attempts = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")

class QuizQuestion(Base):
    __tablename__ = 'quiz_questions'

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey('quizzes.id'), nullable=False)
    question = Column(Text, nullable=False)
    options = Column(Text, nullable=False)  # JSON string of options
    correct_answer = Column(Integer, nullable=False)  # Index of correct option
    order = Column(Integer, default=0)

    # Relationships
    quiz = relationship("Quiz", back_populates="questions")

class QuizAttempt(Base):
    __tablename__ = 'quiz_attempts'

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey('quizzes.id'), nullable=False)
    student_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    score = Column(Float, nullable=True)
    total_questions = Column(Integer, nullable=False)
    answers = Column(Text, nullable=True)  # JSON string of student answers
    attempted_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    quiz = relationship("Quiz", back_populates="attempts")
    student = relationship("Users", back_populates="quiz_attempts")

class Flashcard(Base):
    __tablename__ = 'flashcards'

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey('classrooms.id'), nullable=False)
    front = Column(Text, nullable=False)
    back = Column(Text, nullable=False)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    classroom = relationship("Classroom", back_populates="flashcards")
    creator = relationship("Users", back_populates="flashcards_created")

class Announcement(Base):
    __tablename__ = 'announcements'

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey('classrooms.id'), nullable=False)
    teacher_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    classroom = relationship("Classroom", back_populates="announcements")
    teacher = relationship("Users", back_populates="announcements_made")

class ChatSession(Base):
    __tablename__ = 'chat_sessions'

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey('classrooms.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    title = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    classroom = relationship("Classroom")
    user = relationship("Users")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = 'chat_messages'

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey('chat_sessions.id'), nullable=False)
    role = Column(String, nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    session = relationship("ChatSession", back_populates="messages")
