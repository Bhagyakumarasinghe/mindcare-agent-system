from fastapi import APIRouter, Depends, HTTPException, status
from app.db.mongo import db
from app.routers.protected_routes import get_current_user
from app.schemas.user_schema import UserUpdate
from bson import ObjectId

router = APIRouter(prefix="/user", tags=["User Profile"])

# ✅ 1. Get logged user profile (සමඟ notification status එකත් ලබා දීම)
@router.get("/me")
async def get_profile(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"_id": ObjectId(current_user["id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "notifications_enabled": user.get("notifications_enabled", True) # Default True
    }

# ✅ 2. Update Notifications Preference (අලුතින් එක් කළා)
@router.put("/update-notifications")
async def update_notifications(enabled: bool, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"_id": ObjectId(current_user["id"])},
        {"$set": {"notifications_enabled": enabled}}
    )
    return {"message": "Notification preference updated"}

# ✅ 3. Export User Data (ලස්සන Payload එකක් සමඟ)
@router.get("/export")
async def export_data(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"_id": ObjectId(current_user["id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "title": "MindCare Personal Health Report",
        "generated_at": "2026-03-11",
        "user_details": {
            "name": user["name"],
            "email": user["email"]
        },
        "summary": "Your stress level data and activity logs are being processed."
    }

# ... (Logout සහ Delete functions කලින් පරිදිම පවතී)
@router.post("/logout")
async def logout():
    return {"message": "Logged out successfully"}

@router.delete("/delete")
async def delete_user(current_user: dict = Depends(get_current_user)):
    await db.users.delete_one({"_id": ObjectId(current_user["id"])})
    return {"message": "User deleted successfully"}