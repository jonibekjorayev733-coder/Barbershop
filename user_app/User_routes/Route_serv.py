from fastapi import APIRouter, HTTPException
from models import User
from services import user_service

router = APIRouter()

@router.put("/users/{user_id}")
async def update_user(user_id: int, req_user: User):
    updated = user_service.update_user(user_id, req_user.dict())
    if updated:
        return updated
    raise HTTPException(status_code=404, detail="User not found")
