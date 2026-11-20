from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Optional, Any

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
    user_id: Optional[str] = "demo_user"
    mood: str = "Okay"                              # e.g., "Okay", "Great", "Bad"
    mood_score: Optional[float] = 3.0
    emotion_tags: Optional[List[str]] = Field(default_factory=list)
    energy_level: Optional[str] = "Steady"          # "Drained" | "Steady" | "Energized"
    stress_score: Optional[float] = None            # Numeric stress (e.g. 2.0, 3.5, 5.0, 7.5, 9.0)
    stress_level: Optional[float] = None            # Backwards compatibility
    activities: Optional[List[str]] = Field(default_factory=list)
    stress_factors: Optional[List[str]] = Field(default_factory=list)
    stress_factor: Optional[str] = "None"
    sleep_hours: Optional[float] = 7.0              # Default to 7.0 if omitted
    journal_note: Optional[str] = ""
    note: Optional[str] = ""                        # Backwards compatibility
    notes: Optional[str] = ""                       # Backwards compatibility (plural)

    @field_validator('sleep_hours', mode='before')
    @classmethod
    def parse_sleep_hours(cls, v: Any) -> float:
        if v is None or v == '':
            return 7.0
        try:
            return round(float(v), 1)
        except (ValueError, TypeError):
            return 7.0

    @field_validator('stress_score', 'stress_level', mode='before')
    @classmethod
    def parse_stress(cls, v: Any) -> Optional[float]:
        if v is None or v == '':
            return None
        try:
            return round(float(v), 1)
        except (ValueError, TypeError):
            return None

    @field_validator('mood_score', mode='before')
    @classmethod
    def parse_mood_score(cls, v: Any) -> Optional[float]:
        if v is None or v == '':
            return 3.0
        try:
            return round(float(v), 1)
        except (ValueError, TypeError):
            return 3.0

    @field_validator('emotion_tags', 'activities', 'stress_factors', mode='before')
    @classmethod
    def parse_list(cls, v: Any) -> List[str]:
        if v is None:
            return []
        if isinstance(v, list):
            return [str(x) for x in v if str(x).strip()]
        if isinstance(v, str):
            return [s.strip() for s in v.split(',') if s.strip()]
        return []

    @field_validator('journal_note', 'note', 'notes', 'stress_factor', 'energy_level', 'user_id', mode='before')
    @classmethod
    def parse_str(cls, v: Any) -> str:
        if v is None:
            return ''
        return str(v).strip()
