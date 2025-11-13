from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field

class User(BaseModel):
    username: str = Field(..., min_length=3, max_length=20)
    email: EmailStr
    phone_number: str = Field(..., pattern=r"^\+998\d{9}$")
    address: Optional[str] = None
    age: int = Field(..., ge=0, le=120)
