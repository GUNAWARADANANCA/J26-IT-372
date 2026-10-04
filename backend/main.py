"""PostAssist API. The MongoDB client lives in db.py."""

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from db import connect, disconnect, get_db  # noqa: E402
from routes import router  # noqa: E402


@asynccontextmanager
async def lifespan(_app: FastAPI):
    connect()
    yield
    disconnect()


app = FastAPI(title="PostAssist", lifespan=lifespan)
app.include_router(router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"ok": True, "health": "/health", "docs": "/docs"}


@app.get("/health")
def health():
    db = get_db()
    return {"ok": True, "database": db.name}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=int(os.environ.get("PORT", "8000")),
        reload=True,
    )
