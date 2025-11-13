from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from user_app.User_routes.Route_serv import

from Todos_app.Todo_service import TodoServer
from user_app.User_model import User
from user_app.user_service import UserServer
from Post_app.Post_service import PostServer
from Post_app.Post_modal import Post
from Todos_app.Todos_modal import Todo


app = FastAPI(title="User + Post + Todo API", version="3.0")

app.include_router(user_routes.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#user

users = [
    {
        "id": 1,
        "username": "Jonibek",
        "email": "jonibek@gmail.com",
        "phone_number": "+998901234567",
        "address": "Buxoro",
        "age": 25
    }
]

user_service = UserServer(users)

# post


post_service = PostServer()

# todos


todo_service = TodoServer()


#-----users-------
@app.get("/users")
async def get_users():
    return user_service.get_users()

@app.post("/users")
async def add_user(user: User):
    return user_service.add_user(user.dict())

@app.put("/users/{user_id}")
async def update_user(user_id: int, req_user: User):
    updated = user_service.update_user(user_id, req_user.dict())
    if updated:
        return updated
    raise HTTPException(status_code=404, detail="User not found")

@app.delete("/users/{user_id}")
async def delete_user(user_id: int):
    success = user_service.delete_user(user_id)
    if success:
        return {"message": "user deleted successfully"}
    raise HTTPException(status_code=404, detail="User not found")

@app.get("/users/age/count")
async def age_count():
    return {"total_age": user_service.total_age()}



# ---------- POSTS ----------
@app.get("/posts")
async def get_posts():
    return post_service.get_posts()

@app.post("/posts")
async def add_post(post: Post):
    return post_service.add_post(post.dict())

@app.put("/posts/{post_id}")
async def update_post(post_id: int, req_post: Post):
    updated = post_service.update_post(post_id, req_post.dict())
    if updated:
        return updated
    raise HTTPException(status_code=404, detail="Post not found")

@app.delete("/posts/{post_id}")
async def delete_post(post_id: int):
    success = post_service.delete_post(post_id)
    if success:
        return {"message": "post deleted successfully"}
    raise HTTPException(status_code=404, detail="Post not found")


# ---------- TODOS ----------
@app.get("/todos")
async def get_todos():
    return todo_service.get_todos()

@app.post("/todos")
async def add_todo(todo: Todo):
    return todo_service.add_todo(todo.dict())

@app.put("/todos/{todo_id}")
async def update_todo(todo_id: int, req_todo: Todo):
    updated = todo_service.update_todo(todo_id, req_todo.dict())
    if updated:
        return updated
    raise HTTPException(status_code=404, detail="Todo not found")

@app.delete("/todos/{todo_id}")
async def delete_todo(todo_id: int):
    success = todo_service.delete_todo(todo_id)
    if success:
        return {"message": "todo deleted successfully"}
    raise HTTPException(status_code=404, detail="Todo not found")
