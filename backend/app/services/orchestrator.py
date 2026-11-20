import os
import logging
from google import genai
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("mindcare.orchestrator")

def route_user_intent(user_input: str) -> str:
    """
    Classifies the user's intent to route to the appropriate specialized agent:
    - 'CBT_REFRAME': Cognitive distortions, catastrophic thinking, academic panic, imposter syndrome, deadline pressure.
    - 'ASSESSMENT_MEMORY': Questions about past assessment scores, PSS-8 results, mental health test scores.
    - 'INSIGHT': Longitudinal patterns, sleep trends, stress history, mood evolution, wellness trajectory.
    - 'THERAPY': General emotional decompression, active listening, mindfulness, open dialogue.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    clean_input = str(user_input or "").strip()
    if not clean_input:
        return "THERAPY"

    lower = clean_input.lower()

    # Fast-path keyword routing: immediate zero-latency return for common student distress/chat inputs
    # Avoids making an unnecessary extra Gemini network roundtrip and eliminates TimeoutError
    fast_path_therapy = [
        "stress", "work", "exam", "deadline", "sleep", "anxious", "tired",
        "help", "score", "history", "sad", "hello", "hi", "hey", "feeling",
        "worried", "exhausted", "burnout", "overwhelmed", "assignment", "study"
    ]
    if any(k in lower for k in fast_path_therapy):
        return "THERAPY"

    # Specific memory or insight queries
    if any(k in lower for k in ["last score", "assessment score", "pss", "previous test", "test result"]):
        return "ASSESSMENT_MEMORY"
    if any(k in lower for k in ["trend", "progress report", "mood pattern", "trajectory", "sleep history"]):
        return "INSIGHT"

    if not api_key:
        return "THERAPY"

    selected_model = "gemini-flash-lite-latest"

    prompt_text = f"""
    You are the Central AI Orchestrator for MindCare, a clinical mental health companion for university students in Sri Lanka.
    Classify the following user message into EXACTLY ONE category:

    1. 'CBT_REFRAME': User is catastrophizing, expressing severe self-doubt, exam anxiety, deadline panic, imposter syndrome, or irrational negative thoughts needing cognitive restructuring.
    2. 'ASSESSMENT_MEMORY': User is specifically asking about their past assessment scores, previous check-in tests, diagnostic results, PSS-8 scores, or how they performed in their last test.
    3. 'INSIGHT': User is asking about their longitudinal mood patterns, sleep history trends, weekly/monthly stress progress, or overall wellness trajectory.
    4. 'THERAPY': User is venting, seeking general emotional support, mindfulness guidance, relaxation tips, or conversational decompression.

    User Message: "{user_input}"

    Rules:
    - Respond with ONLY the category word ('CBT_REFRAME', 'ASSESSMENT_MEMORY', 'INSIGHT', or 'THERAPY').
    - Do not output any other punctuation or words.
    """

    try:
        client = genai.Client(api_key=api_key, http_options={'timeout': 30000})
        response = client.models.generate_content(
            model=selected_model,
            contents=prompt_text
        )
        if response and response.text:
            cleaned = response.text.strip().upper()
            if "CBT" in cleaned:
                return "CBT_REFRAME"
            elif "ASSESSMENT" in cleaned or "MEMORY" in cleaned:
                return "ASSESSMENT_MEMORY"
            elif "INSIGHT" in cleaned:
                return "INSIGHT"
            else:
                return "THERAPY"
    except Exception as e:
        logger.warning("Orchestrator classification error: %s. Defaulting to THERAPY", e)
        return "THERAPY"

    return "THERAPY"
