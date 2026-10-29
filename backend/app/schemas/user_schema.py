from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)

class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None

class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr

# --- MOOD TRACKING SCHEMA ---
class MoodEntryRequest(BaseModel):
    mood: str                                       # e.g., "Okay", "Great", "Bad"
    stress_score: Optional[int] = Field(None, ge=1, le=10) # 1-10 slider scale
    stress_level: Optional[int] = Field(None, ge=1, le=10) # Backwards compatibility
    activities: List[str] = []                      # e.g., ["Exercise", "Reading"]
    stress_factor: Optional[str] = "None"
    sleep_hours: float
    journal_note: Optional[str] = ""
    note: Optional[str] = ""                        # Backwards compatibility