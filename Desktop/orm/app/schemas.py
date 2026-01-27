from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

# -------- USERS --------
class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: str
    password: str = Field(min_length=8, max_length=200)


class UserUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=50)
    email: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=200)


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_admin: int = 0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# -------- POSTS --------
class PostCreate(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    content: str = Field(min_length=1, max_length=5000)


class PostUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=120)
    content: Optional[str] = Field(default=None, min_length=1, max_length=5000)


class PostResponse(BaseModel):
    id: int
    title: str
    content: str
    owner_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# -------- AUTH --------
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
