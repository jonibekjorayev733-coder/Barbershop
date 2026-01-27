from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import schemas
from app.crud_users import create_user, list_users, update_user, delete_user

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("/", response_model=schemas.UserResponse)
def create(user: schemas.UserCreate, db: Session = Depends(get_db)):
    result = create_user(db, user)
    if result["ok"]:
        return result["data"]
    if result["error"] == "EMAIL_EXISTS":
        raise HTTPException(status_code=400, detail="Email band (mavjud)")
    if result["error"] == "USERNAME_EXISTS":
        raise HTTPException(status_code=400, detail="Username band (mavjud)")
    raise HTTPException(status_code=400, detail="Duplicate yoki DB xato")


@router.get("/", response_model=list[schemas.UserResponse])
def list_all(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return list_users(db, skip=skip, limit=limit)


@router.put("/{user_id}", response_model=schemas.UserResponse)
def update(user_id: int, user: schemas.UserUpdate, db: Session = Depends(get_db)):
    result = update_user(db, user_id, user)
    if result["ok"]:
        return result["data"]
    if result["error"] == "NOT_FOUND":
        raise HTTPException(status_code=404, detail="User topilmadi")
    if result["error"] == "EMAIL_EXISTS":
        raise HTTPException(status_code=400, detail="Email band (mavjud)")
    if result["error"] == "USERNAME_EXISTS":
        raise HTTPException(status_code=400, detail="Username band (mavjud)")
    raise HTTPException(status_code=400, detail="Duplicate yoki DB xato")


@router.delete("/{user_id}")
def delete(user_id: int, db: Session = Depends(get_db)):
    result = delete_user(db, user_id)
    if not result["ok"]:
        raise HTTPException(status_code=404, detail="User topilmadi")
    return {"message": "User deleted"}
