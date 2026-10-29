import os
import json
from neo4j import GraphDatabase
from dotenv import load_dotenv

# Encryption setup
try:
    from app.utils.security import encrypt_text, decrypt_text, encrypt_data, decrypt_data
except ImportError:
    print("⚠️ Encryption module not found. Using dummy functions.")
    encrypt_text = lambda x: x
    decrypt_text = lambda x: x
    encrypt_data = lambda x: x 
    decrypt_data = lambda x: x

load_dotenv()

import re

# Credentials
NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

if NEO4J_URI and "neo4j+s://" in NEO4J_URI:
    NEO4J_URI = NEO4J_URI.replace("neo4j+s://", "neo4j+ssc://")

def _init_driver():
    uri = NEO4J_URI
    user = NEO4J_USER
    pw = NEO4J_PASSWORD
    
    # In Neo4j Aura instances, the instance ID is frequently the provisioned admin username
    match = re.search(r'//([a-zA-Z0-9]+)\.databases\.neo4j\.io', uri or "")
    if match:
        inst_id = match.group(1)
        candidates = [inst_id, user] if user == "neo4j" else [user, inst_id]
    else:
        candidates = [user]

    for candidate_user in candidates:
        try:
            drv = GraphDatabase.driver(uri, auth=(candidate_user, pw))
            drv.verify_connectivity()
            return drv
        except Exception:
            continue
            
    return GraphDatabase.driver(uri, auth=(user, pw))

driver = _init_driver()

def get_neo4j_session():
    """Returns a new Neo4j session for database operations with auto-reconnect fallback."""
    global driver
    try:
        if driver:
            driver.verify_connectivity()
        else:
            driver = _init_driver()
    except Exception:
        try:
            driver = _init_driver()
        except Exception:
            pass
    return driver.session()

# --- USER SYNC FUNCTIONS ---

def sync_user_to_neo4j(user_id, name):
    """Initializes or updates a User node in the graph."""
    try:
        with driver.session() as session:
            session.run(
                "MERGE (u:User {id: $id}) SET u.name = $name", 
                id=str(user_id), 
                name=name
            )
            print(f"✅ User {name} synced to Neo4j.")
    except Exception as e:
        print(f"❌ Neo4j Sync Error (User): {e}")

# --- DATA STORAGE FUNCTIONS ---

def save_assessment_to_graph(user_id, score, label, history):
    """Encrypts and saves student assessment results."""
    try:
        history_json = json.dumps(history)
        final_history = encrypt_data(history_json)

        with driver.session() as session:
            query = """
            MERGE (u:User {id: $u_id})
            CREATE (a:Assessment {
                score: $score,
                label: $label,
                encrypted_history: $enc_history,
                timestamp: datetime()
            })
            CREATE (u)-[:PERFORMED_CHECKUP]->(a)
            """
            session.run(
                query, 
                u_id=str(user_id), 
                score=score, 
                label=label, 
                enc_history=final_history
            )
            print(f"✅ Assessment synced to Neo4j for {user_id}")
    except Exception as e:
        print(f"❌ Neo4j Sync Error (Assessment): {e}")

def save_chat_to_graph(user_id, user_msg, ai_res, intent, mood):
    """Saves encrypted chat interactions between user and AI."""
    query = """
    MERGE (u:User {id: $user_id})
    CREATE (s:ChatSession {
        timestamp: datetime(),
        user_msg: $user_msg,
        ai_reply: $ai_res,
        intent: $intent,
        mood: $mood
    })
    CREATE (u)-[:ENGAGED_IN]->(s)
    """
    try:
        with driver.session() as session:
            session.run(
                query, 
                user_id=str(user_id), 
                user_msg=user_msg, 
                ai_res=ai_res, 
                intent=intent, 
                mood=mood
            )
            print(f"✅ Chat session saved to Neo4j for user {user_id}")
    except Exception as e:
        print(f"❌ Neo4j Save Error (Chat): {e}")

def save_mood_entry_to_graph(user_id, mood, stress_score, sleep_hours, activities=None, stress_factor="", journal_note=""):
    """Saves daily mood tracking data directly into the user graph for analytics."""
    if activities is None:
        activities = []
    query = """
    MATCH (u:User {id: $user_id})
    CREATE (m:MoodLog {
        id: randomUUID(),
        mood: $mood,
        stress_score: $stress_score,
        stress_level: $stress_score,
        activities: $activities,
        sleep_hours: $sleep_hours,
        stress_factor: $stress_factor,
        note: $journal_note,
        timestamp: datetime()
    })
    CREATE (u)-[:LOGGED_MOOD]->(m)
    RETURN m
    """
    try:
        with driver.session() as session:
            result = session.run(
                query, 
                user_id=str(user_id), 
                mood=str(mood), 
                stress_score=int(stress_score), 
                activities=list(activities),
                sleep_hours=float(sleep_hours),
                stress_factor=str(stress_factor if str(stress_factor or "").strip() and str(stress_factor).strip().lower() not in ("none", "null", "") else "General Academic Studies"),
                journal_note=str(journal_note or "")
            ).single()
            
            # Resilient fallback: If user node did not exist yet, MERGE user and attach
            if not result:
                fallback_query = """
                MERGE (u:User {id: $user_id})
                CREATE (m:MoodLog {
                    id: randomUUID(),
                    mood: $mood,
                    stress_score: $stress_score,
                    stress_level: $stress_score,
                    activities: $activities,
                    sleep_hours: $sleep_hours,
                    stress_factor: $stress_factor,
                    note: $journal_note,
                    timestamp: datetime()
                })
                CREATE (u)-[:LOGGED_MOOD]->(m)
                RETURN m
                """
                session.run(
                    fallback_query, 
                    user_id=str(user_id), 
                    mood=str(mood), 
                    stress_score=int(stress_score), 
                    activities=list(activities),
                    sleep_hours=float(sleep_hours),
                    stress_factor=str(stress_factor if str(stress_factor or "").strip() and str(stress_factor).strip().lower() not in ("none", "null", "") else "General Academic Studies"),
                    journal_note=str(journal_note or "")
                )
            print(f"[OK] Mood Log graph node synced for user {user_id}")
    except Exception as e:
        print(f"[ERROR] Neo4j Mood Sync Error: {e}")

# --- RELAXATION & JOURNALING FUNCTIONS ---

def save_journal_to_graph(user_id, content, date, emotion="Reflective"):
    """Saves journal entries into Neo4j Graph with field-level encryption for privacy compliance."""
    encrypted_content = encrypt_text(content)
    query = """
    MERGE (u:User {id: $user_id})
    CREATE (j:JournalEntry {
        content: $content,
        emotion: $emotion,
        timestamp: datetime()
    })
    CREATE (u)-[:LOGGED_JOURNAL]->(j)
    """
    try:
        with driver.session() as session:
            session.run(query, user_id=str(user_id), content=encrypted_content, emotion=emotion)
            print(f"✅ Encrypted journal entry (emotion: {emotion}) saved to Neo4j for user {user_id}")
    except Exception as e:
        print(f"❌ Neo4j Save Error (Journal): {e}")

# --- DATA RETRIEVAL & INSIGHTS ---

def get_recent_mood_logs(user_id: str, limit: int = 5):
    """
    Retrieves the most recent mood logs for a specific user to be analyzed by the Agent.
    """
    query = """
    MATCH (u:User {id: $user_id})-[:LOGGED_MOOD]->(m:MoodLog)
    RETURN m.mood AS mood, 
           coalesce(m.stress_score, m.stress_level, 5) AS stress, 
           coalesce(m.stress_score, m.stress_level, 5) AS stress_score,
           m.sleep_hours AS sleep, 
           m.activities AS activities,
           m.stress_factor AS stress_factor,
           m.note AS note,
           toString(m.timestamp) AS date
    ORDER BY m.timestamp DESC 
    LIMIT $limit
    """
    try:
        with driver.session() as session:
            records = session.run(query, user_id=str(user_id), limit=limit).data()
            if not records and (user_id == 'demo_user' or not user_id):
                fallback_query = """
                MATCH (u:User)-[:LOGGED_MOOD]->(m:MoodLog)
                RETURN m.mood AS mood, 
                       coalesce(m.stress_score, m.stress_level, 5) AS stress, 
                       coalesce(m.stress_score, m.stress_level, 5) AS stress_score,
                       m.sleep_hours AS sleep, 
                       m.activities AS activities,
                       m.stress_factor AS stress_factor,
                       m.note AS note,
                       toString(m.timestamp) AS date
                ORDER BY m.timestamp DESC 
                LIMIT $limit
                """
                records = session.run(fallback_query, limit=limit).data()
            return records
    except Exception as e:
        print(f"[ERROR] Error fetching recent mood logs: {e}")
        return []

def get_latest_assessment_data(user_id):
    """Retrieves the most recent assessment for the Profiling Agent."""
    query = """
    MATCH (u:User {id: $user_id})-[:PERFORMED_CHECKUP]->(a:Assessment)
    RETURN a.encrypted_history AS enc_history, a.label AS label, a.score AS score
    ORDER BY a.timestamp DESC LIMIT 1
    """
    try:
        with driver.session() as session:
            result = session.run(query, user_id=str(user_id))
            record = result.single()
            if record:
                return {
                    "encrypted_history": record["enc_history"],
                    "label": record["label"],
                    "score": record["score"]
                }
            return None
    except Exception as e:
        print(f"❌ Error fetching latest assessment: {e}")
        return None

def get_user_longitudinal_context(user_id: str):
    """
    Retrieves longitudinal history of the user from Neo4j, including
    last ML stress assessment, recommended coping strategies, and recent mood.
    """
    query = """
    MATCH (u:User {id: $user_id})
    OPTIONAL MATCH (u)-[:RECORDED_ASSESSMENT]->(s:StressAssessment)
    WITH u, s ORDER BY s.timestamp DESC
    WITH u, head(collect(s)) as latest_s
    OPTIONAL MATCH (latest_s)-[:RECOMMENDS]->(c:CopingStrategy)
    OPTIONAL MATCH (u)-[:LOGGED_MOOD]->(m:MoodLog)
    WITH latest_s, c, m ORDER BY m.timestamp DESC
    RETURN latest_s.level as last_stress_level,
           latest_s.confidence as last_confidence,
           collect(DISTINCT c.name) as coping_strategies,
           toString(latest_s.timestamp) as last_assessed,
           head(collect(m.mood)) as recent_mood,
           head(collect(m.stress_level)) as recent_mood_stress
    """
    try:
        with driver.session() as session:
            result = session.run(query, user_id=str(user_id))
            record = result.single()
            if record:
                return {
                    "last_stress_level": record.get("last_stress_level"),
                    "last_confidence": record.get("last_confidence"),
                    "coping_strategies": record.get("coping_strategies") or [],
                    "last_assessed": record.get("last_assessed"),
                    "recent_mood": record.get("recent_mood"),
                    "recent_mood_stress": record.get("recent_mood_stress")
                }
            return {
                "last_stress_level": None,
                "last_confidence": None,
                "coping_strategies": [],
                "last_assessed": None,
                "recent_mood": None,
                "recent_mood_stress": None
            }
    except Exception as e:
        print(f"Error fetching user longitudinal context: {e}")
        return {
            "last_stress_level": None,
            "last_confidence": None,
            "coping_strategies": [],
            "last_assessed": None,
            "recent_mood": None,
            "recent_mood_stress": None
        }

def get_user_insights(user_id):
    """
    Retrieves mood and assessment history for user profile summary.
    """
    query = """
    MATCH (u:User {id: $user_id})
    
    // 1. Collect chat session mood records
    OPTIONAL MATCH (u)-[:ENGAGED_IN]->(s:ChatSession)
    WITH u, collect(DISTINCT {mood: s.mood, timestamp: toString(s.timestamp)}) as raw_moods
    
    // 2. Collect assessment evaluation records
    OPTIONAL MATCH (u)-[:PERFORMED_CHECKUP]->(a:Assessment)
    WITH u, raw_moods, collect(DISTINCT {score: a.score, label: a.label, timestamp: toString(a.timestamp)}) as raw_asmts
    
    // 3. Filter null records and return clean arrays
    RETURN 
        [m in raw_moods WHERE m.mood IS NOT NULL] as mood_history,
        [asmt in raw_asmts WHERE asmt.score IS NOT NULL] as assessment_history
    """
    try:
        with driver.session() as session:
            result = session.run(query, user_id=str(user_id))
            record = result.single()
            if record:
                return {
                    "mood_history": record["mood_history"],
                    "assessment_history": record["assessment_history"]
                }
            return {"mood_history": [], "assessment_history": []}
    except Exception as e:
        print(f"❌ Neo4j Insights Error: {e}")
        return {"mood_history": [], "assessment_history": []}

def close_driver():
    """Closes the Neo4j driver connection."""
    driver.close()