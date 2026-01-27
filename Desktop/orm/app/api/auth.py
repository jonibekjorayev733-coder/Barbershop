from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import TokenResponse, UserResponse
from app.crud_users import get_user_by_email
from app.core.security import verify_password
from app.models import User
from app.config import ADMIN_EMAIL, ADMIN_PASSWORD
import os
from datetime import datetime, timedelta

router = APIRouter(prefix="/auth", tags=["Auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# Session storage (backend'da saqlanadi)
sessions = {}


# Simple token format for demo: "user_id:<id>"
def make_token(user_id: int, is_admin: int = 0) -> str:
    token = f"user_id:{user_id}:admin:{is_admin}"
    sessions[token] = {
        "user_id": user_id,
        "is_admin": is_admin,
        "created_at": datetime.now(),
        "expires_at": datetime.now() + timedelta(hours=24)
    }
    return token


def parse_token(token: str):
    # Session'dan tekshirish
    if token in sessions:
        session = sessions[token]
        if datetime.now() < session["expires_at"]:
            return session["user_id"], session.get("is_admin", 0)
        else:
            del sessions[token]
            return None, None

    # Legacy format
    if token.startswith("user_id:"):
        try:
            parts = token.split(":")
            user_id = int(parts[1])
            is_admin = int(parts[3]) if len(parts) > 3 else 0
            return user_id, is_admin
        except:
            return None, None
    return None, None


@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Check if admin credentials
    if form_data.username == ADMIN_EMAIL and form_data.password == ADMIN_PASSWORD:
        # Admin login - find or create admin user
        admin_user = db.query(User).filter_by(email=ADMIN_EMAIL).first()
        if not admin_user:
            from app.core.security import hash_password
            admin_user = User(
                email=ADMIN_EMAIL,
                username="admin",
                hashed_password=hash_password(ADMIN_PASSWORD),
                is_admin=1
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)

        return {"access_token": make_token(admin_user.id, 1), "token_type": "bearer"}

    # Regular user check (email bo'lsa ham, parol bo'lsa ham admin emailga teng bo'lmasin)
    user = get_user_by_email(db, form_data.username)
    if not user:
        raise HTTPException(status_code=401, detail="Email yoki parol xato")
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email yoki parol xato")

    return {"access_token": make_token(user.id, user.is_admin), "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def me(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user_id, is_admin = parse_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Token xato")

    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User topilmadi")

    # Update user's is_admin from token
    if is_admin and not user.is_admin:
        user.is_admin = 1
        db.commit()

    return user


@router.post("/logout")
def logout(token: str = Depends(oauth2_scheme)):
    if token in sessions:
        del sessions[token]
    return {"message": "Logout muvaffaqiyatli"}
