import os
import json
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from google import genai
from dotenv import load_dotenv

from app.db.neo4j import get_neo4j_session, save_chat_to_graph
from app.services.profiling_agent import get_student_profile_summary
from app.utils.encryption import encrypt_data
from app.services.therapy_agent import infer_suggested_tool

load_dotenv()

logger = logging.getLogger("mindcare.agent_services")

router = APIRouter(prefix="/api/agent", tags=["Academic Agent Services"])

# Gemini Client Initialization
try:
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=gemini_api_key, http_options={'timeout': 30000}) if gemini_api_key else None
except Exception as init_err:
    logger.warning("Failed to initialize genai Client: %s", init_err)
    client = None

# Primary High-Availability Model Configuration (aligned with therapy_agent and journal)
PRIMARY_MODEL = "gemini-flash-lite-latest"
FALLBACK_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-flash-latest"
]
DEFAULT_GEMINI_MODEL = PRIMARY_MODEL

# Model Sequence prioritizing available quota models
MODELS_TO_TRY = [PRIMARY_MODEL] + [m for m in FALLBACK_MODELS if m != PRIMARY_MODEL]

def call_gemini_with_fallback(prompt: str, target_model: Optional[str] = None) -> str:
    """
    Attempts to generate content using Gemini with an automatic retry / fallback mechanism.
    Strictly prioritizes the high-quota flash-lite model (PRIMARY_MODEL = "gemini-flash-lite-latest").
    Automatically tests both standard and qualified string formats across FALLBACK_MODELS.
    Tries modern google-genai Client, with legacy GenerativeModel as backup if client is uninitialized.
    """
    global client
    if client is None:
        gemini_key = os.getenv("GEMINI_API_KEY")
        if gemini_key:
            try:
                client = genai.Client(api_key=gemini_key, http_options={'timeout': 30000})
            except Exception as e:
                logger.debug("Client re-init failed: %s", e)

    last_error = None
    models_to_test = [target_model] + [m for m in MODELS_TO_TRY if m != target_model] if target_model else MODELS_TO_TRY
    for base_model in models_to_test:
        # Build format variations: e.g. "gemini-flash-latest" and "models/gemini-flash-latest"
        model_variants = [base_model]
        if not base_model.startswith("models/"):
            model_variants.append(f"models/{base_model}")
        else:
            model_variants.append(base_model.replace("models/", ""))

        for model_name in model_variants:
            # 1. Primary: Modern google-genai Client
            if client:
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=prompt
                    )
                    if response and response.text:
                        return response.text.strip()
                except Exception as e:
                    err_str = str(e)
                    logger.debug("Model %s failed via client: %s. Trying next...", model_name, err_str)
                    last_error = e
                    # If Google API explicitly answered with 404, 503, or 429, the model itself is unavailable
                    if "404" in err_str or "503" in err_str or "429" in err_str:
                        break
                    continue

            # 2. Secondary: Legacy GenerativeModel if modern client is unavailable
            try:
                import google.generativeai as legacy_genai
                api_key = os.getenv("GEMINI_API_KEY")
                if api_key:
                    legacy_genai.configure(api_key=api_key)
                    m = legacy_genai.GenerativeModel(model_name)
                    res = m.generate_content(prompt)
                    if res and res.text:
                        return res.text.strip()
            except Exception as e2:
                logger.debug("Legacy model %s failed: %s. Trying next...", model_name, e2)
                last_error = e2

    if last_error:
        raise last_error
    raise RuntimeError("All Gemini models in MODELS_TO_TRY failed.")


def get_dynamic_offline_cbt(topic: str) -> Dict[str, str]:
    """
    Topic-aware clinical reframe baseline used when models/network are offline.
    """
    topic_lower = (topic or "").lower()
    if "exam" in topic_lower:
        return {
            "thought_identification": "Anticipatory Exam Dread & Catastrophic Failure Projection",
            "reality_check": "What concrete evidence proves that past preparation is insufficient for this single assessment?",
            "cognitive_reframe": "An examination is an isolated evaluation of specific syllabus recall, not an indictment of your cumulative intelligence."
        }
    elif "deadline" in topic_lower or "coursework" in topic_lower or "assignment" in topic_lower:
        return {
            "thought_identification": "Temporal Myopia & Urgent Time-Scarcity Panic",
            "reality_check": "When deconstructed into 30-minute intervals, what is the exact tangible work remaining?",
            "cognitive_reframe": "Deadlines indicate priority sequencing, not capacity limits. Executing one micro-task neutralizes urgency."
        }
    else:
        return {
            "thought_identification": "Academic Imposter Syndrome & Generalized Inadequacy",
            "reality_check": "Have past academic milestones been achieved purely by chance, or through documented effort?",
            "cognitive_reframe": "Experiencing cognitive friction is a normal biological symptom of intellectual expansion, not incompetence."
        }


# --- PYDANTIC SCHEMAS ---

class DecomposeTaskRequest(BaseModel):
    user_id: str = Field(..., min_length=1, description="Authenticated User ID")
    subject_id: str = Field(..., min_length=1, description="Target Subject ID or Name")
    assignment_text: str = Field(..., min_length=1, description="Coursework requirements or topic")


class CBTChatRequest(BaseModel):
    user_id: Optional[str] = Field(default="demo_user", description="Authenticated User ID")
    context_chip: Optional[str] = Field(default=None, description="Selected clinical focus chip")
    message: str = Field(..., min_length=1, description="Student thought or feeling")


# --- 1. ACADEMIC TASK DECOMPOSER ---

@router.post("/decompose-task")
def decompose_academic_task(payload: DecomposeTaskRequest):
    """
    Deconstructs bulky assignment requirements into 3-5 manageable micro-tasks
    adapted to the user's real-time stress score and sleep hours from Neo4j.
    Creates (:SubjectTopic) nodes linked to the target (:AcademicSubject).
    """
    user_id = str(payload.user_id).strip()
    subject_id = str(payload.subject_id).strip()
    assignment_text = payload.assignment_text.strip()

    if not assignment_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assignment text cannot be empty.")

    current_stress = 5.0
    sleep_hours = 7.0

    # 1. Retrieve user's latest biometrics from Neo4j
    try:
        with get_neo4j_session() as session:
            biometrics_query = """
            MATCH (u:User {id: $user_id})
            OPTIONAL MATCH (u)-[:LOGGED_MOOD]->(m:MoodLog)
            WITH u, m ORDER BY m.timestamp DESC LIMIT 1
            RETURN coalesce(m.stress_score, 5) AS current_stress, coalesce(m.sleep_hours, 7) AS sleep_hours
            """
            bio_res = session.run(biometrics_query, user_id=user_id).single()
            if bio_res:
                current_stress = float(bio_res["current_stress"])
                sleep_hours = float(bio_res["sleep_hours"])
    except Exception as db_err:
        logger.warning("Biometrics retrieval fallback for %s: %s", user_id, db_err)

    # 2. Prompt Google Gemini API to deconstruct the specific coursework
    prompt = f"""
    You are an Academic Task Decomposer Agent.
    Deconstruct the following specific coursework/assignment:
    "{assignment_text}"

    Context:
    - Target Subject: {subject_id}
    - Current Student Stress: {current_stress}/10
    - Sleep Hours: {sleep_hours}h

    Generate 3 to 5 highly specific, actionable micro-tasks (30-45 minutes each) tailored directly to the subject matter of this assignment. Do NOT return generic placeholder text.

    Return strictly a valid JSON array of strings, for example:
    ["Implement DP state transitions and memoization table", "Write unit tests for edge cases and time complexity", ...]
    No markdown formatting or extra text.
    """

    micro_tasks: List[str] = []
    try:
        raw_text = call_gemini_with_fallback(prompt)
        if raw_text:
            clean_json = raw_text
            if "```" in clean_json:
                clean_json = clean_json.replace("```json", "").replace("```", "").strip()

            parsed = json.loads(clean_json)
            if isinstance(parsed, list) and len(parsed) > 0:
                raw_items = [str(item).strip() for item in parsed if str(item).strip()][:5]
                seen_tasks = set()
                micro_tasks = []
                for item in raw_items:
                    k = item.lower()
                    if k not in seen_tasks:
                        seen_tasks.add(k)
                        micro_tasks.append(item)
    except Exception as ai_err:
        logger.warning("Gemini task decomposition error: %s", ai_err)

    # Fallback to subject-matter tailored steps if AI connection encounters latency
    if not micro_tasks:
        clean_name = assignment_text.replace('\n', ' ').strip()
        micro_tasks = [
            f"Analyze core requirements and parameters for {clean_name[:40]}",
            f"Develop architectural model and solution approach for {clean_name[:40]}",
            f"Implement primary logic and modules for {clean_name[:40]}",
            f"Verify test cases and edge constraints for {clean_name[:40]}"
        ]
    else:
        # Guarantee uniqueness across fallback / parsed tasks
        seen_tasks = set()
        unique_micro = []
        for item in micro_tasks:
            k = item.strip().lower()
            if k and k not in seen_tasks:
                seen_tasks.add(k)
                unique_micro.append(item.strip())
        micro_tasks = unique_micro

    # 3. Dynamically persist (:SubjectTopic) nodes linked to the subject in Neo4j
    created_topics: List[Dict[str, Any]] = []
    matched_subject_id = subject_id
    try:
        with get_neo4j_session() as session:
            persist_query = """
            MATCH (s:AcademicSubject)
            WHERE s.id = $subject_id OR s.name = $subject_id
            WITH s LIMIT 1
            UNWIND $steps AS task_name
            CREATE (t:SubjectTopic {
                id: randomUUID(),
                name: task_name,
                completed: false,
                priority: 1,
                created_at: datetime()
            })
            CREATE (s)-[:HAS_TOPIC]->(t)
            RETURN s.id AS subject_id, s.name AS subject_name, collect({
                id: t.id,
                name: t.name,
                completed: t.completed,
                priority: t.priority
            }) AS topics
            """
            res = session.run(persist_query, subject_id=subject_id, steps=micro_tasks).single()
            if res and res["topics"]:
                matched_subject_id = res["subject_id"]
                created_topics = res["topics"]
            else:
                # If subject not found, match or merge subject and link topics
                merge_query = """
                MERGE (s:AcademicSubject {id: $subject_id})
                ON CREATE SET s.name = $subject_id, s.target_grade = 'A+', s.difficulty = 'Medium', s.created_at = datetime()
                WITH s
                UNWIND $steps AS task_name
                CREATE (t:SubjectTopic {
                    id: randomUUID(),
                    name: task_name,
                    completed: false,
                    priority: 1,
                    created_at: datetime()
                })
                CREATE (s)-[:HAS_TOPIC]->(t)
                RETURN s.id AS subject_id, s.name AS subject_name, collect({
                    id: t.id,
                    name: t.name,
                    completed: t.completed,
                    priority: t.priority
                }) AS topics
                """
                merge_res = session.run(merge_query, subject_id=subject_id, steps=micro_tasks).single()
                if merge_res and merge_res["topics"]:
                    matched_subject_id = merge_res["subject_id"]
                    created_topics = merge_res["topics"]
                else:
                    import uuid
                    created_topics = [
                        {"id": str(uuid.uuid4()), "name": task, "completed": False, "priority": 1}
                        for task in micro_tasks
                    ]
    except Exception as db_persist_err:
        logger.error("Neo4j SubjectTopic persistence error: %s", db_persist_err)
        import uuid
        created_topics = [
            {"id": str(uuid.uuid4()), "name": task, "completed": False, "priority": 1}
            for task in micro_tasks
        ]

    return {
        "status": "success",
        "subject_id": matched_subject_id,
        "current_stress": current_stress,
        "sleep_hours": sleep_hours,
        "tasks": micro_tasks,
        "created_topics": created_topics
    }


# --- 2. CLINICAL CBT REFRAMING ---

def clean_conversational_intro(text: str) -> str:
    """Strips generic conversational intros and preambles from CBT outputs."""
    if not text:
        return ""
    import re
    cleaned = re.sub(
        r"^(hey[,!\s]+(it'?s\s+totally\s+normal\s+to\s+feel\s+that\s+way[,!\s]*)?|hello[,!\s]+|hi[,!\s]+|it'?s\s+totally\s+normal\s+to\s+feel\s+that\s+way[,!\s]*|it\s+is\s+(completely\s+)?normal\s+to\s+feel\s+that\s+way[,!\s]*|i\s+understand\s+(how\s+you\s+feel|your\s+frustration|your\s+anxiety)[,!\s]*|don'?t\s+worry[,!\s]*|as\s+an\s+ai[,!\s]*)",
        "",
        text,
        flags=re.IGNORECASE
    ).strip()
    return cleaned


@router.post("/cbt-chat")
def cbt_reframing_chat(payload: CBTChatRequest):
    """
    Generates a structured, evidence-based 3-part CBT reframe:
    1. Thought Identification (Detect cognitive distortions like catastrophizing)
    2. Reality & Evidence Check (Grounding counter-questions)
    3. Cognitive Reframe (Constructive, realistic reframing)
    Tone: Clinical, grounded, professional, under 120 words, strictly no robotic or conversational greetings.
    """
    user_message = payload.message.strip()
    if not user_message:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message cannot be empty.")

    # Clinical Early Warning / Crisis Risk Interception
    try:
        from app.services.crisis_service import detect_crisis_risk, record_crisis_alert_in_graph, CRISIS_RESPONSE_TEMPLATE
        risk = detect_crisis_risk(user_message)
        if risk.get("is_crisis"):
            record_crisis_alert_in_graph(
                user_id=payload.user_id or "demo_user",
                source="CBT Chat Intervention",
                raw_content=user_message,
                severity=risk.get("severity", "CRITICAL"),
                category=risk.get("category", "Crisis Intervention")
            )
            return {
                "status": "crisis",
                "crisis_triggered": True,
                **CRISIS_RESPONSE_TEMPLATE,
                "thought_identification": "Severe Crisis / Immediate Risk",
                "reality_check": "Immediate confidential clinical support is prioritized over cognitive reframing.",
                "cognitive_reframe": CRISIS_RESPONSE_TEMPLATE["message"],
                "reply": CRISIS_RESPONSE_TEMPLATE["message"]
            }
    except Exception as crisis_err:
        logger.warning("Crisis check error in cbt_chat: %s", crisis_err)

    target_topic = (payload.context_chip or payload.message).strip()
    clean_user_id = str(payload.user_id or "demo_user").strip()

    # Retrieve Longitudinal Context from Profiling Agent
    student_context = get_student_profile_summary(clean_user_id)

    cbt_prompt = f"""
    You are a Clinical CBT Specialist for university students in Sri Lanka.
    Active Specialized Agent: CBT Clinical Agent
    The student selected or expressed the topic: '{target_topic}'.

    --- STUDENT LONGITUDINAL PROFILE (From Neo4j) ---
    {student_context}

    --- STUDENT'S INPUT ---
    "{user_message}"
    
    Generate a distinct, clinically precise CBT reframe specifically tailored to '{target_topic}'.
    - If Exam Anxiety: target anticipatory failure and test distress.
    - If Deadline Pressure: target urgency panic, cognitive chunking, and time scarcity.
    - If Self-Doubt: target imposter syndrome and capability verification.
    - If Sleep & Burnout: target restorative cognitive boundary setting and nervous system reset.

    Return strictly a JSON object:
    {{
      "thought_identification": "Concise distortion name and academic context",
      "reality_check": "One precise, grounding empirical reality check question",
      "cognitive_reframe": "One empowering, realistic, evidence-based reframing sentence"
    }}
    """

    # Dynamic topic-tailored offline baseline
    offline_cbt = get_dynamic_offline_cbt(target_topic)
    thought_id = offline_cbt["thought_identification"]
    reality_check = offline_cbt["reality_check"]
    cognitive_reframe = offline_cbt["cognitive_reframe"]

    try:
        raw_text = call_gemini_with_fallback(cbt_prompt)
        if raw_text:
            clean_json = raw_text
            if "```" in clean_json:
                clean_json = clean_json.replace("```json", "").replace("```", "").strip()

            parsed = json.loads(clean_json)
            if isinstance(parsed, dict):
                thought_id = clean_conversational_intro(parsed.get("thought_identification", thought_id))
                reality_check = clean_conversational_intro(parsed.get("reality_check", reality_check))
                cognitive_reframe = clean_conversational_intro(parsed.get("cognitive_reframe", cognitive_reframe))
    except Exception as parse_err:
        logger.warning("CBT generation failed across models, utilizing dynamic offline CBT: %s", parse_err)

    reply = clean_conversational_intro(
        f"1. Thought Identification: {thought_id}\n2. Reality Check: {reality_check}\n3. Cognitive Reframe: {cognitive_reframe}"
    )

    suggested_tool = infer_suggested_tool(f"{target_topic} {user_message} {thought_id}")

    # Encrypt and persist interaction to Neo4j
    try:
        encrypted_user = encrypt_data(user_message)
        encrypted_reply = encrypt_data(reply)
        save_chat_to_graph(clean_user_id, encrypted_user, encrypted_reply, "CBT_REFRAME", "Reflective")
    except Exception as db_e:
        logger.warning("Failed to save CBT interaction to Neo4j: %s", db_e)

    return {
        "status": "success",
        "agent_used": "CBT Clinical Agent",
        "suggested_tool": suggested_tool,
        "thought_identification": thought_id,
        "reality_check": reality_check,
        "cognitive_reframe": cognitive_reframe,
        "reply": reply
    }
