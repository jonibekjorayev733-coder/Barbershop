from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.api.users import router as users_router
from app.api.posts import router as posts_router
from app.api.auth import router as auth_router

# tables auto-create (development uchun)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="ORM Project")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(posts_router)
