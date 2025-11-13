from pydantic import BaseModel, EmailStr, Field

class Todo(BaseModel):
    task: str
    completed: bool = False
    user_id: int