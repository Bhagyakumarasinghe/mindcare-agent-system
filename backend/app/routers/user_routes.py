from fastapi import APIRouter, Depends, HTTPException
from app.db.mongo import db
from app.routers.protected_routes import get_current_user
from app.schemas.user_schema import UserUpdate
from bson import ObjectId

router = APIRouter(prefix="/user", tags=["User Profile"])


# Get logged user profile
@router.get("/me")
async def get_profile(current_user: dict = Depends(get_current_user)):

    user = await db.users.find_one({"_id": ObjectId(current_user["id"])})

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"]
    }


# Update profile
@router.put("/update")
async def update_profile(
    user_update: UserUpdate,
    current_user: dict = Depends(get_current_user)
):

    update_data = {k: v for k, v in user_update.dict().items() if v is not None}

    if not update_data:
        raise HTTPException(status_code=400, detail="No data provided")

    await db.users.update_one(
        {"_id": ObjectId(current_user["id"])},
        {"$set": update_data}
    )

    return {"message": "Profile updated successfully"}


# Delete user
@router.delete("/delete")
async def delete_user(current_user: dict = Depends(get_current_user)):

    await db.users.delete_one({"_id": ObjectId(current_user["id"])})

    return {"message": "User deleted successfully"}