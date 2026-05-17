from fastapi import APIRouter

from app.api.v1 import (
    admin,
    exports,
    intake,
    notes,
    queue,
    reminders,
    stats,
    transcripts,
    vitals,
)

api_router = APIRouter(prefix="/api")
api_router.include_router(queue.router, tags=["queue"])
api_router.include_router(admin.router, tags=["admin"])
api_router.include_router(intake.router, tags=["intake"])
api_router.include_router(reminders.router, tags=["reminders"])
api_router.include_router(transcripts.router, tags=["transcripts"])
api_router.include_router(notes.router, tags=["notes"])
api_router.include_router(stats.router, tags=["stats"])
api_router.include_router(vitals.router, tags=["vitals"])
api_router.include_router(exports.router, tags=["exports"])
