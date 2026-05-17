from fastapi import APIRouter

from app.api.v1 import admin, intake, queue, reminders, transcripts

api_router = APIRouter(prefix="/api")
api_router.include_router(queue.router, tags=["queue"])
api_router.include_router(admin.router, tags=["admin"])
api_router.include_router(intake.router, tags=["intake"])
api_router.include_router(reminders.router, tags=["reminders"])
api_router.include_router(transcripts.router, tags=["transcripts"])
