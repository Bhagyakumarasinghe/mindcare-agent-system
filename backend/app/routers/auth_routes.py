from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta

from app.schemas.user_schema import UserCreate, UserLogin, UserOut
from app.db.mongo import db
from app.utils.security import hash_password, verify_password
from app.utils.jwt_handler import create_access_token
from app.utils.otp import generate_otp

router = APIRouter(prefix="/auth", tags=["Authentication"])


# -----------------------------
# Register User
# -----------------------------
@router.post("/register", response_model=UserOut)
async def register(user: UserCreate):

    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed = hash_password(user.password)

    user_dict = user.dict()
    user_dict["password"] = hashed

    result = await db.users.insert_one(user_dict)

    return UserOut(
        id=str(result.inserted_id),
        name=user.name,
        email=user.email
    )


# -----------------------------
# Login User (Generate JWT)
# -----------------------------
@router.post("/login")
async def login(user: UserLogin):

    db_user = await db.users.find_one({"email": user.email})

    if not db_user:
        raise HTTPException(status_code=400, detail="Invalid credentials")

    if not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    token = create_access_token({"user_id": str(db_user["_id"])})

    return {
        "access_token": token,
        "token_type": "bearer"
    }


# -----------------------------
# Send OTP
# -----------------------------
@router.post("/send-otp")
async def send_otp(email: str):

    user = await db.users.find_one({"email": email})

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    otp = generate_otp()

    expire_time = datetime.utcnow() + timedelta(minutes=5)

    await db.otp_codes.insert_one({
        "email": email,
        "otp": otp,
        "expires_at": expire_time
    })

    # For testing (console)
    print("OTP:", otp)

    return {"message": "OTP sent successfully"}


# -----------------------------
# Verify OTP
# -----------------------------
@router.post("/verify-otp")
async def verify_otp(email: str, otp: str):

    record = await db.otp_codes.find_one({
        "email": email,
        "otp": otp
    })

    if not record:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    if record["expires_at"] < datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP expired")

    await db.otp_codes.delete_one({"_id": record["_id"]})

    return {"message": "OTP verified successfully"}