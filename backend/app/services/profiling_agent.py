import json
import logging
from typing import Dict, Any, List
from app.db.neo4j import (
    get_latest_assessment_data, 
    get_recent_mood_logs, 
    get_recent_chat_sessions,
    get_user_insights
)
from app.utils.encryption import decrypt_data, decrypt_text

logger = logging.getLogger("mindcare.profiling_agent")

def safe_decrypt(ciphertext: str) -> str:
    """Safely decrypts ciphertext using Fernet encryption helpers."""
    if not ciphertext or not isinstance(ciphertext, str):
        return ""
    try:
        return decrypt_data(ciphertext)
    except Exception:
        try:
            return decrypt_text(ciphertext)
        except Exception:
            return ciphertext

def get_student_profile_summary(user_id: str) -> str:
    """
    Retrieves longitudinal context for a student from Neo4j:
    1. Latest Clinical Assessment: PSS-8 score, stress level, and recent Q&A pairs (decrypted).
    2. Last 5 Mood & Sleep check-ins: mood tags, sleep hours, stress score.
    3. Last 3 ChatSession exchanges: decrypted user messages and AI responses across sessions.
    """
    clean_user_id = str(user_id or "demo_user").strip()
    profile_sections: List[str] = []

    # 1. Fetch & Decrypt Latest Assessment Data
    try:
        asmt_data = get_latest_assessment_data(clean_user_id)
        if asmt_data and isinstance(asmt_data, dict):
            score = asmt_data.get("score", "N/A")
            label = asmt_data.get("label", "N/A")
            enc_hist = asmt_data.get("encrypted_history")

            asmt_details = []
            if enc_hist:
                try:
                    decrypted_str = safe_decrypt(enc_hist)
                    history_list = json.loads(decrypted_str) if decrypted_str else []
                    if isinstance(history_list, list):
                        for item in history_list[-2:]:
                            if isinstance(item, dict):
                                q = item.get("question", "N/A")
                                a = item.get("answer", "N/A")
                                asmt_details.append(f"Q: '{q}' -> A: '{a}'")
                except Exception as parse_err:
                    logger.debug("Assessment history decryption/parsing notice: %s", parse_err)

            details_str = "; ".join(asmt_details) if asmt_details else "No specific check-in details."
            profile_sections.append(
                f"• Clinical Assessment: Status '{label}' (Stress Score: {score}/10). Last responses: {details_str}"
            )
        else:
            profile_sections.append("• Clinical Assessment: No prior stress assessment logged yet.")
    except Exception as e:
        logger.warning("Error fetching assessment profile for user %s: %s", clean_user_id, e)
        profile_sections.append("• Clinical Assessment: Assessment record unavailable.")

    # 2. Fetch Last 5 MoodLog / Sleep Entries
    try:
        recent_moods = get_recent_mood_logs(clean_user_id, limit=5)
        if recent_moods and isinstance(recent_moods, list) and len(recent_moods) > 0:
            mood_summaries = []
            for m in recent_moods:
                mood_label = m.get("mood", "Neutral")
                sleep = m.get("sleep_hours") or m.get("sleep") or 7.0
                stress = m.get("stress_score") or m.get("stress")
                stress_str = f", stress {stress}/10" if stress is not None else ""
                mood_summaries.append(f"{mood_label} ({sleep}h sleep{stress_str})")
            profile_sections.append(
                f"• Longitudinal Mood & Sleep (last {len(mood_summaries)} check-ins): {', '.join(mood_summaries)}"
            )
        else:
            # Fallback to insights
            insights = get_user_insights(clean_user_id)
            mood_hist = insights.get("mood_history", []) if isinstance(insights, dict) else []
            if mood_hist:
                sample_moods = [m.get("mood") for m in mood_hist[-5:] if m.get("mood")]
                if sample_moods:
                    profile_sections.append(f"• Recent Detected Moods: {', '.join(sample_moods)}")
    except Exception as e:
        logger.warning("Error fetching mood profile for user %s: %s", clean_user_id, e)

    # 3. Fetch & Decrypt Last 3 ChatSession Exchanges
    try:
        chat_sessions = get_recent_chat_sessions(clean_user_id, limit=3)
        if chat_sessions and isinstance(chat_sessions, list) and len(chat_sessions) > 0:
            chat_exchanges = []
            for s in reversed(chat_sessions):  # chronological order for LLM context
                raw_u = s.get("user_msg", "")
                raw_ai = s.get("ai_reply", "")
                dec_u = safe_decrypt(raw_u).strip()
                dec_ai = safe_decrypt(raw_ai).strip()
                if dec_u:
                    # Truncate each to 100 characters so prompt stays focused
                    u_trunc = (dec_u[:100] + "...") if len(dec_u) > 100 else dec_u
                    ai_trunc = (dec_ai[:100] + "...") if len(dec_ai) > 100 else dec_ai
                    chat_exchanges.append(f"Student: '{u_trunc}' | AI Guide: '{ai_trunc}'")
            if chat_exchanges:
                profile_sections.append(
                    f"• Recent Chat Dialogues (cross-session memory):\n  " + "\n  ".join(chat_exchanges)
                )
    except Exception as e:
        logger.warning("Error fetching chat session history for user %s: %s", clean_user_id, e)

    if not profile_sections:
        return "New student. No prior longitudinal mental health or conversation history recorded."

    return "\n".join(profile_sections)
