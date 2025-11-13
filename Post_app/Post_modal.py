from pydantic import BaseModel, EmailStr, Field


class Post(BaseModel):
    title: str = Field(..., min_length=3, max_length=20)
    body: str
    author_id: int



