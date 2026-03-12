from fastapi import APIRouter, Depends, HTTPException, status
from app.db.mongo import db
from app.routers.protected_routes import get_current_user
from bson import ObjectId
from datetime import datetime
from pydantic import BaseModel

router = APIRouter(prefix="/user", tags=["User Profile"])

# Update දත්ත ලැබෙන ආකාරය පාලනය කිරීමට Schema එකක්
class ProfileUpdate(BaseModel):
    name: str

# ✅ 1. Get logged user profile
@router.get("/me")
async def get_profile(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"_id": ObjectId(current_user["id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "notifications_enabled": user.get("notifications_enabled", True)
    }

# ✅ 2. Update User Profile Name (අලුතින් එක් කළා)
@router.put("/update")
async def update_profile(data: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    result = await db.users.update_one(
        {"_id": ObjectId(current_user["id"])},
        {"$set": {"name": data.name}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"message": "Profile updated successfully", "name": data.name}

# ✅ 3. Update Notifications Preference
@router.put("/update-notifications")
async def update_notifications(enabled: bool, current_user: dict = Depends(get_current_user)):
    result = await db.users.update_one(
        {"_id": ObjectId(current_user["id"])},
        {"$set": {"notifications_enabled": enabled}}
    )
    if result.modified_count == 0:
         return {"message": "Notification preference remains the same"}
    return {"message": "Notification preference updated successfully"}

# ✅ 4. Export User Data (PDF එකට අවශ්‍ය Payload එක)
@router.get("/export")
async def export_data(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"_id": ObjectId(current_user["id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "title": "MindCare Personal Health Report",
        "generated_at": datetime.now().strftime("%Y-%m-%d"),
        "user_details": {
            "name": user.get("name", "User"),
            "email": user.get("email")
        },
        "summary": "Your stress level data and activity logs are being analyzed by MindCare AI. Current patterns suggest maintaining your mindfulness routine."
    }

# ✅ 5. Logout User
@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    return {"message": "Logged out successfully"}

# ✅ 6. Delete Account
@router.delete("/delete")
async def delete_user(current_user: dict = Depends(get_current_user)):
    result = await db.users.delete_one({"_id": ObjectId(current_user["id"])})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found or already deleted")
    return {"message": "User account and all data deleted successfully"}