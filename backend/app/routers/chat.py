import logging
import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from app.auth import get_current_user, decode_access_token
from app.services.therapy_agent import get_therapy_response
from app.services.crisis_service import detect_crisis_risk, record_crisis_alert_in_graph, CRISIS_RESPONSE_TEMPLATE
from app.db.mongo import db as mongo_db

logger = logging.getLogger("mindcare.chat")

router = APIRouter(tags=["Clinical Support & Crisis Intervention Chat"])


class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Student message text")
    history: Optional[List[Dict[str, Any]]] = Field(default=[], description="Recent conversation turns")
    user_id: Optional[str] = Field(default=None, description="Optional explicit user identity")


@router.post("/api/chat")
@router.post("/chat")
async def chat_interaction_endpoint(
    data: ChatMessageRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Evaluates incoming chat message against clinical crisis risk rules.
    If self-harm or suicidal ideation is detected, intercepts immediately with crisis helplines
    and logs a :CrisisAlert node in Neo4j. Otherwise, delegates to CBT therapy agent.
    """
    user_id = data.user_id or "demo_user"
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        try:
            tok = decode_access_token(token)
            if tok and tok.get("user_id"):
                user_id = str(tok.get("user_id"))
        except Exception:
            pass

    user_message = data.message.strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    # 1. Clinical Early Warning & Crisis Interception Check
    crisis_check = detect_crisis_risk(user_message)
    if crisis_check.get("is_crisis"):
        logger.warning(
            "🚨 [CRISIS INTERVENTION TRIGGERED] User %s triggered crisis rule in Chat: %s",
            user_id, crisis_check.get("category")
        )

        # Securely record CrisisAlert in Neo4j with ciphertext
        record_crisis_alert_in_graph(
            user_id=user_id,
            source="Chat",
            raw_content=user_message,
            severity="CRITICAL",
            category=crisis_check.get("category", "Self-Harm/Suicidal Ideation")
        )

        # Mirror audit record in MongoDB
        try:
            await mongo_db["crisis_alerts"].insert_one({
                "user_id": user_id,
                "source": "Chat",
                "severity": "CRITICAL",
                "category": crisis_check.get("category", "Self-Harm/Suicidal Ideation"),
                "timestamp": datetime.datetime.utcnow().isoformat()
            })
        except Exception as me:
            logger.warning("MongoDB crisis alert backup warning: %s", me)

        response_payload = dict(CRISIS_RESPONSE_TEMPLATE)
        response_payload["status"] = "crisis"
        response_payload["reply"] = (
            "We care deeply about your well-being. Immediate confidential clinical support is available right now. "
            "Please reach out to the National Mental Health Helpline (1926) or Sumithrayo Sri Lanka (0112696666). You are not alone."
        )
        return response_payload

    # 2. Standard Supportive CBT Chat Flow
    try:
        reply = get_therapy_response(user_id, user_message)
        return {
            "status": "success",
            "crisis_triggered": False,
            "intent": "THERAPY",
            "reply": reply
        }
    except Exception as e:
        logger.error("AI Chat communication error: %s", e)
        return {
            "status": "success",
            "crisis_triggered": False,
            "intent": "THERAPY",
            "reply": "I am here with you. Please share what is weighing on your mind."
        }
