from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from psycopg2.errors import UniqueViolation

from app import models, schemas
from app.core.security import hash_password


def create_user(db: Session, user: schemas.UserCreate):
    db_user = models.User(
        email=user.email,
        username=user.username,
        hashed_password=hash_password(user.password)
    )

    db.add(db_user)

    try:
        db.commit()
        db.refresh(db_user)
        return {"ok": True, "data": db_user}

    except IntegrityError as e:
        db.rollback()

        if isinstance(getattr(e, "orig", None), UniqueViolation):
            msg = str(e.orig)

            if "users_email_key" in msg or "(email)=" in msg:
                return {"ok": False, "error": "EMAIL_EXISTS"}
            if "users_username_key" in msg or "(username)=" in msg:
                return {"ok": False, "error": "USERNAME_EXISTS"}

            return {"ok": False, "error": "DUPLICATE"}

        return {"ok": False, "error": "DB_ERROR"}


def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()


def update_user(db: Session, user_id: int, user: schemas.UserUpdate):
    db_user = get_user(db, user_id)
    if not db_user:
        return {"ok": False, "error": "NOT_FOUND"}

    data = user.model_dump(exclude_unset=True)


    if "password" in data:
        db_user.hashed_password = hash_password(data["password"])
        del data["password"]

    for key, value in data.items():
        setattr(db_user, key, value)

    try:
        db.commit()
        db.refresh(db_user)
        return {"ok": True, "data": db_user}

    except IntegrityError as e:
        db.rollback()

        if isinstance(getattr(e, "orig", None), UniqueViolation):
            msg = str(e.orig)

            if "users_email_key" in msg or "(email)=" in msg:
                return {"ok": False, "error": "EMAIL_EXISTS"}
            if "users_username_key" in msg or "(username)=" in msg:
                return {"ok": False, "error": "USERNAME_EXISTS"}

            return {"ok": False, "error": "DUPLICATE"}

        return {"ok": False, "error": "DB_ERROR"}


def delete_user(db: Session, user_id: int):
    db_user = get_user(db, user_id)
    if not db_user:
        return {"ok": False, "error": "NOT_FOUND"}

    db.delete(db_user)
    db.commit()
    return {"ok": True}
