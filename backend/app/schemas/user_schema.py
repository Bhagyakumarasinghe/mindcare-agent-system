from pydantic import BaseModel, EmailStr, constr, Field
from typing import List, Optional

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: constr(min_length=8, max_length=72)

class UserLogin(BaseModel):
    email: EmailStr
    password: constr(min_length=8, max_length=72)

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None

class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr

# --- MOOD TRACKING SCHEMA ---
class MoodEntryRequest(BaseModel):
    mood: str                       # e.g., "Okay", "Great", "Bad"
    stress_level: int = Field(..., ge=1, le=10) # 1-10 slider එක
    activities: List[str]           # e.g., ["Exercise", "Reading"]
    stress_factor: Optional[str] = ""
    sleep_hours: float
    note: Optional[str] = ""