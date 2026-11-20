import os
import json
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from app.db.mongo import db
from app.routers.protected_routes import get_current_user, get_current_user_flexible
from bson import ObjectId
from datetime import datetime
from pydantic import BaseModel, Field
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
    history: Optional[List[Dict[str, Any]]] = None

class NextQuestionRequest(BaseModel):
    stepIndex: Optional[int] = Field(default=1, description="Target question step index (1 to 9)")
    previousAnswers: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Answers recorded so far")
    lastQuestion: Optional[str] = Field(default="", description="Question text of previous step")
    lastLikertLabel: Optional[str] = Field(default="", description="Selected Likert label from previous step")
    lastAnswerText: Optional[str] = Field(default="", description="User reflection text from previous step")
    history: Optional[List[Dict[str, Any]]] = Field(default=None, description="Backwards compatibility for legacy caller")

# Cohen's PSS-8 Psychometric Constructs for Adaptive Steps 2 through 8 (stepIndex 1 to 7)
PSYCHOMETRIC_CONSTRUCTS = {
    1: {
        "construct": "Control & Agency",
        "category": "Control & Agency",
        "baseline": "Over the past few days, how often have you felt unable to control the important things in your life?"
    },
    2: {
        "construct": "Nervous Arousal",
        "category": "Nervous Arousal",
        "baseline": "Over the past few days, how often have you felt nervous, stressed, or emotionally overloaded?"
    },
    3: {
        "construct": "Coping Confidence",
        "category": "Coping Confidence",
        "baseline": "Over the past few days, how often have you felt confident in your ability to handle personal challenges?"
    },
    4: {
        "construct": "Life Trajectory",
        "category": "Life Trajectory",
        "baseline": "Over the past few days, how often have you felt that things were moving smoothly in your direction?"
    },
    5: {
        "construct": "Irritability Control",
        "category": "Workload Coping",
        "baseline": "Over the past few days, how often have you found that you could not cope with all the tasks you had to do?"
    },
    6: {
        "construct": "Mastery & Dominance",
        "category": "Irritation Regulation",
        "baseline": "Over the past few days, how often have you been able to control irritations in your daily life?"
    },
    7: {
        "construct": "Emotional Resilience",
        "category": "Self-Efficacy",
        "baseline": "Over the past few days, how often have you felt on top of your responsibilities and in control?"
    }
}

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
        
        full_name = user.get("full_name") or user.get("name") or "User"

        return {
            "id": str(user["_id"]),
            "user_id": str(user["_id"]),
            "name": full_name,
            "full_name": full_name,
            "email": user.get("email", ""),
            "days_active": user.get("days_active", 1),
            "entries_count": user.get("entries_count", 0),
            "insights": {
                "mood_history": [],
                "assessment_history": [],
                "avg_stress": "0.0"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- 4. Update Profile ---
@router.put("/update")
async def update_profile(data: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    try:
        user_id = ObjectId(current_user["id"])
        new_name = data.name.strip()
        result = await db.users.update_one(
            {"_id": user_id}, 
            {"$set": {"name": new_name, "full_name": new_name}}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User record not found")
        return {
            "status": "success", 
            "message": "Profile updated successfully",
            "updated_name": new_name,
            "name": new_name,
            "full_name": new_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")

# --- 5. Logout Endpoint ---
@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    return {"status": "success", "message": "Logged out successfully"}

# --- 6. Separate Assessment Endpoint ---
@router.post("/assessment/next-question")
async def assessment_handler(data: NextQuestionRequest, current_user: dict = Depends(get_current_user)):
    """
    Real-time Gemini Adaptive Question Generation for Steps 2 through 8 (stepIndex 1 to 7),
    and ML Biometric Feature Extraction for Steps 9 and 10 (stepIndex 8 and 9).
    """
    user_id = str(current_user["id"])

    # Backwards-compatibility check for legacy callers passing { history: [...] } without stepIndex
    if data.history is not None and data.stepIndex is None:
        try:
            reply = get_next_question(user_id, data.history)
            return {"status": "success", "question": reply.get("question")}
        except Exception as e:
            print(f"❌ Legacy assessment API error: {e}")
            raise HTTPException(status_code=500, detail="Assessment failed")

    stepIndex = int(data.stepIndex if data.stepIndex is not None else 1)

    # 1. Steps 9 & 10 (stepIndex 8 & 9): ML Model Biometric Habit Inputs
    if stepIndex == 8:
        print(f"[ML Feature Input Q{stepIndex + 1}] Collecting biometric habit feature for stress_model.pkl (Sleep_Hours_Per_Day)")
        return {
            "status": "success",
            "stepIndex": 8,
            "category": "Sleep Architecture",
            "question": "How many hours of sleep did you get last night?",
            "options": ["< 5 hours", "5 - 6 hours", "7 - 8 hours", "> 8 hours"],
            "source": "ml_feature_extractor",
            "feature": "Sleep_Hours_Per_Day"
        }
    elif stepIndex == 9:
        print(f"[ML Feature Input Q{stepIndex + 1}] Collecting biometric habit feature for stress_model.pkl (Study_Hours_Per_Day)")
        return {
            "status": "success",
            "stepIndex": 9,
            "category": "Focus & Academic Load",
            "question": "Daily focused study or work duration?",
            "options": ["< 4 hours", "4 - 6 hours", "6 - 8 hours", "> 8 hours"],
            "source": "ml_feature_extractor",
            "feature": "Study_Hours_Per_Day"
        }

    # 2. Steps 2 through 8 (stepIndex 1 to 7): Gemini Adaptive Psychometric Questions
    construct_info = PSYCHOMETRIC_CONSTRUCTS.get(stepIndex, {
        "construct": "Emotional Resilience",
        "category": "Self-Efficacy",
        "baseline": "Over the past few days, how often have you felt on top of your responsibilities and in control?"
    })
    baseline_q = construct_info["baseline"]

    try:
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        if not gemini_api_key:
            raise ValueError("Gemini API Key missing")

        client = genai.Client(api_key=gemini_api_key, http_options={'timeout': 30000})
        student_input = (data.lastAnswerText or data.lastLikertLabel or "Sometimes").strip()
        prompt = f"""Role: Clinical Psychometric Specialist.
Task: Adapt the next Cohen's PSS question for student mental health check-in.
Construct: "{construct_info['construct']}"
Baseline: "{baseline_q}"
Student's Previous Response: "{student_input}"

Generate ONE concise, empathetic adapted question assessing "{construct_info['construct']}" that bridges from their previous answer.
Must start with "Over the past few days, how often..." and be answerable with: Never, Almost Never, Sometimes, Fairly Often, Very Often (12-22 words).

Return strictly JSON:
{{"question": "Your single sentence adapted question here"}}
"""
        def _call_gemini():
            return client.models.generate_content(
                model="gemini-flash-lite-latest",
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "max_output_tokens": 80,
                    "temperature": 0.5
                }
            )

        response = await asyncio.wait_for(asyncio.to_thread(_call_gemini), timeout=15.0)
        raw = response.text.strip()
        if "```" in raw:
            raw = raw.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(raw)
        adapted_question = parsed.get("question")
        if not adapted_question or not isinstance(adapted_question, str) or len(adapted_question.strip()) < 10:
            raise ValueError("Invalid adapted question returned by Gemini")

        adapted_question = adapted_question.strip()
        print(f"[Gemini Adaptive Q{stepIndex + 1}] Generated dynamic question: {adapted_question}")
        return {
            "status": "success",
            "stepIndex": stepIndex,
            "category": construct_info["category"],
            "question": adapted_question,
            "options": ["Never", "Almost Never", "Sometimes", "Fairly Often", "Very Often"],
            "source": "gemini_adaptive"
        }
    except Exception as e:
        print(f"[Gemini Fallback Q{stepIndex + 1}] Fallback applied ({type(e).__name__}): {e}")
        return {
            "status": "success",
            "stepIndex": stepIndex,
            "category": construct_info["category"],
            "question": baseline_q,
            "options": ["Never", "Almost Never", "Sometimes", "Fairly Often", "Very Often"],
            "source": "gemini_fallback"
        }

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
        therapy_result = get_therapy_response(user_id, user_message, history=data.history or [])
        reply_val = therapy_result.get("reply") if isinstance(therapy_result, dict) else str(therapy_result)
            
        return {
            "status": "success", 
            "crisis_triggered": False,
            "intent": therapy_result.get("intent", "THERAPY") if isinstance(therapy_result, dict) else "THERAPY",
            "agent_used": therapy_result.get("agent_used", "Profiling & Therapy Agent") if isinstance(therapy_result, dict) else "Profiling & Therapy Agent",
            "suggested_tool": therapy_result.get("suggested_tool") if isinstance(therapy_result, dict) else None,
            "mood": therapy_result.get("mood", "Neutral") if isinstance(therapy_result, dict) else "Neutral",
            "thought_identification": therapy_result.get("thought_identification") if isinstance(therapy_result, dict) else None,
            "reality_check": therapy_result.get("reality_check") if isinstance(therapy_result, dict) else None,
            "cognitive_reframe": therapy_result.get("cognitive_reframe") if isinstance(therapy_result, dict) else None,
            "reply": reply_val
        }
    except Exception as e:
        print(f"❌ Chat Agent error: {e}")
        raise HTTPException(status_code=500, detail="AI Chat failed")   

def generate_fallback_micro_reflection(mood: str, energy: str, emotion_tags: List[str]) -> str:
    """Provides a deterministic, clinical fallback reflection if Gemini API is unreachable or times out."""
    tags_str = f"feeling {', '.join(emotion_tags).lower()}" if emotion_tags else "taking time for this check-in"
    if energy == "Drained" or mood in ["Bad", "Terrible"]:
        return f"It is completely valid to feel low on energy while {tags_str}. Give yourself permission to pause, protect your cognitive boundaries, and recharge without guilt."
    elif energy == "Energized" or mood in ["Great", "Good"]:
        return f"Your energy and focus are in a constructive rhythm right now as you feel {', '.join(emotion_tags).lower() if emotion_tags else 'balanced'}. Channel this clarity into your university priorities while pacing yourself mindfully."
    else:
        return f"Acknowledging your steady state while {tags_str} builds durable mental resilience. Maintain this calm cadence and take intentional micro-breaks between study blocks."

# --- 8. Mood Tracking Endpoint ---
@router.post("/mood-log")
async def log_user_mood(data: MoodEntryRequest, current_user: Optional[dict] = Depends(get_current_user_flexible)):
    """Saves daily mood and reflection tracking data to MongoDB and Neo4j graph without synthetic stress."""
    try:
        user_id = (
            str(current_user["id"])
            if (current_user and "id" in current_user)
            else (str(data.user_id) if data.user_id else "demo_user")
        )
        # Stress is purely derived from clinical assessment or mood index; safely cast to float
        stress_val = data.stress_score if data.stress_score is not None else data.stress_level
        if stress_val is not None:
            stress_val = round(float(stress_val), 1)

        journal_note_val = (
            data.journal_note
            if data.journal_note is not None and data.journal_note != ""
            else (data.notes or data.note or "")
        )
        sleep_hours_val = float(data.sleep_hours) if data.sleep_hours is not None else 7.0
        emotion_tags_val = [str(e) for e in (data.emotion_tags or [])]
        energy_level_val = str(data.energy_level or "Steady")
        stress_factors_val = [str(sf) for sf in (data.stress_factors or []) if str(sf).strip()]
        if not stress_factors_val and data.stress_factor and data.stress_factor != "None":
            stress_factors_val = [data.stress_factor]
        stress_factor_primary = stress_factors_val[0] if stress_factors_val else (data.stress_factor or "None")
        activities_val = [str(a) for a in (data.activities or []) if str(a).strip()]

        # 1. Generate empathetic Gemini AI Micro-Reflection
        micro_reflection = generate_fallback_micro_reflection(data.mood, energy_level_val, emotion_tags_val)
        try:
            gemini_api_key = os.getenv("GEMINI_API_KEY")
            if gemini_api_key:
                client = genai.Client(api_key=gemini_api_key, http_options={'timeout': 30000})
                activities_str = ", ".join(activities_val) if activities_val else "General Daily Routine"
                emotions_str = ", ".join(emotion_tags_val) if emotion_tags_val else "Reflective"
                triggers_str = ", ".join(stress_factors_val) if stress_factors_val else "None reported"
                reflection_prompt = f"""Role: Empathetic Clinical Psychologist & University Mental Health Coach.
The student logged a daily mood check-in:
- Overall Mood: {data.mood}
- Affect / Emotion Labels: {emotions_str}
- Mental Energy Level: {energy_level_val}
- Rest & Sleep: {sleep_hours_val} hours last night
- Active Stress Triggers: {triggers_str}
- Activities: {activities_str}
- Journal Note: {journal_note_val or 'None'}

Provide exactly 2 concise, compassionate, and clinically insightful sentences tailored directly to their current energy, sleep, triggers, and affective state. Validate their emotional reality and offer an actionable, grounding perspective for their university day. Do NOT use bullet points, markdown formatting, quotes, or emojis. Return only the 2 sentences."""

                def _call_gemini_reflection():
                    return client.models.generate_content(
                        model="gemini-flash-lite-latest",
                        contents=reflection_prompt,
                        config={
                            "max_output_tokens": 90,
                            "temperature": 0.6,
                        }
                    )

                gemini_res = await asyncio.wait_for(asyncio.to_thread(_call_gemini_reflection), timeout=12.0)
                if gemini_res and gemini_res.text and len(gemini_res.text.strip()) > 15:
                    cleaned_text = gemini_res.text.strip().replace('"', '').replace('\n', ' ')
                    micro_reflection = cleaned_text
                    print(f"✅ [Gemini Micro-Reflection] Generated: {micro_reflection}")
        except Exception as ge:
            print(f"⚠️ [Gemini Micro-Reflection Fallback] ({type(ge).__name__}): {ge}")

        # 2. Log complete history entry to MongoDB
        mood_log_entry = {
            "user_id": user_id,
            "timestamp": datetime.utcnow(),
            "mood": data.mood,
            "mood_score": data.mood_score if data.mood_score is not None else 3.0,
            "emotion_tags": emotion_tags_val,
            "energy_level": energy_level_val,
            "stress_score": stress_val,
            "stress_level": stress_val,
            "activities": activities_val,
            "stress_factors": stress_factors_val,
            "stress_factor": stress_factor_primary,
            "sleep_hours": sleep_hours_val,
            "journal_note": journal_note_val,
            "note": journal_note_val,
            "notes": journal_note_val,
            "micro_reflection": micro_reflection
        }
        await db.mood_logs.insert_one(mood_log_entry)
        
        # 3. Update Neo4j Graph for analytics
        save_mood_entry_to_graph(
            user_id=user_id,
            mood=data.mood,
            stress_score=stress_val,
            sleep_hours=sleep_hours_val,
            activities=activities_val,
            stress_factor=stress_factor_primary,
            journal_note=journal_note_val,
            emotion_tags=emotion_tags_val,
            energy_level=energy_level_val,
            stress_factors=stress_factors_val
        )
        
        return {
            "status": "success",
            "message": "Mood entry logged successfully",
            "micro_reflection": micro_reflection
        }
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
                client = genai.Client(api_key=gemini_api_key, http_options={'timeout': 30000})
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
        
        client = genai.Client(api_key=gemini_api_key, http_options={'timeout': 30000})
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