from datetime import timedelta, datetime
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from Backend import models
from starlette import status
from Backend.Database import SessionLocal
from Backend.models import Users
import bcrypt
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from jose import jwt, JWTError
from fastapi import Request, Response

router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)

SECRET_KEY = "342e8he8eenu32329h293he293e23ec2ec98uc93h49cbf984arqy8940vryq34r"
ALGORITHM = "HS256"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token" )

class UserCreate(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str


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
        # Check Authorization header if cookie is missing
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

def authenticate_user(username: str, password: str, db: Session):
    user = db.query(Users).filter(Users.username == username).first()
    if not user:
        return False
    if not bcrypt.checkpw(password.encode('utf-8'), user.hashed_password.encode('utf-8')):
        return False
    return user

def create_access_token(username: str, user_id: int, expires_delta: timedelta):
    encode = {'sub': username, 'id': user_id}
    expires = datetime.utcnow() + expires_delta
    encode.update({'exp': expires})
    return jwt.encode(encode, SECRET_KEY, algorithm=ALGORITHM)

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_user(db: db_dependency, create_user_request: UserCreate):
    hashed_password = bcrypt.hashpw(create_user_request.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    create_user_model = Users(
        username=create_user_request.username,
        hashed_password=hashed_password,
    )

    db.add(create_user_model)
    db.commit()
    return {"message": "User created successfully"}

@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
                                  db: db_dependency, response: Response):
    user = authenticate_user(form_data.username, form_data.password, db)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Could not validate user.")
    token = create_access_token(user.username, user.id, timedelta(minutes=20))
    
    # Set the token in a cookie for browser navigation
    response.set_cookie(key="clarix_token", value=token, httponly=True, max_age=1200, samesite="lax")

    return {'access_token': token, 'token_type': 'bearer'}