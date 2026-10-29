import re
import logging
from typing import Dict, Any
from app.db.neo4j import get_neo4j_session

logger = logging.getLogger("mindcare.crisis")

# Precompiled regex patterns for high-sensitivity clinical risk detection
CRISIS_KEYWORD_PATTERNS = [
    # Suicidal ideation & intent
    (re.compile(r"\b(suicide|suicidal)\b", re.IGNORECASE), "Suicidal Ideation"),
    (re.compile(r"\bkill(ing)?\s+myself\b", re.IGNORECASE), "Suicidal Intent"),
    (re.compile(r"\bend(ing)?\s+my\s+life\b", re.IGNORECASE), "Suicidal Intent"),
    (re.compile(r"\bend(ing)?\s+it\s+all\b", re.IGNORECASE), "Suicidal Intent"),
    (re.compile(r"\bwant\s+to\s+die\b", re.IGNORECASE), "Suicidal Ideation"),
    (re.compile(r"\bwish(ing)?\s+i\s+was\s+dead\b", re.IGNORECASE), "Suicidal Ideation"),
    (re.compile(r"\bbetter\s+off\s+dead\b", re.IGNORECASE), "Suicidal Ideation"),
    (re.compile(r"\bbetter\s+off\s+without\s+me\b", re.IGNORECASE), "Hopelessness / Worthlessness"),
    (re.compile(r"\bno\s+reason\s+to\s+live\b", re.IGNORECASE), "Hopelessness / Ideation"),
    (re.compile(r"\bcan('?t|not)\s+go\s+on\s+anymore\b", re.IGNORECASE), "Hopelessness / Ideation"),
    (re.compile(r"\bdon('?t|ot)\s+want\s+to\s+live\b", re.IGNORECASE), "Suicidal Ideation"),
    (re.compile(r"\btake\s+my\s+(own\s+)?life\b", re.IGNORECASE), "Suicidal Intent"),
    
    # Active self-harm
    (re.compile(r"\bself[\s\-_]?harm\b", re.IGNORECASE), "Self-Harm"),
    (re.compile(r"\bcut(ting)?\s+myself\b", re.IGNORECASE), "Self-Harm"),
    (re.compile(r"\bslit(ting)?\s+my\s+wrists?\b", re.IGNORECASE), "Self-Harm"),
    (re.compile(r"\boverdos(e|ing)\b", re.IGNORECASE), "Self-Harm / Overdose"),
    (re.compile(r"\bhang(ing)?\s+myself\b", re.IGNORECASE), "Suicidal Intent"),
    (re.compile(r"\bjump(ing)?\s+off\s+(a\s+)?(bridge|building|roof|cliff)\b", re.IGNORECASE), "Suicidal Intent"),
    (re.compile(r"\bharm(ing)?\s+myself\b", re.IGNORECASE), "Self-Harm"),
    (re.compile(r"\bhurt(ing)?\s+myself\b", re.IGNORECASE), "Self-Harm"),
    (re.compile(r"\bpoison(ing)?\s+myself\b", re.IGNORECASE), "Self-Harm"),
    
    # Severe finality / goodbye expressions
    (re.compile(r"\bgoodbye\s+cruel\s+world\b", re.IGNORECASE), "Crisis Signpost"),
    (re.compile(r"\bthis\s+is\s+my\s+final\s+goodbye\b", re.IGNORECASE), "Crisis Signpost"),
    (re.compile(r"\bgiv(e|ing)\s+up\s+on\s+life\b", re.IGNORECASE), "Hopelessness / Crisis"),
]

CRISIS_RESPONSE_TEMPLATE = {
    "crisis_triggered": True,
    "severity": "CRITICAL",
    "message": "We care deeply about your well-being. Immediate confidential clinical support is available right now.",
    "helplines": [
        {"name": "National Mental Health Helpline", "number": "1926"},
        {"name": "Sumithrayo Sri Lanka", "number": "0112696666"}
    ]
}


def detect_crisis_risk(text: str) -> Dict[str, Any]:
    """
    Evaluates incoming student text against clinical risk detection rules
    for self-harm and suicidal ideation. Returns structured risk metadata.
    """
    if not text or not text.strip():
        return {"is_crisis": False}

    normalized_text = text.lower().strip()

    for pattern, category in CRISIS_KEYWORD_PATTERNS:
        match = pattern.search(normalized_text)
        if match:
            matched_phrase = match.group(0)
            logger.warning(
                "🚨 [CLINICAL EARLY WARNING] Triggered keyword category '%s': '%s'",
                category, matched_phrase
            )
            return {
                "is_crisis": True,
                "severity": "CRITICAL",
                "category": category,
                "matched": matched_phrase
            }

    return {"is_crisis": False}


def record_crisis_alert_in_graph(
    user_id: str,
    source: str,
    raw_content: str,
    severity: str = "CRITICAL",
    category: str = "Self-Harm/Suicidal Ideation"
) -> str:
    """
    Persists a :CrisisAlert event node linked to the user node in Neo4j,
    keeping the raw message secure and private via field-level Fernet encryption.
    """
    # Encrypt raw text securely
    encrypted_content = "REDACTED"
    try:
        from app.utils.security import encrypt_text
        encrypted_content = encrypt_text(raw_content)
    except Exception:
        try:
            from app.utils.encryption import encrypt_data
            encrypted_content = encrypt_data(raw_content)
        except Exception as enc_err:
            logger.warning("Encryption note during crisis logging: %s", enc_err)
            encrypted_content = "[ENCRYPTED_CRISIS_RECORD]"

    clean_user_id = str(user_id or "demo_user").strip()

    try:
        with get_neo4j_session() as session:
            cypher = """
            MERGE (u:User {id: $user_id})
            CREATE (alert:CrisisAlert {
                id: randomUUID(),
                source: $source,
                severity: $severity,
                category: $category,
                encrypted_content: $encrypted_content,
                timestamp: datetime()
            })
            CREATE (u)-[:TRIGGERED_CRISIS_ALERT]->(alert)
            RETURN alert.id AS id
            """
            result = session.run(
                cypher,
                user_id=clean_user_id,
                source=source,
                severity=severity,
                category=category,
                encrypted_content=encrypted_content
            ).single()

            alert_id = result.get("id") if result else "crisis-alert"
            logger.info("Successfully recorded CrisisAlert (%s) in Neo4j for user %s", alert_id, clean_user_id)
            return alert_id
    except Exception as err:
        logger.error("Failed to record CrisisAlert in Neo4j: %s", err)
        return "crisis-alert-fallback"
