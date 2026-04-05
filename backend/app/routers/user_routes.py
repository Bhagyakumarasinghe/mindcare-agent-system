from fastapi import APIRouter, Depends, HTTPException, status, Body
from app.db.mongo import db
from app.routers.protected_routes import get_current_user
from app.services.assessment_agent import get_next_question # Assessment Agent එක import කිරීම
from bson import ObjectId
from datetime import datetime
from pydantic import BaseModel
from typing import List, Dict, Any

router = APIRouter(prefix="/user", tags=["User Profile & Assessment"])

# --- Schemas ---

class ProfileUpdate(BaseModel):
    name: str

class AssessmentRequest(BaseModel):
    history: List[Dict[str, str]] = [] # [{"question": "...", "answer": "..."}]

# --- Profile Endpoints ---

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

# ✅ 2. Update User Profile Name
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
    return {"message": "Notification preference updated successfully"}

# --- Adaptive Assessment Endpoint ---

# ✅ 4. Get Next Assessment Question (Adaptive Agent)
@router.post("/assessment/next-question")
async def assessment_chat(
    data: AssessmentRequest, 
    current_user: dict = Depends(get_current_user)
):
    """
    Frontend එකෙන් එවන history එක අනුව ඊළඟ ප්‍රශ්නය AI එකෙන් ලබා දෙයි.
    AI එක Assessment එක අවසන් කළ විට ස්වයංක්‍රීයව Neo4j වෙත දත්ත යවයි.
    """
    # 1. දැනට ලොග් වී සිටින පරිශීලකයාගේ ID එක ලබා ගැනීම
    user_id = current_user["id"] 
    
    # 2. get_next_question function එකට user_id සහ history ලබා දීම
    # (දැන් මෙය arguments දෙකක් බලාපොරොත්තු වෙයි)
    next_q = get_next_question(user_id, data.history)
    
    return {
        "user_id": user_id,
        "question": next_q
    }

# --- Other Profile Actions ---

# ✅ 5. Export User Data
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
        "summary": "Your stress level data and activity logs are being analyzed by MindCare AI."
    }

# ✅ 6. Logout User
@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    return {"message": "Logged out successfully"}

# ✅ 7. Delete Account
@router.delete("/delete")
async def delete_user(current_user: dict = Depends(get_current_user)):
    result = await db.users.delete_one({"_id": ObjectId(current_user["id"])})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User account and all data deleted successfully"}