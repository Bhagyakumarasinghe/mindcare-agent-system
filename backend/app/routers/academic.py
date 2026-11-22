import logging
import uuid
from datetime import datetime, date
from typing import List, Optional, Any, Union, Dict
from pydantic import BaseModel, Field
from fastapi import APIRouter, Query, HTTPException, status
from app.db.neo4j import get_neo4j_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/academic", tags=["Academic Cognitive Pacing"])

# --- PYDANTIC SCHEMAS ---

class TopicInput(BaseModel):
    name: str = Field(..., min_length=1)
    completed: bool = False
    priority: int = Field(default=1, ge=1, le=5)

class SubjectCreate(BaseModel):
    user_id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    target_grade: str = Field(default="A+")
    difficulty: str = Field(default="High")  # "High", "Medium", "Low"
    exam_date: str = Field(default="2026-11-25")  # YYYY-MM-DD
    topics: Optional[List[Any]] = []

class TopicToggle(BaseModel):
    user_id: str
    subject_id: str
    topic_name: str
    completed: bool

# --- HELPER FUNCTIONS ---

def calculate_days_remaining(exam_date_str: str) -> int:
    try:
        clean_date = str(exam_date_str).split("T")[0].strip()
        exam_dt = datetime.strptime(clean_date, "%Y-%m-%d").date()
        delta = (exam_dt - date.today()).days
        return max(0, delta)
    except Exception:
        return 14

def compute_cognitive_load(difficulty: str, days_remaining: int, completion_pct: float, stress_score: float) -> dict:
    diff_weights = {"High": 8.5, "Medium": 5.5, "Low": 3.0}
    base_weight = diff_weights.get(difficulty, 5.0)

    # Urgency multiplier: <= 7 days elevates pressure; > 21 days allows steady pacing
    urgency_mult = 1.3 if days_remaining <= 7 else (1.1 if days_remaining <= 14 else 0.9)
    work_factor = (100.0 - completion_pct) / 100.0

    raw_load = (base_weight * urgency_mult * (0.6 + 0.4 * work_factor)) + (stress_score * 2.0)
    final_score = round(min(10.0, max(1.0, raw_load)), 1)

    if final_score >= 7.5:
        level = "High Load"
        color = "#DC2626"
    elif final_score >= 4.5:
        level = "Moderate Load"
        color = "#D97706"
    else:
        level = "Optimal Load"
        color = "#0D9488"

    return {
        "score": final_score,
        "level": level,
        "color": color
    }

DEFAULT_SEED_SUBJECTS = [
    {
        "name": "Advanced Algorithms & Optimization",
        "target_grade": "A+",
        "difficulty": "High",
        "exam_offset_days": 18,
        "topics": [
            {"name": "Dynamic Programming & State Compression", "completed": True, "priority": 1},
            {"name": "Graph Theory & Max-Flow Min-Cut", "completed": True, "priority": 1},
            {"name": "NP-Completeness & Approximation Schemes", "completed": False, "priority": 2},
            {"name": "Amortized Analysis & Fibonacci Heaps", "completed": False, "priority": 3},
        ]
    },
    {
        "name": "Biomedical Signal Processing & AI",
        "target_grade": "A+",
        "difficulty": "Medium",
        "exam_offset_days": 28,
        "topics": [
            {"name": "Fourier & Wavelet Transforms for ECG", "completed": True, "priority": 1},
            {"name": "Autonomic Nervous System Biometrics", "completed": False, "priority": 2},
            {"name": "Deep Latent Feature Extraction", "completed": False, "priority": 3},
        ]
    },
    {
        "name": "Distributed Systems & Fault Tolerance",
        "target_grade": "A+",
        "difficulty": "High",
        "exam_offset_days": 12,
        "topics": [
            {"name": "Raft Consensus & Log Compaction", "completed": False, "priority": 1},
            {"name": "CAP Theorem & Partition Healing", "completed": True, "priority": 2},
            {"name": "Vector Clocks & Distributed Tracing", "completed": False, "priority": 3},
        ]
    }
]

def seed_default_subjects(session, clean_user_id: str):
    """Seed initial academic subjects for a user if none exist."""
    try:
        from datetime import timedelta
        for sub in DEFAULT_SEED_SUBJECTS:
            exam_d = (date.today() + timedelta(days=sub["exam_offset_days"])).isoformat()
            sub_id = str(uuid.uuid4())
            session.run("""
                MATCH (u:User {id: $user_id})
                MERGE (s:AcademicSubject {name: $name, user_id: $user_id})
                ON CREATE SET 
                    s.id = $sub_id,
                    s.target_grade = $target_grade,
                    s.difficulty = $difficulty,
                    s.exam_date = $exam_date,
                    s.created_at = datetime()
                MERGE (u)-[:STUDIES]->(s)
            """, user_id=clean_user_id, sub_id=sub_id, name=sub["name"],
                 target_grade=sub["target_grade"], difficulty=sub["difficulty"], exam_date=exam_d)

            for top in sub["topics"]:
                top_id = str(uuid.uuid4())
                session.run("""
                    MATCH (s:AcademicSubject {name: $sub_name, user_id: $user_id})
                    MERGE (t:SubjectTopic {name: $top_name, subject_id: s.id})
                    ON CREATE SET
                        t.id = $top_id,
                        t.completed = $completed,
                        t.priority = $priority
                    MERGE (s)-[:HAS_TOPIC]->(t)
                """, user_id=clean_user_id, sub_name=sub["name"],
                     top_name=top["name"], top_id=top_id,
                     completed=top["completed"], priority=top["priority"])
    except Exception as e:
        logger.warning("Could not auto-seed subjects for %s: %s", clean_user_id, e)

# --- ENDPOINTS ---

@router.get("/pacing")
def get_academic_pacing(user_id: str = Query(..., description="User ID in Neo4j")):
    """
    Computes an adaptive academic study-to-break rhythm based on
    the user's latest stress assessment and biometric baseline (sleep duration, study load).
    Persists recommendation to Neo4j and returns pacing parameters.
    """
    clean_user_id = str(user_id).strip()
    if not clean_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id query parameter is required"
        )

    try:
        with get_neo4j_session() as session:
            query_baseline = """
            MERGE (u:User {id: $user_id})
            WITH u
            OPTIONAL MATCH (u)-[:RECORDED_ASSESSMENT]->(s:StressAssessment)
            WITH u, s ORDER BY s.timestamp DESC LIMIT 1
            OPTIONAL MATCH (u)-[:LOGGED_MOOD]->(m:MoodLog)
            WITH u, s, m ORDER BY m.timestamp DESC LIMIT 1
            RETURN 
                s.level AS stress_level,
                s.stress_score AS raw_stress_score,
                s.confidence AS stress_confidence,
                m.sleep_hours AS mood_sleep,
                m.stress_level AS mood_stress
            """
            record = session.run(query_baseline, user_id=clean_user_id).single()

            stress_score = None
            stress_level = None
            sleep_hours = 7.0

            if record:
                stress_level = record.get("stress_level")
                raw_score = record.get("raw_stress_score")
                if raw_score is not None:
                    try:
                        stress_score = float(raw_score)
                        if stress_score > 1.0:
                            stress_score = min(1.0, stress_score / 10.0)
                    except (ValueError, TypeError):
                        stress_score = None

                mood_sleep = record.get("mood_sleep")
                if mood_sleep is not None:
                    try:
                        sleep_hours = float(mood_sleep)
                    except (ValueError, TypeError):
                        pass

                mood_stress = record.get("mood_stress")
                if stress_score is None and mood_stress is not None:
                    try:
                        stress_score = min(1.0, float(mood_stress) / 10.0)
                    except (ValueError, TypeError):
                        pass

            if stress_score is None:
                if stress_level == "High":
                    stress_score = 0.82
                elif stress_level == "Low":
                    stress_score = 0.25
                else:
                    stress_score = 0.50

            if stress_score >= 0.7 or sleep_hours < 6.0:
                focus_min = 25
                break_min = 10
                status_label = "Cognitive Decompression"
                guidance_tip = "High cognitive strain or sleep deficit detected. Maintain 25m focused intervals followed by 10m deep autonomic decompression to protect working memory."
            elif stress_score >= 0.4:
                focus_min = 35
                break_min = 8
                status_label = "Cognitive Reset"
                guidance_tip = "Moderate cognitive tension. Adopt a 35m focus rhythm with 8m active resets to preserve sustained attention and executive stamina."
            else:
                focus_min = 50
                break_min = 10
                status_label = "Restorative Break"
                guidance_tip = "Optimal autonomic balance and rest. Leverage 50m deep work blocks paired with 10m restorative breaks for peak academic performance."

            # Ensure baseline StressAssessment exists & persist
            ensure_assessment_query = """
            MATCH (u:User {id: $user_id})
            OPTIONAL MATCH (u)-[:RECORDED_ASSESSMENT]->(a:StressAssessment)
            WITH u, a
            WHERE a IS NULL
            CREATE (initial_a:StressAssessment {
                id: randomUUID(),
                level: CASE WHEN $stress_score >= 0.7 THEN 'High' WHEN $stress_score >= 0.4 THEN 'Moderate' ELSE 'Low' END,
                stress_score: $stress_score,
                timestamp: datetime()
            })
            CREATE (u)-[:RECORDED_ASSESSMENT]->(initial_a)
            RETURN initial_a
            """
            session.run(ensure_assessment_query, user_id=clean_user_id, stress_score=stress_score)

            persist_query = """
            MATCH (u:User {id: $user_id})-[:RECORDED_ASSESSMENT]->(a:StressAssessment)
            WITH a ORDER BY a.timestamp DESC LIMIT 1
            SET a.stress_score = coalesce(a.stress_score, $stress_score)
            CREATE (p:AcademicPacing {
                id: randomUUID(),
                focus_minutes: $focus_min,
                break_minutes: $break_min,
                stress_index: a.stress_score,
                timestamp: datetime()
            })
            CREATE (a)-[:OPTIMIZES_FOR_ACADEMICS]->(p)
            RETURN p
            """
            session.run(
                persist_query,
                user_id=clean_user_id,
                focus_min=int(focus_min),
                break_min=int(break_min),
                stress_score=float(stress_score)
            )

            logger.info("Academic pacing persisted for user %s: %sm focus / %sm break",
                        clean_user_id, focus_min, break_min)

            return {
                "focus_minutes": int(focus_min),
                "break_minutes": int(break_min),
                "status_label": status_label,
                "guidance_tip": guidance_tip
            }

    except Exception as e:
        logger.error("Academic pacing error for user %s: %s", clean_user_id, e)
        return {
            "focus_minutes": 35,
            "break_minutes": 8,
            "status_label": "Cognitive Reset",
            "guidance_tip": "Balanced cognitive pacing active. 35m focus intervals with 8m restorative breaks maintain cognitive flow."
        }


@router.get("/subjects")
def get_user_academic_subjects(user_id: str = Query(..., description="User ID in Neo4j")):
    """
    Returns user's academic subjects, completion percentage towards target grade A+,
    days remaining to exam, and dynamic cognitive load score.
    """
    clean_user_id = str(user_id).strip()
    if not clean_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id is required")

    try:
        with get_neo4j_session() as session:
            # Check user baseline stress score
            baseline_record = session.run("""
                MERGE (u:User {id: $user_id})
                WITH u
                OPTIONAL MATCH (u)-[:RECORDED_ASSESSMENT]->(a:StressAssessment)
                WITH a ORDER BY a.timestamp DESC LIMIT 1
                RETURN coalesce(a.stress_score, 0.5) AS stress_score
            """, user_id=clean_user_id).single()
            stress_score = float(baseline_record["stress_score"]) if baseline_record else 0.5
            if stress_score > 1.0:
                stress_score = min(1.0, stress_score / 10.0)

            # Query existing subjects
            subjects_query = """
            MATCH (u:User {id: $user_id})-[:STUDIES]->(s:AcademicSubject)
            OPTIONAL MATCH (s)-[:HAS_TOPIC]->(t:SubjectTopic)
            WITH s, t ORDER BY t.priority ASC, t.name ASC
            WITH s, collect(t) AS topics
            RETURN 
                s.id AS id,
                s.name AS name,
                coalesce(s.target_grade, 'A+') AS target_grade,
                coalesce(s.difficulty, 'High') AS difficulty,
                coalesce(s.exam_date, '2026-11-20') AS exam_date,
                [top IN topics WHERE top IS NOT NULL | {
                    id: coalesce(top.id, randomUUID()),
                    name: top.name,
                    completed: coalesce(top.completed, false),
                    priority: coalesce(top.priority, 1)
                }] AS topics
            """
            results = session.run(subjects_query, user_id=clean_user_id).data()

            output = []
            for item in results:
                topics_list = item.get("topics", [])
                total_topics = len(topics_list)
                completed_topics = sum(1 for t in topics_list if t.get("completed") is True)
                completion_pct = round((completed_topics / total_topics) * 100) if total_topics > 0 else 0

                days_rem = calculate_days_remaining(item.get("exam_date", ""))
                cog_load = compute_cognitive_load(
                    difficulty=item.get("difficulty", "High"),
                    days_remaining=days_rem,
                    completion_pct=completion_pct,
                    stress_score=stress_score
                )

                output.append({
                    "id": item.get("id"),
                    "name": item.get("name"),
                    "target_grade": item.get("target_grade", "A+"),
                    "difficulty": item.get("difficulty", "High"),
                    "exam_date": item.get("exam_date"),
                    "days_remaining": days_rem,
                    "completion_percentage": completion_pct,
                    "completed_topics_count": completed_topics,
                    "total_topics_count": total_topics,
                    "cognitive_load": cog_load,
                    "topics": topics_list
                })

            return {
                "user_id": clean_user_id,
                "subjects": output
            }

    except Exception as e:
        logger.error("Error fetching academic subjects for user %s: %s", clean_user_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch academic subjects: {str(e)}"
        )


@router.post("/subjects")
def create_user_academic_subject(payload: SubjectCreate):
    """
    Creates a new AcademicSubject node for the user in Neo4j,
    links topics via UNWIND, and links latest StressAssessment.
    """
    clean_user_id = str(payload.user_id).strip()
    clean_name = payload.name.strip()
    if not clean_user_id or not clean_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id and subject name are required"
        )

    # Sanitize topics into list of non-empty strings
    clean_topics: List[str] = []
    for t in payload.topics or []:
        if isinstance(t, str) and t.strip():
            clean_topics.append(t.strip())
        elif isinstance(t, dict) and t.get("name") and str(t["name"]).strip():
            clean_topics.append(str(t["name"]).strip())
        elif hasattr(t, "name") and t.name and str(t.name).strip():
            clean_topics.append(str(t.name).strip())

    if not clean_topics:
        clean_topics = ["Core Foundations & Key Concepts"]

    exam_date_str = str(payload.exam_date).strip() if payload.exam_date else "2026-11-25"
    difficulty = payload.difficulty or "High"

    try:
        with get_neo4j_session() as session:
            cypher = """
            MERGE (u:User {id: $user_id})
            CREATE (s:AcademicSubject {
                id: randomUUID(),
                name: $name,
                target_grade: "A+",
                difficulty: $difficulty,
                exam_date: $exam_date,
                created_at: datetime()
            })
            CREATE (u)-[:STUDIES]->(s)
            WITH s
            UNWIND $topics AS topic_name
            CREATE (t:SubjectTopic {
                id: randomUUID(),
                name: topic_name,
                completed: false,
                priority: 1
            })
            CREATE (s)-[:HAS_TOPIC]->(t)
            WITH s, collect({
                id: t.id,
                name: t.name,
                completed: t.completed,
                priority: t.priority
            }) AS topics_list
            RETURN s.id AS id,
                   s.name AS name,
                   coalesce(s.target_grade, 'A+') AS target_grade,
                   coalesce(s.difficulty, 'High') AS difficulty,
                   coalesce(s.exam_date, $exam_date) AS exam_date,
                   topics_list AS topics
            """
            result = session.run(
                cypher,
                user_id=clean_user_id,
                name=clean_name,
                difficulty=difficulty,
                exam_date=exam_date_str,
                topics=clean_topics
            ).single()

            if not result:
                raise HTTPException(status_code=500, detail="Failed to persist subject node.")

            sub_id = result["id"]
            created_topics = result["topics"]

            # Connect latest StressAssessment via (a:StressAssessment)-[:ADAPTS_PACING]->(s)
            session.run("""
                MATCH (u:User {id: $user_id})-[:RECORDED_ASSESSMENT]->(a:StressAssessment)
                WITH a ORDER BY a.timestamp DESC LIMIT 1
                MATCH (s:AcademicSubject {id: $sub_id})
                MERGE (a)-[r:ADAPTS_PACING]->(s)
                ON CREATE SET r.timestamp = datetime()
            """, user_id=clean_user_id, sub_id=sub_id)

            days_rem = calculate_days_remaining(exam_date_str)
            cog_load = compute_cognitive_load(
                difficulty=difficulty,
                days_remaining=days_rem,
                completion_pct=0,
                stress_score=0.5
            )

            return {
                "message": "Academic subject enrolled successfully",
                "subject": {
                    "id": sub_id,
                    "name": result["name"],
                    "target_grade": result["target_grade"],
                    "difficulty": result["difficulty"],
                    "exam_date": result["exam_date"],
                    "days_remaining": days_rem,
                    "completion_percentage": 0,
                    "completed_topics_count": 0,
                    "total_topics_count": len(created_topics),
                    "cognitive_load": cog_load,
                    "topics": created_topics
                }
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating academic subject: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create academic subject: {str(e)}"
        )


@router.patch("/topics/{topic_id}/toggle")
def toggle_topic_by_id(topic_id: str):
    """
    Toggles topic completion status using topic_id and recalculates subject progress percentage.
    """
    clean_top_id = str(topic_id).strip()
    if not clean_top_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="topic_id is required")

    try:
        with get_neo4j_session() as session:
            cypher = """
            MATCH (t:SubjectTopic {id: $topic_id})<-[:HAS_TOPIC]-(s:AcademicSubject)
            SET t.completed = NOT t.completed
            WITH s, t
            MATCH (s)-[:HAS_TOPIC]->(all_t:SubjectTopic)
            WITH s, t, count(all_t) AS totalTopics, count(CASE WHEN all_t.completed THEN 1 END) AS completedTopics
            RETURN s.id AS subject_id,
                   t.id AS topic_id,
                   t.completed AS completed,
                   totalTopics,
                   completedTopics,
                   round((toFloat(completedTopics) / toFloat(totalTopics)) * 100) AS progress_percentage
            """
            record = session.run(cypher, topic_id=clean_top_id).single()
            if not record:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic or parent subject not found")

            return {
                "status": "success",
                "subject_id": record["subject_id"],
                "topic_id": record["topic_id"],
                "completed": record["completed"],
                "total_topics": record["totalTopics"],
                "completed_topics": record["completedTopics"],
                "progress_percentage": record["progress_percentage"]
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error toggling topic by ID %s: %s", clean_top_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to toggle topic: {str(e)}"
        )


@router.delete("/subjects/{subject_id}")
def delete_academic_subject(subject_id: str):
    """
    Deletes an AcademicSubject node and its related SubjectTopic nodes from Neo4j.
    """
    clean_sub_id = str(subject_id).strip()
    if not clean_sub_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="subject_id is required")

    try:
        with get_neo4j_session() as session:
            cypher = """
            MATCH (s:AcademicSubject {id: $subject_id})
            OPTIONAL MATCH (s)-[:HAS_TOPIC]->(t:SubjectTopic)
            DETACH DELETE s, t
            """
            session.run(cypher, subject_id=clean_sub_id)
            return {
                "status": "success",
                "message": "Subject and related topics deleted successfully",
                "subject_id": clean_sub_id
            }
    except Exception as e:
        logger.error("Error deleting academic subject %s: %s", clean_sub_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete academic subject: {str(e)}"
        )


@router.post("/topics/toggle")
def toggle_subject_topic(payload: TopicToggle):
    """
    Toggles topic completion status for an academic subject and recalculates subject mastery.
    """
    clean_user_id = str(payload.user_id).strip()
    clean_sub_id = str(payload.subject_id).strip()
    clean_top_name = str(payload.topic_name).strip()

    try:
        with get_neo4j_session() as session:
            session.run("""
                MATCH (s:AcademicSubject {id: $sub_id})-[:HAS_TOPIC]->(t:SubjectTopic {name: $top_name})
                SET t.completed = $completed
            """, sub_id=clean_sub_id, top_name=clean_top_name, completed=payload.completed)

            # Re-fetch topics for updated completion
            res = session.run("""
                MATCH (s:AcademicSubject {id: $sub_id})-[:HAS_TOPIC]->(t:SubjectTopic)
                RETURN count(t) AS total, sum(CASE WHEN t.completed = true THEN 1 ELSE 0 END) AS completed
            """, sub_id=clean_sub_id).single()

            total = res["total"] if res else 0
            comp = res["completed"] if res else 0
            new_pct = round((comp / total) * 100) if total > 0 else 0

            return {
                "status": "success",
                "subject_id": clean_sub_id,
                "topic_name": clean_top_name,
                "completed": payload.completed,
                "new_completion_percentage": new_pct
            }

    except Exception as e:
        logger.error("Error toggling topic: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to toggle topic: {str(e)}"
        )


@router.get("/recommendation")
def get_academic_recommendation(user_id: str = Query(..., description="User ID in Neo4j")):
    """
    Evaluates user's latest stress assessment + sleep duration against pending high-difficulty subjects:
    - High Stress or Sleep < 6h: Recommend low-cognitive module or structured break.
    - Optimal Stress & Good Sleep: Recommend highest priority high-difficulty module for deep focus.
    - Moderate Stress: Balanced pacing block.
    """
    clean_user_id = str(user_id).strip()
    if not clean_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id is required")

    try:
        with get_neo4j_session() as session:
            # 1. Fetch user biometrics
            bio_record = session.run("""
                OPTIONAL MATCH (u:User)
                WHERE u.id = $user_id OR u.user_id = $user_id
                WITH u
                WHERE u IS NOT NULL
                OPTIONAL MATCH (u)-[:RECORDED_ASSESSMENT]->(a:StressAssessment)
                WITH u, a ORDER BY a.timestamp DESC LIMIT 1
                OPTIONAL MATCH (u)-[:LOGGED_MOOD]->(m:MoodLog)
                WITH u, a, m ORDER BY m.timestamp DESC LIMIT 1
                RETURN 
                    a.level AS stress_level,
                    a.stress_score AS raw_stress_score,
                    m.sleep_hours AS mood_sleep,
                    m.stress_level AS mood_stress
            """, user_id=clean_user_id).single()

            stress_level = "Moderate"
            stress_score = 0.5
            sleep_hours = 7.0

            if bio_record:
                if bio_record["stress_level"]:
                    stress_level = bio_record["stress_level"]
                raw_score = bio_record["raw_stress_score"]
                if raw_score is not None:
                    try:
                        s_float = float(raw_score)
                        stress_score = min(1.0, s_float / 10.0) if s_float > 1.0 else s_float
                    except Exception:
                        pass
                if bio_record["mood_sleep"] is not None:
                    try:
                        sleep_hours = float(bio_record["mood_sleep"])
                    except Exception:
                        pass

            # 2. Query pending subjects and topics
            sub_records = session.run("""
                MATCH (u:User {id: $user_id})-[:STUDIES]->(s:AcademicSubject)
                OPTIONAL MATCH (s)-[:HAS_TOPIC]->(t:SubjectTopic)
                WHERE t.completed = false
                RETURN 
                    s.id AS subject_id,
                    s.name AS subject_name,
                    s.difficulty AS difficulty,
                    s.exam_date AS exam_date,
                    t.name AS topic_name,
                    t.priority AS topic_priority
                ORDER BY 
                    CASE s.difficulty WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END,
                    t.priority ASC
                LIMIT 5
            """, user_id=clean_user_id).data()

            top_pending = sub_records[0] if sub_records and sub_records[0].get("topic_name") else None

            # 3. Dynamic Clinical Rule Engine
            # High Stress (score >= 0.7 or level "High") or Sleep < 6.0 hours:
            if stress_score >= 0.7 or stress_level == "High" or sleep_hours < 6.0:
                mode = "Cognitive Decompression"
                focus_min = 25
                break_min = 10
                action_type = "recovery"
                heading = "Low-Cognitive Recovery Recommended"
                recommendation = (
                    f"High cognitive load / sleep deficit detected ({sleep_hours}h sleep). "
                    "Deep problem-solving is not advised. Switch to a 25m structured review or take a 10m restorative break to protect working memory."
                )
                suggested_subject = top_pending.get("subject_name") if top_pending else "Foundational Review"
                suggested_topic = "Light Summary / Flashcard Consolidation"
                tier_color = "#DC2626"
                tier_bg = "#FEF2F2"

            # Optimal Stress (score < 0.4 or level "Low") and Sleep >= 6.0 hours:
            elif (stress_score < 0.4 or stress_level == "Low") and sleep_hours >= 6.0:
                mode = "Deep Cognitive Sprint"
                focus_min = 50
                break_min = 10
                action_type = "deep_focus"
                heading = "Optimal Focus Window"
                recommendation = (
                    "Autonomic balance and sleep hygiene are optimal. Prime neural window for deep work mastery on your highest-difficulty exam topics."
                )
                suggested_subject = top_pending.get("subject_name") if top_pending else "High-Difficulty Academic Core"
                suggested_topic = top_pending.get("topic_name") if top_pending else "Complex Problem Sets & Analytical Proofs"
                tier_color = "#0D9488"
                tier_bg = "#F0FDFA"

            # Moderate Stress:
            else:
                mode = "Balanced Cognitive Pacing"
                focus_min = 35
                break_min = 8
                action_type = "balanced"
                heading = "Paced Study Session"
                recommendation = (
                    "Moderate cognitive tension detected. A structured 35m focus interval with an 8m neural reset maintains sustained attention without cognitive fatigue."
                )
                suggested_subject = top_pending.get("subject_name") if top_pending else "Core Academic Subject"
                suggested_topic = top_pending.get("topic_name") if top_pending else "Standard Topic Module"
                tier_color = "#D97706"
                tier_bg = "#FFFBEB"

            # Link assessment to recommendation in graph
            if top_pending and top_pending.get("subject_id"):
                session.run("""
                    MATCH (u:User {id: $user_id})-[:RECORDED_ASSESSMENT]->(a:StressAssessment)
                    WITH a ORDER BY a.timestamp DESC LIMIT 1
                    MATCH (s:AcademicSubject {id: $sub_id})
                    MERGE (a)-[r:ADAPTS_PACING]->(s)
                    ON CREATE SET r.timestamp = datetime(), r.mode = $mode, r.focus_min = $focus_min
                """, user_id=clean_user_id, sub_id=top_pending["subject_id"], mode=mode, focus_min=focus_min)

            return {
                "mode": mode,
                "focus_minutes": focus_min,
                "break_minutes": break_min,
                "action_type": action_type,
                "heading": heading,
                "recommendation": recommendation,
                "suggested_subject": suggested_subject,
                "suggested_topic": suggested_topic,
                "tier_color": tier_color,
                "tier_bg": tier_bg,
                "biometrics": {
                    "stress_level": stress_level,
                    "stress_score": round(stress_score * 10, 1),
                    "sleep_hours": sleep_hours
                }
            }

    except Exception as e:
        logger.error("Error generating academic recommendation: %s", e)
        return {
            "mode": "Balanced Cognitive Pacing",
            "focus_minutes": 35,
            "break_minutes": 8,
            "action_type": "balanced",
            "heading": "Paced Study Session",
            "recommendation": "Maintain structured 35-minute study intervals with 8-minute restorative breaks to balance focus and stamina.",
            "suggested_subject": "Academic Mastery Core",
            "suggested_topic": "Curated Priority Topic",
            "tier_color": "#0D9488",
            "tier_bg": "#F0FDFA",
            "biometrics": {
                "stress_level": "Moderate",
                "stress_score": 5.0,
                "sleep_hours": 7.0
            }
        }
