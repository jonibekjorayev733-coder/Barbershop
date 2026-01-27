from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app import models, schemas
from app.core.security import hash_password, verify_password


def create_user(db: Session, user: schemas.UserCreate):
    db_user = models.User(
        email=user.email,
        username=user.username,
        hashed_password=hash_password(user.password),
    )
    db.add(db_user)
    try:
        db.commit()
        db.refresh(db_user)
        return {"ok": True, "data": db_user}
    except IntegrityError as e:
        db.rollback()
        error_msg = str(e.orig).lower()
        if "email" in error_msg:
            return {"ok": False, "error": "EMAIL_EXISTS"}
        if "username" in error_msg:
            return {"ok": False, "error": "USERNAME_EXISTS"}
        return {"ok": False, "error": "DB_ERROR"}


def list_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.User).offset(skip).limit(limit).all()


def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()


def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def update_user(db: Session, user_id: int, user: schemas.UserUpdate):
    db_user = get_user(db, user_id)
    if not db_user:
        return {"ok": False, "error": "NOT_FOUND"}

    data = user.model_dump(exclude_unset=True)

    if "password" in data and data["password"] is not None:
        db_user.hashed_password = hash_password(data["password"])
        data.pop("password")

    for k, v in data.items():
        setattr(db_user, k, v)

    try:
        db.commit()
        db.refresh(db_user)
        return {"ok": True, "data": db_user}
    except IntegrityError as e:
        db.rollback()
        error_msg = str(e.orig).lower()
        if "email" in error_msg:
            return {"ok": False, "error": "EMAIL_EXISTS"}
        if "username" in error_msg:
            return {"ok": False, "error": "USERNAME_EXISTS"}
        return {"ok": False, "error": "DB_ERROR"}


def delete_user(db: Session, user_id: int):
    db_user = get_user(db, user_id)
    if not db_user:
        return {"ok": False, "error": "NOT_FOUND"}
    db.delete(db_user)
    db.commit()
    return {"ok": True}
