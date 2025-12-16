from pydantic import BaseModel
from typing import Optional

class CarCreate(BaseModel):
    model: str
    year: int
    color: str
    details: Optional[str] = None  # majburiy emas
