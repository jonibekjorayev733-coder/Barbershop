from sqlalchemy.orm import Session
from app import models, schemas


def create_post(db: Session, owner_id: int, post: schemas.PostCreate):
    owner = db.query(models.User).filter(models.User.id == owner_id).first()
    if not owner:
        return {"ok": False, "error": "OWNER_NOT_FOUND"}

    db_post = models.Post(title=post.title, content=post.content, owner_id=owner_id)
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    return {"ok": True, "data": db_post}


def list_posts(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Post).offset(skip).limit(limit).all()


def get_post(db: Session, post_id: int):
    return db.query(models.Post).filter(models.Post.id == post_id).first()


def update_post(db: Session, post_id: int, post: schemas.PostUpdate):
    db_post = get_post(db, post_id)
    if not db_post:
        return {"ok": False, "error": "NOT_FOUND"}

    for k, v in post.model_dump(exclude_unset=True).items():
        setattr(db_post, k, v)

    db.commit()
    db.refresh(db_post)
    return {"ok": True, "data": db_post}


def delete_post(db: Session, post_id: int):
    db_post = get_post(db, post_id)
    if not db_post:
        return {"ok": False, "error": "NOT_FOUND"}
    db.delete(db_post)
    db.commit()
    return {"ok": True}
