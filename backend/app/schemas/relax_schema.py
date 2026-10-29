from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class JournalCreateSchema(BaseModel):
    content: str = Field(..., min_length=1, description="Journal content text")
    date: Optional[str] = Field(default_factory=lambda: datetime.utcnow().isoformat())
    emotion: Optional[str] = Field(default="Reflective", description="Emotion or mood tag")

class ActivityLogSchema(BaseModel):
    activity_type: str = Field(..., description="breathing, focus_timer, meditation")
    duration_minutes: int = Field(default=5)
    timestamp: Optional[str] = Field(default_factory=lambda: datetime.utcnow().isoformat())