from pydantic import BaseModel, EmailStr, constr
from typing import Optional


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