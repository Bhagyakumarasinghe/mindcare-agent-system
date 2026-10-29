import os
import json
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from app.db.mongo import db
from app.routers.protected_routes import get_current_user
from bson import ObjectId
from datetime import datetime
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from google import genai

# Agents and Services imports
from app.services.orchestrator import route_user_intent
from app.services.assessment_agent import get_next_question
from app.services.therapy_agent import get_therapy_response
from app.db.neo4j import get_user_insights, save_mood_entry_to_graph, get_user_longitudinal_context
from app.services.analytics_agent import get_user_mental_health_summary 
from app.schemas.user_schema import MoodEntryRequest
from app.services.crisis_service import detect_crisis_risk, record_crisis_alert_in_graph, CRISIS_RESPONSE_TEMPLATE

router = APIRouter(prefix="/user", tags=["User Profile & AI Chat"])

# --- Pydantic Models ---
class ChatRequest(BaseModel):
    message: Optional[str] = "" 
    history: Optional[List[Dict[str, str]]] = []

class AssessmentRequest(BaseModel):
    history: List[Dict[str, Any]]

class ProfileUpdate(BaseModel):
    name: str

class EvaluateResponseRequest(BaseModel):
    question: str
    text_response: str

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

# --- 2. User Analytics & Summary Endpoint ---
@router.get("/analytics")
@router.get("/summary")
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
        summary = get_user_mental_health_summary(current_user["id"])
        real_entries = summary.get("entries_count", 0)
        real_stress = summary.get("avg_stress", 0.0)

        return {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "days_active": user.get("days_active", 1),
            "entries_count": real_entries if real_entries > 0 else user.get("entries_count", 0),
            "insights": {
                **insights,
                "avg_stress": str(real_stress)
            }
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
    Endpoint dedicated to adaptive psychological check-in questions.
    """
    user_id = str(current_user["id"])
    try:
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
    Dedicated endpoint for CBT-informed AI supportive therapy chat.
    Intercepts crisis keywords with immediate clinical helplines and Neo4j CrisisAlert logging.
    """
    user_id = str(current_user["id"]) 
    user_message = (data.message or "").strip()

    # 1. Immediate Clinical Early Warning & Crisis Interception Check
    crisis_check = detect_crisis_risk(user_message)
    if crisis_check.get("is_crisis"):
        print(f"🚨 [CRISIS INTERVENTION TRIGGERED] User {user_id} triggered crisis rule in Chat: {crisis_check.get('category')}")
        
        record_crisis_alert_in_graph(
            user_id=user_id,
            source="Chat",
            raw_content=user_message,
            severity="CRITICAL",
            category=crisis_check.get("category", "Self-Harm/Suicidal Ideation")
        )

        try:
            await db["crisis_alerts"].insert_one({
                "user_id": user_id,
                "source": "Chat",
                "severity": "CRITICAL",
                "category": crisis_check.get("category", "Self-Harm/Suicidal Ideation"),
                "timestamp": datetime.utcnow().isoformat()
            })
        except Exception as me:
            print(f"MongoDB crisis alert note: {me}")

        response_payload = dict(CRISIS_RESPONSE_TEMPLATE)
        response_payload["status"] = "crisis"
        response_payload["reply"] = (
            "We care deeply about your well-being. Immediate confidential clinical support is available right now. "
            "Please reach out to the National Mental Health Helpline (1926) or Sumithrayo Sri Lanka (0112696666). You are not alone."
        )
        return response_payload
    
    try:
        reply = get_therapy_response(user_id, user_message)
            
        return {
            "status": "success", 
            "crisis_triggered": False,
            "intent": "THERAPY", 
            "reply": reply
        }
    except Exception as e:
        print(f"❌ Chat Agent error: {e}")
        raise HTTPException(status_code=500, detail="AI Chat failed")   

# --- 8. Mood Tracking Endpoint ---
@router.post("/mood-log")
async def log_user_mood(data: MoodEntryRequest, current_user: dict = Depends(get_current_user)):
    """Saves daily mood and stress tracking data to MongoDB and Neo4j graph."""
    try:
        user_id = str(current_user["id"])
        stress_val = data.stress_score if data.stress_score is not None else (data.stress_level if data.stress_level is not None else 5)
        journal_note_val = data.journal_note if data.journal_note is not None and data.journal_note != "" else (data.note or "")
        
        # 1. Log complete history entry to MongoDB
        mood_log_entry = {
            "user_id": user_id,
            "timestamp": datetime.utcnow(),
            "mood": data.mood,
            "stress_score": stress_val,
            "stress_level": stress_val,
            "activities": data.activities,
            "stress_factor": data.stress_factor or "None",
            "sleep_hours": data.sleep_hours,
            "journal_note": journal_note_val,
            "note": journal_note_val
        }
        await db.mood_logs.insert_one(mood_log_entry)
        
        # 2. Update Neo4j Graph for analytics as requested
        save_mood_entry_to_graph(
            user_id=user_id,
            mood=data.mood,
            stress_score=stress_val,
            sleep_hours=data.sleep_hours,
            activities=data.activities,
            stress_factor=data.stress_factor or "None",
            journal_note=journal_note_val
        )
        
        return {"status": "success", "message": "Mood entry logged successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- 9. Longitudinal Assessment Context Endpoint ---
@router.get("/assessment/context")
async def get_assessment_context(current_user: dict = Depends(get_current_user)):
    """
    Fetches the user's longitudinal context from Neo4j (previous stress level, dominant triggers,
    coping strategies) and generates an initial check-in prompt via Gemini evaluating ongoing progress.
    """
    try:
        user_id = str(current_user["id"])
        user_name = current_user.get("name", "Student")
        context = get_user_longitudinal_context(user_id)
        
        last_stress = context.get("last_stress_level")
        coping = context.get("coping_strategies")
        recent_mood = context.get("recent_mood")
        
        if last_stress:
            strategies_str = ", ".join(coping[:3]) if coping else "mindfulness and routine check-ins"
            prompt = f"""You are MindCare, an empathetic clinical mental health AI assistant.
A student named {user_name} is starting a regular mental health and stress assessment.
Their previous assessment indicated a '{last_stress}' stress level.
Their recommended coping strategies were: {strategies_str}.
Their most recently logged mood state was: {recent_mood or 'neutral'}.

Generate a concise, warm, professional 2-sentence clinical check-in greeting acknowledging their ongoing journey, asking how they have been coping over the past few days, and encouraging honest reflection."""
            try:
                gemini_api_key = os.getenv("GEMINI_API_KEY")
                client = genai.Client(api_key=gemini_api_key)
                response = client.models.generate_content(
                    model="gemini-flash-lite-latest",
                    contents=prompt
                )
                checkin_message = response.text.strip()
            except Exception as ge:
                print(f"Gemini greeting generation fallback: {ge}")
                checkin_message = f"Welcome back, {user_name}. In our last assessment, your stress was classified as {last_stress}. Let's check in on how you've been feeling and coping over the past few days."
        else:
            checkin_message = f"Welcome to your MindCare assessment, {user_name}. This quick check-in will evaluate your emotional resilience and academic balance over the past few days."

        return {
            "status": "success",
            "context": context,
            "checkin_message": checkin_message
        }
    except Exception as e:
        print(f"Error in assessment context: {e}")
        return {
            "status": "success",
            "context": {},
            "checkin_message": "Welcome to your MindCare check-in. Let's see how you've been doing over the past few days."
        }

def estimate_likert_from_text(question: str, text: str) -> dict:
    """
    Resilient keyword-based estimation fallback for PSS question narratives.
    Gracefully handles Gemini 503 UNAVAILABLE or network timeouts by mapping common
    sentiment and frequency terms directly onto the 0-4 Likert scale.
    """
    t = (text or "").lower().strip()
    if not t:
        return {
            "score": 2,
            "likert_label": "Sometimes",
            "sentiment": "Neutral",
            "explanation": "No text provided; defaulted to neutral baseline."
        }

    # 1. Direct Negative / Zero / Never indicators (Score: 0)
    zero_exact = {"no", "nope", "never", "none", "zero", "not at all", "nah", "nil", "no never", "never ever"}
    zero_phrases = [
        "not at all", "never once", "no stress", "not really", "not upset",
        "not stressed", "no problem", "not once", "haven't felt", "did not",
        "didn't", "dont feel", "don't feel", "nothing at all", "not nervous",
        "haven't been", "has not", "never felt", "zero stress"
    ]
    if t in zero_exact or any(phrase in t for phrase in zero_phrases):
        return {
            "score": 0,
            "likert_label": "Never",
            "sentiment": "Calm / No Stress",
            "explanation": "Narrative indicates no occurrence or zero distress."
        }

    # 2. Severe / Constant / Overwhelming indicators (Score: 4)
    severe_keywords = [
        "constantly", "always", "all the time", "every day", "very often", "extreme",
        "unbearable", "overwhelmed", "panic", "cannot cope", "can't cope", "breaking down",
        "severe", "terrible", "awful", "drowning", "suffocating", "paralyzed", "hopeless",
        "exhausted", "collapsed", "burned out", "burnt out"
    ]
    if any(k in t for k in severe_keywords):
        return {
            "score": 4,
            "likert_label": "Very Often",
            "sentiment": "Severe Distress",
            "explanation": "Narrative reflects persistent or overwhelming distress."
        }

    # 3. Infrequent / Mild indicators (Score: 1)
    mild_keywords = [
        "almost never", "rarely", "hardly", "barely", "seldom", "infrequently",
        "very rarely", "hardly ever", "only once", "minimal", "very mild", "slight",
        "not much", "a tiny bit", "hardly noticeable", "just once"
    ]
    if any(k in t for k in mild_keywords):
        return {
            "score": 1,
            "likert_label": "Almost Never",
            "sentiment": "Mild / Infrequent",
            "explanation": "Narrative indicates infrequent or low-level distress."
        }

    # 4. Elevated / Frequent indicators (Score: 3)
    high_keywords = [
        "fairly often", "often", "frequently", "a lot", "quite often", "quite a bit",
        "stressed", "anxious", "nervous", "struggling", "difficult", "hard", "tough",
        "worried", "pressure", "burden", "heavy load", "pretty often", "many times",
        "most days", "feeling down", "frustrated"
    ]
    if any(k in t for k in high_keywords):
        return {
            "score": 3,
            "likert_label": "Fairly Often",
            "sentiment": "Elevated Stress",
            "explanation": "Narrative indicates regular stress presence or notable challenge."
        }

    # 5. Baseline / Moderate / Neutral (Score: 2)
    return {
        "score": 2,
        "likert_label": "Sometimes",
        "sentiment": "Moderate Stress",
        "explanation": "Narrative reflects occasional or moderate baseline stress."
    }

# --- 10. NLP Zero-Shot Assessment Evaluator Endpoint ---
@router.post("/assessment/evaluate-response")
async def evaluate_assessment_response(data: EvaluateResponseRequest, current_user: dict = Depends(get_current_user)):
    """
    Evaluates a free-form text response for a PSS question using Gemini NLP zero-shot scoring.
    Maps student narrative directly onto 0-4 Likert scale with sentiment extraction.
    Resiliently falls back to heuristic keyword scoring upon Gemini 503 UNAVAILABLE or timeout.
    """
    raw_text = (data.text_response or "").strip()
    if not raw_text:
        return {
            "status": "success",
            "evaluation": estimate_likert_from_text(data.question, "")
        }

    # Instant heuristic short-circuit for common single-word assertions (e.g. "No", "Never")
    t_lower = raw_text.lower()
    if t_lower in {"no", "nope", "never", "none", "zero", "not at all", "nah", "nil"}:
        return {
            "status": "success",
            "evaluation": {
                "score": 0,
                "likert_label": "Never",
                "sentiment": "Calm / No Stress",
                "explanation": f"Student responded with '{raw_text}', indicating zero stress impact."
            }
        }

    try:
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        if not gemini_api_key:
            raise ValueError("Gemini API Key missing")
        
        client = genai.Client(api_key=gemini_api_key)
        prompt = f"""Role: Clinical Psychology NLP Scorer.
Task: Evaluate the student's free-form description for the following Perceived Stress Scale question:
Question: "{data.question}"
Student Response: "{raw_text}"

Map this response onto the 0 to 4 Likert scale:
0: Never / Not at all / Zero stress
1: Almost Never / Rarely / Very mild
2: Sometimes / Moderately / Manageable
3: Fairly Often / Frequent / High difficulty
4: Very Often / Constantly / Severe distress

Return strictly JSON:
{{
  "score": <integer between 0 and 4>,
  "likert_label": "<Never | Almost Never | Sometimes | Fairly Often | Very Often>",
  "sentiment": "<Short 2-4 word clinical sentiment summary, e.g. Anxious / Overloaded>",
  "explanation": "<Brief 1-sentence rationale for the score>"
}}
"""
        def _call_gemini():
            return client.models.generate_content(
                model="gemini-flash-lite-latest",
                contents=prompt,
                config={"response_mime_type": "application/json"}
            )

        # Run with 6-second timeout to prevent 503 model overload / hangs
        response = await asyncio.wait_for(asyncio.to_thread(_call_gemini), timeout=6.0)
        parsed = json.loads(response.text)
        score = int(parsed.get("score", 2))
        score = max(0, min(4, score))
        parsed["score"] = score
        
        labels = ["Never", "Almost Never", "Sometimes", "Fairly Often", "Very Often"]
        if parsed.get("likert_label") not in labels:
            parsed["likert_label"] = labels[score]

        return {
            "status": "success",
            "evaluation": parsed
        }
    except Exception as e:
        print(f"NLP scoring fallback activated ({type(e).__name__}): {e}")
        fallback_eval = estimate_likert_from_text(data.question, raw_text)
        return {
            "status": "success",
            "evaluation": fallback_eval
        }