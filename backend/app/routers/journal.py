import os
import json
import datetime
import logging
from collections import Counter
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from google import genai
from app.db.neo4j import get_neo4j_session
from app.db.mongo import db as mongo_db
from app.utils.security import encrypt_text, decrypt_text

logger = logging.getLogger("mindcare.journal")

router = APIRouter(tags=["AI Journal & Longitudinal Analytics"])

# --- Request Models ---
class JournalAnalyzeRequest(BaseModel):
    user_id: str = Field(..., description="Unique User ID")
    content: str = Field(..., min_length=1, description="Raw journal entry content")
    emotion: Optional[str] = Field(None, description="User-selected emotion tag")


from app.services.crisis_service import detect_crisis_risk, record_crisis_alert_in_graph, CRISIS_RESPONSE_TEMPLATE

# --- 1. AI Journal Analysis & Graph Persistence with Field-Level Encryption ---
@router.post("/api/journal/analyze-and-record")
async def analyze_and_record_journal(payload: JournalAnalyzeRequest):
    """
    Analyzes student journal entries via Gemini zero-shot NLU on raw text,
    extracts emotional metrics & triggers, encrypts the content field-level using Fernet,
    and records (:JournalEntry) in Neo4j (storing encrypted ciphertext) and MongoDB.
    Intercepts severe self-harm / suicidal ideation with immediate clinical crisis payload.
    """
    user_id = payload.user_id.strip()
    content = payload.content.strip()
    user_emotion = payload.emotion.strip() if payload.emotion and payload.emotion.strip() else None

    if not content:
        raise HTTPException(status_code=400, detail="Journal entry cannot be empty.")

    # 0. Immediate Clinical Early Warning & Crisis Interception Protocol
    crisis_check = detect_crisis_risk(content)
    if crisis_check.get("is_crisis"):
        logger.warning(
            "🚨 [CRISIS INTERVENTION TRIGGERED] User %s triggered crisis rule in Journal: %s",
            user_id, crisis_check.get("category")
        )

        record_crisis_alert_in_graph(
            user_id=user_id,
            source="Journal",
            raw_content=content,
            severity="CRITICAL",
            category=crisis_check.get("category", "Self-Harm/Suicidal Ideation")
        )

        try:
            await mongo_db["crisis_alerts"].insert_one({
                "user_id": user_id,
                "source": "Journal",
                "severity": "CRITICAL",
                "category": crisis_check.get("category", "Self-Harm/Suicidal Ideation"),
                "timestamp": datetime.datetime.utcnow().isoformat()
            })
        except Exception as me:
            logger.warning("MongoDB crisis alert backup warning: %s", me)

        return CRISIS_RESPONSE_TEMPLATE

    # 1. Zero-Shot Prompting via Gemini on the raw text FIRST
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    prompt = f"""Role: Clinical Mental Health & Psychometrics NLP Expert.
Task: Analyze the student's personal reflective journal entry.
Extract the dominant emotional state, estimate the sentiment score (-1.0 to +1.0 where negative is distressed/anxious/sad and positive is joyful/calm/hopeful), identify the primary stress or life trigger, and provide a brief, supportive, 1-2 sentence clinical reflection.

Student Journal Entry:
"{content}"

Return strictly valid JSON with this exact schema:
{{
  "dominant_emotion": "<one of: Anxiety, Stress, Overwhelmed, Sadness, Calm, Joy, Hopeful, Exhaustion, Frustration>",
  "sentiment_score": <float between -1.0 and 1.0>,
  "primary_trigger": "<e.g., Academics, Workload, Relationships, Sleep, Health, or Personal>",
  "short_reflection": "<1-2 concise, empathetic, validating clinical sentences>"
}}
"""

    dominant_emotion = user_emotion or "Reflective"
    sentiment_score = 0.0
    primary_trigger = "General"
    short_reflection = "Expressing and writing down your thoughts helps decompress cognitive overload and restore focus."

    try:
        if gemini_api_key:
            client = genai.Client(
                api_key=gemini_api_key,
                http_options={"api_version": "v1beta"}
            )
            response = client.models.generate_content(
                model="gemini-flash-lite-latest",
                contents=prompt,
                config={"response_mime_type": "application/json"}
            )
            parsed = json.loads(response.text.strip())
            if not user_emotion:
                dominant_emotion = str(parsed.get("dominant_emotion", "Reflective")).strip()
            sentiment_score = float(parsed.get("sentiment_score", 0.0))
            # Bound sentiment score to [-1.0, 1.0]
            sentiment_score = max(-1.0, min(1.0, sentiment_score))
            primary_trigger = str(parsed.get("primary_trigger", "Academics")).strip()
            short_reflection = str(parsed.get("short_reflection", short_reflection)).strip()
    except Exception as ge:
        logger.warning("Gemini journal zero-shot parsing fallback applied: %s", ge)
        # Context-aware fallback heuristics based on keywords
        content_lower = content.lower()
        if any(w in content_lower for w in ["exam", "study", "deadline", "assignment", "homework", "grade"]):
            primary_trigger = "Academics"
            dominant_emotion = "Anxiety" if "stress" in content_lower or "worried" in content_lower else "Stress"
            sentiment_score = -0.4
            short_reflection = "Academic deadlines often feel overwhelming. Try breaking complex tasks into smaller 25-minute intervals."
        elif any(w in content_lower for w in ["tired", "sleep", "insomnia", "exhausted"]):
            primary_trigger = "Sleep"
            dominant_emotion = "Exhaustion"
            sentiment_score = -0.3
            short_reflection = "Rest is foundational to cognitive resilience. Consider establishing a brief wind-down routine before sleep."
        elif any(w in content_lower for w in ["happy", "great", "good", "calm", "peace", "relaxed"]):
            primary_trigger = "Personal"
            dominant_emotion = "Calm"
            sentiment_score = 0.6
            short_reflection = "It is wonderful that you are experiencing moments of tranquility. Cherish and build upon these positive states."

    # 2. Field-Level Encryption: Encrypt content before writing to Neo4j
    encrypted_content = encrypt_text(content)

    journal_id = f"journal-{int(datetime.datetime.utcnow().timestamp())}"
    timestamp_str = datetime.datetime.utcnow().isoformat()
    try:
        with get_neo4j_session() as session:
            cypher = """
            MERGE (u:User {id: $user_id})
            CREATE (j:JournalEntry {
                id: randomUUID(),
                content: $content,
                emotion: $emotion,
                sentiment_score: $sentiment_score,
                trigger: $trigger,
                reflection: $reflection,
                timestamp: datetime()
            })
            CREATE (u)-[:LOGGED_JOURNAL]->(j)
            CREATE (u)-[:WROTE_JOURNAL]->(j)
            FOREACH (_ IN CASE WHEN $emotion IS NOT NULL AND $emotion <> '' THEN [1] ELSE [] END |
                MERGE (e:Emotion {type: $emotion})
                MERGE (j)-[:REFLECTS_EMOTION]->(e)
            )
            FOREACH (_ IN CASE WHEN $trigger IS NOT NULL AND $trigger <> '' THEN [1] ELSE [] END |
                MERGE (t:AcademicTrigger {category: $trigger})
                MERGE (j)-[:HAS_TRIGGER]->(t)
            )
            RETURN j.id as id, toString(j.timestamp) as timestamp
            """
            result = session.run(
                cypher,
                user_id=user_id,
                content=encrypted_content,
                emotion=dominant_emotion,
                sentiment_score=sentiment_score,
                trigger=primary_trigger,
                reflection=short_reflection
            ).single()
            if result:
                journal_id = result.get("id") or journal_id
                timestamp_str = result.get("timestamp") or timestamp_str
            logger.info("Successfully persisted encrypted JournalEntry node to Neo4j for %s", user_id)
    except Exception as ne:
        logger.error("Neo4j Journal persistence error: %s", ne)

    # 3. Synchronize to MongoDB journals collection
    try:
        mongo_doc = {
            "user_id": user_id,
            "content": content,
            "encrypted_content": encrypted_content,
            "emotion": dominant_emotion,
            "sentiment_score": sentiment_score,
            "trigger": primary_trigger,
            "reflection": short_reflection,
            "created_at": timestamp_str,
            "type": "ai_journal"
        }
        await mongo_db["journals"].insert_one(mongo_doc)
    except Exception as me:
        logger.warning("MongoDB Journal backup error: %s", me)

    return {
        "status": "success",
        "analysis": {
            "id": journal_id,
            "dominant_emotion": dominant_emotion,
            "sentiment_score": round(sentiment_score, 2),
            "primary_trigger": primary_trigger,
            "short_reflection": short_reflection,
            "timestamp": timestamp_str
        }
    }


# --- 2. Decryption on Retrieval: Journal History Endpoint ---
@router.get("/api/journal/history")
async def get_journal_history(
    user_id: str = Query(..., description="User ID to retrieve history for"),
    limit: int = Query(20, ge=1, le=100, description="Max entries to return")
):
    """
    Fetches user's journal entries from Neo4j and decrypts content field-level on retrieval.
    The database stores encrypted ciphertext, while the client receives decrypted plain text.
    """
    user_id = user_id.strip()
    try:
        with get_neo4j_session() as session:
            cypher = """
            MATCH (u:User {id: $user_id})-[:WROTE_JOURNAL|LOGGED_JOURNAL]->(j:JournalEntry)
            WITH DISTINCT j
            RETURN 
                coalesce(j.id, '') as id,
                j.content as content,
                coalesce(j.emotion, 'Reflective') as emotion,
                coalesce(j.sentiment_score, 0.0) as sentiment_score,
                coalesce(j.trigger, 'General') as trigger,
                coalesce(j.reflection, '') as reflection,
                toString(j.timestamp) as timestamp
            ORDER BY j.timestamp DESC
            LIMIT $limit
            """
            records = session.run(cypher, user_id=user_id, limit=limit).data()
            entries = []
            for r in records:
                decrypted_content = decrypt_text(r.get("content", ""))
                entries.append({
                    "id": r.get("id"),
                    "content": decrypted_content,
                    "emotion": r.get("emotion"),
                    "sentiment_score": round(float(r.get("sentiment_score", 0.0)), 2),
                    "trigger": r.get("trigger"),
                    "reflection": r.get("reflection"),
                    "timestamp": r.get("timestamp")
                })
            return {
                "status": "success",
                "user_id": user_id,
                "count": len(entries),
                "entries": entries
            }
    except Exception as e:
        logger.error("Error retrieving journal history: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to fetch journal history: {str(e)}")



