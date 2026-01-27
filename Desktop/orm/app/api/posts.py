from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app import schemas
from app.crud_posts import create_post, list_posts, get_post, update_post, delete_post

router = APIRouter(prefix="/posts", tags=["Posts"])


@router.post("/", response_model=schemas.PostResponse)
def create(post: schemas.PostCreate, owner_id: int = Query(1), db: Session = Depends(get_db)):
    result = create_post(db, owner_id=owner_id, post=post)
    if result["ok"]:
        return result["data"]
    if result["error"] == "OWNER_NOT_FOUND":
        raise HTTPException(status_code=404, detail="Owner (user) topilmadi")
    raise HTTPException(status_code=400, detail="Xato")


@router.get("/", response_model=list[schemas.PostResponse])
def list_all(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return list_posts(db, skip=skip, limit=limit)


@router.get("/{post_id}", response_model=schemas.PostResponse)
def get_one(post_id: int, db: Session = Depends(get_db)):
    post = get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post topilmadi")
    return post


@router.put("/{post_id}", response_model=schemas.PostResponse)
def update(post_id: int, post: schemas.PostUpdate, db: Session = Depends(get_db)):
    result = update_post(db, post_id, post)
    if result["ok"]:
        return result["data"]
    raise HTTPException(status_code=404, detail="Post topilmadi")


@router.delete("/{post_id}")
def delete(post_id: int, db: Session = Depends(get_db)):
    result = delete_post(db, post_id)
    if not result["ok"]:
        raise HTTPException(status_code=404, detail="Post topilmadi")
    return {"message": "Post deleted"}
