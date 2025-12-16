from fastapi import FastAPI
from routers.car_router import router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Cars API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/")
def root():
    return {"message": "Cars API running"}
