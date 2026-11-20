import os
import json
import logging
from typing import Optional, List, Dict, Any
from google import genai
from dotenv import load_dotenv

from app.db.neo4j import save_chat_to_graph
from app.services.profiling_agent import get_student_profile_summary
from app.services.orchestrator import route_user_intent
from app.utils.encryption import encrypt_data

load_dotenv()

logger = logging.getLogger("mindcare.therapy_agent")

def infer_suggested_tool(text: str) -> Optional[str]:
    """Infers the most appropriate clinical relaxation tool based on user text."""
    lower = str(text or "").lower()
    if any(k in lower for k in ["breath", "panic", "anxious", "anxiety", "heart racing", "hyperventilating", "overwhelmed", "freaking out", "chest tight"]):
        return "breathing"
    elif any(k in lower for k in ["study", "exam", "deadline", "focus", "distracted", "assignment", "coursework", "procrastinat", "homework", "thesis"]):
        return "focus"
    elif any(k in lower for k in ["sleep", "tired", "burnout", "insomnia", "exhausted", "night", "ruminat", "calm", "wind down", "unwind", "rest"]):
        return "meditation"
    return None

def get_therapy_response(
    user_id: str, 
    user_message: str, 
    history: Optional[List[Dict[str, Any]]] = None,
    forced_intent: Optional[str] = None
) -> Dict[str, Any]:
    """
    Handles the intelligent multi-agent conversation turn:
    1. Orchestrates intent classification (CBT_REFRAME, ASSESSMENT_MEMORY, INSIGHT, THERAPY).
    2. Retrieves longitudinal student history from Profiling Agent (Neo4j: Assessment, MoodLogs, ChatHistory).
    3. Injects ongoing dialogue history and longitudinal profile context into Gemini (gemini-flash-lite-latest).
    4. Generates empathetic, personalized response with suggested wellness tool and CBT reframe if applicable.
    5. Encrypts messages with Fernet and persists to Neo4j graph.
    """
    clean_user_id = str(user_id or "demo_user").strip()
    user_msg_clean = str(user_message or "").strip()

    # 1. Multi-Agent Intent Routing via Orchestrator
    intent = forced_intent or route_user_intent(user_msg_clean)

    agent_names = {
        "CBT_REFRAME": "CBT Clinical Agent",
        "ASSESSMENT_MEMORY": "Assessment Memory Agent",
        "INSIGHT": "Longitudinal Insight Agent",
        "THERAPY": "Profiling & Therapy Agent"
    }
    agent_used = agent_names.get(intent, "Profiling & Therapy Agent")

    # 2. Context Retrieval from Profiling Agent (Neo4j)
    student_context = get_student_profile_summary(clean_user_id)

    # 3. Format Ongoing Conversation History
    history_str = "No prior messages in this current session."
    if history and isinstance(history, list) and len(history) > 0:
        recent_turns = []
        for h in history[-6:]:  # last 6 turns
            if isinstance(h, dict):
                sender = h.get("sender") or h.get("role") or "unknown"
                text = h.get("text") or h.get("message") or h.get("content") or ""
                if text:
                    recent_turns.append(f"{sender.capitalize()}: {text}")
        if recent_turns:
            history_str = "\n".join(recent_turns)

    # 4. Construct Multi-Perspective Prompt for gemini-flash-lite-latest
    cbt_guidance = ""
    if intent == "CBT_REFRAME":
        cbt_guidance = """
        - The user is demonstrating cognitive distortion or catastrophic dread.
        - Provide structured cognitive restructuring:
          1) Identify the distortion
          2) Offer a reality check question
          3) Provide an empowering cognitive reframe
        """
    elif intent == "ASSESSMENT_MEMORY":
        cbt_guidance = """
        - The user is asking about their past assessment scores or check-in results.
        - Directly refer to the student's Clinical Assessment score and status from their profile context.
        - Validate their progress and frame it as evidence of self-awareness.
        """
    elif intent == "INSIGHT":
        cbt_guidance = """
        - The user is asking about their trends, mood history, sleep patterns, or progress.
        - Refer to their longitudinal mood and sleep records from their profile context.
        - Highlight patterns (e.g. relation between sleep and stress levels) with compassionate insight.
        """

    prompt_text = f"""
    Role: You are MindCare AI, a warm, supportive university peer and caring friend for university students in Sri Lanka.
    Active Specialized Agent: {agent_used}
    Classified Intent: {intent}

    --- LONGITUDINAL STUDENT GRAPH PROFILE (From Neo4j) ---
    {student_context}

    --- ONGOING SESSION CONVERSATION HISTORY ---
    {history_str}

    --- STUDENT'S LATEST MESSAGE ---
    "{user_msg_clean}"

    --- INSTRUCTIONS ---
    - Persona & Voice: Reply like a warm, understanding university peer. Speak in plain, natural, conversational English (NOT a clinical report, NOT a lecture).
    - Length: Exactly 2 to 3 short, comforting sentences. Keep it easy to read on a phone.
    - Strictly Avoid: NO numbered 1-2-3 lists, NO bullet points, NO textbook clinical jargon (e.g. don't say "cognitive distortion", "psychoeducation", "catastrophizing").
    - Contextual Memory: Naturally acknowledge their past check-in score, sleep hours, or previous conversation topics from their Neo4j profile when relevant—just like a friend who genuinely remembers what they've shared.
    - Empathy & Action: If they are tired, stressed, or overwhelmed, validate how they feel with empathy, and suggest a simple, tiny breather (like taking a slow breath or a 5-minute break) without pressure.
    {cbt_guidance}

    Return the output STRICTLY as a JSON object with this schema:
    {{
      "reply": "Your 2-3 short, warm conversational sentences to the student",
      "mood": "Detected user mood (e.g., Anxious, Stressed, Overwhelmed, Exhausted, Calm, Hopeful, Steady)",
      "thought_identification": null,
      "reality_check": null,
      "cognitive_reframe": null
    }}
    """

    api_key = os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key, http_options={'timeout': 30000}) if api_key else None
    selected_model = "gemini-flash-lite-latest"

    reply_text = "I'm right here with you. Tell me a bit more about how you're feeling today."
    detected_mood = "Neutral"
    thought_id = None
    reality_check = None
    cognitive_reframe = None

    if client:
        try:
            response = client.models.generate_content(
                model=selected_model,
                contents=prompt_text,
                config={'response_mime_type': 'application/json'}
            )
            if response and response.text:
                res_data = json.loads(response.text.strip())
                reply_text = res_data.get("reply", reply_text)
                detected_mood = res_data.get("mood", detected_mood)
                thought_id = res_data.get("thought_identification")
                reality_check = res_data.get("reality_check")
                cognitive_reframe = res_data.get("cognitive_reframe")
        except Exception as err:
            logger.warning("Gemini generation failed in therapy_agent: %s. Using clinical fallback.", err)
            if intent == "ASSESSMENT_MEMORY":
                reply_text = "I remember from your recent check-in that stress has been running high lately. It's completely okay to feel this way, so let's take things one small step at a time."
            elif intent == "CBT_REFRAME":
                reply_text = "I know how heavy deadlines and coursework can feel when everything lands at once. Take a slow, steady breath—you don't have to tackle everything this very minute."
            else:
                reply_text = "I hear you, and it's completely normal to feel drained with everything you're juggling. Take a slow breath with me—you're doing the best you can."

    # Infer suggested wellness tool shortcut
    suggested_tool = infer_suggested_tool(user_msg_clean + " " + (reply_text or ""))

    # Encrypt and save interaction to Neo4j
    try:
        encrypted_user_msg = encrypt_data(user_msg_clean)
        encrypted_ai_res = encrypt_data(reply_text)
        save_chat_to_graph(
            clean_user_id,
            encrypted_user_msg,
            encrypted_ai_res,
            intent,
            detected_mood
        )
    except Exception as db_err:
        logger.warning("Failed to save chat interaction to Neo4j: %s", db_err)

    return {
        "reply": reply_text,
        "mood": detected_mood,
        "agent_used": agent_used,
        "intent": intent,
        "suggested_tool": suggested_tool,
        "thought_identification": thought_id,
        "reality_check": reality_check,
        "cognitive_reframe": cognitive_reframe
    }
