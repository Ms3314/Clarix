from datetime import timedelta, datetime
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from Backend import models
from starlette import status as starlette_status
from Backend.Database import SessionLocal
from Backend.models import Users
import bcrypt
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from jose import jwt, JWTError
from fastapi import Request, Response
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)

SECRET_KEY = os.getenv("SECRET_KEY", "342e8he8eenu32329h293he293e23ec2ec98uc93h49cbf984arqy8940vryq34r")
ALGORITHM = "HS256"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str = "student"  # 'teacher' or 'student'

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    unique_id: str
    is_active: bool

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

db_dependency = Annotated[Session, Depends(get_db)]

async def get_current_user(request: Request, db: db_dependency):
    token = request.cookies.get("clarix_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        user_id: int = payload.get("id")
        if username is None or user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

        user = db.query(Users).filter(Users.id == user_id).first()
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

async def get_current_teacher(request: Request, db: db_dependency):
    user = await get_current_user(request, db)
    if user.role != "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teacher access required")
    return user

async def get_current_student(request: Request, db: db_dependency):
    user = await get_current_user(request, db)
    if user.role != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student access required")
    return user

def authenticate_user(username: str, password: str, db: Session):
    user = db.query(Users).filter(Users.username == username).first()
    if not user:
        return False
    if not bcrypt.checkpw(password.encode('utf-8'), user.hashed_password.encode('utf-8')):
        return False
    return user

def create_access_token(username: str, user_id: int, role: str, expires_delta: timedelta):
    encode = {'sub': username, 'id': user_id, 'role': role}
    expires = datetime.utcnow() + expires_delta
    encode.update({'exp': expires})
    return jwt.encode(encode, SECRET_KEY, algorithm=ALGORITHM)


# this is the route for signin
@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def create_user(db: db_dependency, create_user_request: UserCreate):
    # Check if username already exists
    existing_user = db.query(Users).filter(Users.username == create_user_request.username).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists")

    # Check if email already exists
    existing_email = db.query(Users).filter(Users.email == create_user_request.email).first()
    if existing_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")

    hashed_password = bcrypt.hashpw(create_user_request.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    create_user_model = Users(
        username=create_user_request.username,
        email=create_user_request.email,
        hashed_password=hashed_password,
        role=create_user_request.role,
    )

    db.add(create_user_model)
    db.commit()
    db.refresh(create_user_model)

    return {
        "message": "User created successfully",
        "user": {
            "id": create_user_model.id,
            "username": create_user_model.username,
            "email": create_user_model.email,
            "role": create_user_model.role,
            "unique_id": create_user_model.unique_id
        }
    }


# this is the route for login
@router.post("/login", response_model=Token)
async def login_for_access_token(login_request: UserLogin,
                                  db: db_dependency, response: Response):
    print("do pring statements not work over here")
    user = authenticate_user(login_request.username, login_request.password, db)
    print("we got an user here",user)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Could not validate user.")
    token = create_access_token(user.username, user.id, user.role, timedelta(minutes=20))

    response.set_cookie(key="clarix_token", value=token, httponly=True, max_age=1200, samesite="lax")

    return {
        'access_token': token,
        'token_type': 'bearer',
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role,
            'unique_id': user.unique_id,
            'is_active': user.is_active
        }
    }

# this is the route for gettin current user
@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'role': user.role,
        'unique_id': user.unique_id,
        'is_active': user.is_active
    }
