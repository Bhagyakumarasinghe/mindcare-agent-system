import os
import asyncio
import datetime
import random
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from google import genai

from app.db.mongo import db as mongo_db
from app.db.neo4j import get_neo4j_session, save_journal_to_graph
from app.schemas.relax_schema import ActivityLogSchema, JournalCreateSchema

# --- AUTH DEPENDENCY ---
from app.routers.protected_routes import get_current_user

router = APIRouter(prefix="/user", tags=["Relaxation & Tools"])

# Curated Fallback Micro-Relief Actions (Distinct from long-term analytics advice)
FALLBACK_MICRO_ACTIONS = [
    "Take a 2-minute box breathing break right now: inhale for 4s, hold for 4s, exhale for 4s, and hold for 4s.",
    "Close all inactive study tabs and complete one 25-minute Pomodoro sprint with your phone face down.",
    "Unclench your jaw, relax your shoulders, and do a quick 3-minute journal dump of whatever is cluttering your mind.",
    "Step away from your screen for 3 minutes, hydrate, and stretch your neck and shoulders to restore cognitive flow.",
    "Practice 4-7-8 rhythmic breathing for 2 minutes to downregulate physical tension before your next coursework block.",
    "Spend 5 minutes writing down your top 3 study priorities for today, then focus only on the first one."
]


# 1. Daily Tip / Immediate Micro-Relief Endpoint
@router.get("/daily-tip")
async def get_daily_tip(user_id: Optional[str] = Query(default=None)):
    """
    Returns an immediate, actionable 1-2 sentence relaxation micro-action.
    When user_id is provided, checks Neo4j for the student's latest stress & sleep
    and uses gemini-flash-lite-latest with a 15s timeout to generate a personalized micro-action.
    """
    clean_user_id = str(user_id).strip() if user_id else ""

    if clean_user_id and clean_user_id.lower() not in ("demo_user", "guest_user", "none", "null", ""):
        stress_level = "Moderate"
        sleep_hours = 7.0
        recent_mood = "steady"
        energy_level = "Steady"

        # 1. Fetch latest stress baseline and sleep hours from Neo4j
        try:
            with get_neo4j_session() as session:
                query = """
                MATCH (u:User)
                WHERE u.id = $user_id OR u.user_id = $user_id
                OPTIONAL MATCH (u)-[:RECORDED_ASSESSMENT|PERFORMED_CHECKUP|COMPLETED_ASSESSMENT]->(a)
                WITH u, a ORDER BY coalesce(a.timestamp, a.created_at) DESC LIMIT 1
                OPTIONAL MATCH (u)-[:LOGGED_MOOD]->(m:MoodLog)
                WITH u, a, m ORDER BY coalesce(m.timestamp, m.created_at) DESC LIMIT 1
                RETURN 
                    coalesce(a.label, a.level, 'Moderate') AS stress_level,
                    coalesce(m.sleep_hours, 7.0) AS sleep_hours,
                    coalesce(m.mood, 'steady') AS recent_mood,
                    coalesce(m.energy_level, 'Steady') AS energy_level
                """
                record = session.run(query, user_id=clean_user_id).single()
                if record:
                    stress_level = record.get("stress_level") or "Moderate"
                    try:
                        sleep_hours = float(record.get("sleep_hours") or 7.0)
                    except Exception:
                        sleep_hours = 7.0
                    recent_mood = record.get("recent_mood") or "steady"
                    energy_level = record.get("energy_level") or "Steady"
        except Exception as db_err:
            print(f"⚠️ [Neo4j Daily Tip] Baseline fetch note: {db_err}")

        # 2. Generate immediate micro-action via gemini-flash-lite-latest
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        if gemini_api_key:
            prompt = f"""Role: University Student Mental Resilience Coach.
Student Profile Context:
- Stress Level: {stress_level}
- Recent Sleep: {sleep_hours} hours
- Recent Mood: {recent_mood}
- Energy Level: {energy_level}

Goal: Provide exactly ONE immediate, actionable relaxation micro-action (1 to 2 sentences maximum) that the student can do right now in under 5 minutes.
Context Examples: A 2-minute box breathing cycle, a 25m Pomodoro sprint, a 3-minute physical stretch/hydration reset, or a 5-minute unedited journal brain dump based on their state.
Constraints: Concrete, warm, and actionable right now. NOT long-term analytics advice. No bullet points, quotes, emojis, or markdown formatting. Return only the 1–2 sentences."""

            def _call_gemini():
                client = genai.Client(api_key=gemini_api_key, http_options={'timeout': 15000})
                return client.models.generate_content(
                    model="gemini-flash-lite-latest",
                    contents=prompt,
                    config={
                        "max_output_tokens": 80,
                        "temperature": 0.7,
                    }
                )

            try:
                gemini_res = await asyncio.wait_for(asyncio.to_thread(_call_gemini), timeout=15.0)
                if gemini_res and gemini_res.text and len(gemini_res.text.strip()) > 10:
                    clean_tip = gemini_res.text.strip().replace('"', '').replace('\n', ' ')
                    print(f"💡 [Gemini Micro-Action Served]: {clean_tip}")
                    return {"status": "success", "tip": clean_tip, "personalized": True}
            except Exception as ge:
                print(f"⚠️ [Gemini Micro-Action Fallback] ({type(ge).__name__}): {ge}")

    # Fallback / General Micro-Action
    selected_tip = random.choice(FALLBACK_MICRO_ACTIONS)
    print(f"💡 Default Micro-Action Served: {selected_tip}")
    return {"status": "success", "tip": selected_tip, "personalized": False}


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