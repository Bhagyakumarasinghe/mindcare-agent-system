from fastapi import APIRouter, Depends, HTTPException, Header
from app.utils.jwt_handler import decode_access_token
from app.db.mongo import db
from bson import ObjectId

router = APIRouter(prefix="/auth", tags=["Protected"])

async def get_current_user(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = authorization.split(" ")[1]
    try:
        payload = decode_access_token(token)
        user_id = payload.get("user_id")
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return {"id": str(user["_id"]), "name": user["name"], "email": user["email"]}
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

@router.get("/protected")
async def protected_route(current_user: dict = Depends(get_current_user)):
    return {"message": f"Hello {current_user['name']}, this is a protected route!"}