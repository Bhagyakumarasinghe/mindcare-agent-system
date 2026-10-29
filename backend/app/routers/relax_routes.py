import datetime
import random
from fastapi import APIRouter, Depends, HTTPException, status

from app.db.mongo import db as mongo_db
from app.db.neo4j import save_journal_to_graph
from app.schemas.relax_schema import ActivityLogSchema, JournalCreateSchema

# --- AUTH DEPENDENCY ---
from app.routers.protected_routes import get_current_user

router = APIRouter(prefix="/user", tags=["Relaxation & Tools"])


# 1. Daily Tip Endpoint
@router.get("/daily-tip")
async def get_daily_tip():
    tips = [
        "Taking just 5 minutes for mindful breathing can significantly reduce stress.",
        "Break your tasks into 25-minute Pomodoro sessions to avoid burnout.",
        "Writing down your worries in a journal helps clear cognitive load.",
        "A short 5-minute meditation restores focus and reduces mental fatigue.",
    ]
    selected_tip = random.choice(tips)
    print(f"💡 Daily Tip Served: {selected_tip}")
    return {"status": "success", "tip": selected_tip}


# 2. Save Journal Entry (MongoDB + Neo4j Graph)
@router.post("/journal")
async def save_journal(
    payload: JournalCreateSchema, current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user.get("id") or current_user.get("email") or "guest_user")
    created_timestamp = payload.date or datetime.datetime.utcnow().isoformat()
    emotion = payload.emotion or "Reflective"

    journal_doc = {
        "user_id": user_id,
        "content": payload.content,
        "emotion": emotion,
        "created_at": created_timestamp,
        "type": "journal",
    }

    try:
        # A. Save to MongoDB
        mongo_res = await mongo_db["journals"].insert_one(journal_doc)
        journal_id = str(mongo_res.inserted_id)

        # B. Save to Neo4j Knowledge Graph for longitudinal emotion tracking
        try:
            save_journal_to_graph(
                user_id=user_id,
                content=payload.content,
                date=created_timestamp,
                emotion=emotion,
            )
            print(f"✅ Journal entry (emotion: {emotion}) saved to Neo4j & MongoDB for user {user_id}")
        except Exception as graph_err:
            print(f"⚠️ Neo4j Sync Error (MongoDB saved): {str(graph_err)}")

        return {
            "status": "success",
            "message": "Journal saved successfully!",
            "id": journal_id,
        }
    except Exception as e:
        print(f"❌ Database Error in /journal: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}"
        )


# 3. Log Relaxation Activity (Breathing / Focus Session / Meditation)
@router.post("/log-activity")
async def log_activity(
    payload: ActivityLogSchema, current_user: dict = Depends(get_current_user)
):
    user_id = current_user.get("id") or current_user.get("email") or "guest_user"
    activity_time = payload.timestamp or datetime.datetime.utcnow().isoformat()

    activity_doc = {
        "user_id": user_id,
        "activity_type": payload.activity_type,
        "duration_minutes": payload.duration_minutes,
        "timestamp": activity_time,
    }

    try:
        # Save to MongoDB Activity Logs
        res = await mongo_db["activity_logs"].insert_one(activity_doc)
        
        # Log success output to terminal console
        print(
            f"✅ Activity Logged: [{payload.activity_type}] "
            f"for {payload.duration_minutes} min(s) | User: {user_id}"
        )

        return {
            "status": "success", 
            "message": "Activity logged successfully!",
            "log_id": str(res.inserted_id)
        }
    except Exception as e:
        print(f"❌ Database Error in /log-activity: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}"
        )