from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Optional
from app.utils.jwt_handler import decode_access_token
from app.db.mongo import db
from bson import ObjectId

router = APIRouter(prefix="/auth", tags=["Protected"])

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.split(" ")[1]
    try:
        payload = decode_access_token(token)
        user_id = payload.get("user_id")
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            user = await db.users.find_one({"id": str(user_id)})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return {"id": str(user["_id"]), "name": user.get("name", "Student"), "email": user.get("email", "")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

async def get_current_user_flexible(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """Resolves authenticated user if Bearer token is provided, or returns None without throwing 401."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    try:
        payload = decode_access_token(token)
        user_id = payload.get("user_id")
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            user = await db.users.find_one({"id": str(user_id)})
        if user:
            return {"id": str(user["_id"]), "name": user.get("name", "Student"), "email": user.get("email", "")}
    except Exception:
        pass
    return None

@router.get("/protected")
async def protected_route(current_user: dict = Depends(get_current_user)):
    return {"message": f"Hello {current_user['name']}, this is a protected route!"}