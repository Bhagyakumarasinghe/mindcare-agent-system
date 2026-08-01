import os
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from app.db.mongo import db
from app.routers.protected_routes import get_current_user
from bson import ObjectId
from datetime import datetime
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

# Agents සහ Services import කිරීම
from app.services.orchestrator import route_user_intent
from app.services.assessment_agent import get_next_question
from app.services.therapy_agent import get_therapy_response
from app.db.neo4j import get_user_insights, save_mood_entry_to_graph # <-- අලුතින් save_mood_entry_to_graph එකතු කළා
from app.services.analytics_agent import get_user_mental_health_summary 
from app.schemas.user_schema import MoodEntryRequest # <-- අලුතින් MoodEntryRequest එකතු කළා

router = APIRouter(prefix="/user", tags=["User Profile & AI Chat"])

# --- Pydantic Models ---
class ChatRequest(BaseModel):
    message: Optional[str] = "" 
    history: Optional[List[Dict[str, str]]] = []

class AssessmentRequest(BaseModel):
    history: List[Dict[str, Any]]

class ProfileUpdate(BaseModel):
    name: str

# --- 1. Export Data Endpoint ---
@router.get("/export")
async def export_user_data(current_user: dict = Depends(get_current_user)):
    try:
        user_id = str(current_user["id"])
        analytics_data = get_user_mental_health_summary(user_id)
        if not analytics_data:
            analytics_data = {
                "history": [], 
                "avg_sleep": 0, 
                "avg_stress": 0, 
                "message": "No data recorded yet."
            }
        return {
            "status": "success", 
            "user_id": user_id, 
            "export_date": datetime.now().strftime("%Y-%m-%d"), 
            "data": analytics_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- 2. User Analytics Endpoint ---
@router.get("/analytics")
async def get_user_analytics(current_user: dict = Depends(get_current_user)):
    try:
        user_id = str(current_user["id"])
        analytics_data = get_user_mental_health_summary(user_id)
        return {
            "status": "success", 
            "user_id": user_id, 
            "generated_at": datetime.now().isoformat(), 
            "data": analytics_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- 3. Profile Endpoints ---
@router.get("/me")
async def get_profile(current_user: dict = Depends(get_current_user)):
    try:
        user = await db.users.find_one({"_id": ObjectId(current_user["id"])})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        insights = get_user_insights(current_user["id"])
        
        return {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "days_active": user.get("days_active", 1),
            "entries_count": user.get("entries_count", 0),
            "insights": insights 
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- 4. Update Profile ---
@router.put("/update")
async def update_profile(data: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    try:
        user_id = ObjectId(current_user["id"])
        result = await db.users.update_one(
            {"_id": user_id}, 
            {"$set": {"name": data.name.strip()}}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User record not found")
        return {
            "status": "success", 
            "message": "Profile updated successfully",
            "updated_name": data.name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")

# --- 5. Logout Endpoint ---
@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    return {"status": "success", "message": "Logged out successfully"}

# --- 6. Separate Assessment Endpoint ---
@router.post("/assessment/next-question")
async def assessment_handler(data: AssessmentRequest, current_user: dict = Depends(get_current_user)):
    """
    ප්‍රශ්න 5ක් අහන Adaptive Assessment එක සඳහා පමණක් වෙන්වූ Endpoint එක.
    """
    user_id = str(current_user["id"])
    try:
        # කෙලින්ම Assessment Agent එක call කිරීම
        reply = get_next_question(user_id, data.history)
        return {
            "status": "success", 
            "question": reply.get("question")
        }
    except Exception as e:
        print(f"❌ Assessment API error: {e}")
        raise HTTPException(status_code=500, detail="Assessment failed")

# --- 7. Pure AI Chat Endpoint ---
@router.post("/chat")
async def ai_chat_handler(data: ChatRequest, current_user: dict = Depends(get_current_user)):
    """
    සාමාන්‍ය Therapy Chat එක සඳහා පමණක් පාවිච්චි වේ.
    """
    user_id = str(current_user["id"]) 
    user_message = data.message or ""
    
    try:
        # මෙතනින් Assessment logic එක ඉවත් කර Therapy Agent එකට පමණක් යොමු කෙරේ
        reply = get_therapy_response(user_id, user_message)
            
        return {
            "status": "success", 
            "intent": "THERAPY", 
            "reply": reply
        }
    except Exception as e:
        print(f"❌ Chat Agent error: {e}")
        raise HTTPException(status_code=500, detail="AI Chat failed")   

# --- 8. NEW: Mood Tracking Endpoint ---
@router.post("/mood-log")
async def log_user_mood(data: MoodEntryRequest, current_user: dict = Depends(get_current_user)):
    """ඇප් එකේ සිට එන දිනපතා මූඩ් සහ ස්ට්‍රෙස් දත්ත MongoDB සහ Neo4j වෙත සේව් කිරීම."""
    try:
        user_id = str(current_user["id"])
        
        # 1. MongoDB එකේ සම්පූර්ණ හිස්ට්‍රි එක ලොග් කිරීම
        mood_log_entry = {
            "user_id": user_id,
            "timestamp": datetime.utcnow(),
            "mood": data.mood,
            "stress_level": data.stress_level,
            "activities": data.activities,
            "stress_factor": data.stress_factor,
            "sleep_hours": data.sleep_hours,
            "note": data.note
        }
        await db.mood_logs.insert_one(mood_log_entry)
        
        # 2. Neo4j Graph එක අප්ඩේට් කිරීම (Analytics සඳහා)
        save_mood_entry_to_graph(
            user_id=user_id,
            mood=data.mood,
            stress=data.stress_level,
            sleep=data.sleep_hours
        )
        
        return {"status": "success", "message": "Mood entry logged successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))