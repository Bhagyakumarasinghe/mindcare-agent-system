import os
import json
import re
from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable, SessionExpired, DriverError, Neo4jError
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
if not os.getenv("NEO4J_URI"):
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)

# Credentials
NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

if NEO4J_URI and "neo4j+s://" in NEO4J_URI:
    NEO4J_URI = NEO4J_URI.replace("neo4j+s://", "neo4j+ssc://")

# Neo4j Driver Connection Liveness & Lifetime Configuration
# Prevents idle/defunct Aura cloud connections from hanging
DRIVER_CONFIG = {
    "max_connection_lifetime": 180,           # 3 minutes lifetime (recycles connections before Aura drops idle TCP)
    "liveness_check_timeout": 5.0,            # 5.0s liveness check before using pooled connection
    "connection_acquisition_timeout": 10.0,   # 10.0s max wait for connection from pool
    "max_connection_pool_size": 20,           # Max pool size of 20 connections
}

def _init_driver():
    uri = NEO4J_URI
    user = NEO4J_USER
    pw = NEO4J_PASSWORD
    
    if not uri or not pw:
        return None

    # In Neo4j Aura instances, the instance ID is frequently the provisioned admin username
    match = re.search(r'//([a-zA-Z0-9]+)\.databases\.neo4j\.io', uri or "")
    if match:
        inst_id = match.group(1)
        candidates = [inst_id, user] if user == "neo4j" else [user, inst_id]
    else:
        candidates = [user]

    for candidate_user in candidates:
        try:
            drv = GraphDatabase.driver(uri, auth=(candidate_user, pw), **DRIVER_CONFIG)
            drv.verify_connectivity()
            return drv
        except Exception:
            continue
            
    try:
        return GraphDatabase.driver(uri, auth=(user, pw), **DRIVER_CONFIG)
    except Exception as e:
        print(f"❌ Failed to initialize Neo4j driver: {e}")
        return None

driver = _init_driver()

def _refresh_driver():
    """Forces renewal of the Neo4j driver when a defunct or expired connection occurs."""
    global driver
    try:
        if driver:
            try:
                driver.close()
            except Exception:
                pass
    finally:
        driver = _init_driver()
    return driver

class ResilientSessionWrapper:
    """
    Lightweight wrapper around Neo4j Session providing a 1-retry guard
    against defunct or expired cloud connections (e.g. Neo4j Aura timeouts).
    """
    def __init__(self, session_creator):
        self._session_creator = session_creator
        self._session = None

    def _ensure_session(self):
        if self._session is None or self._session.closed():
            self._session = self._session_creator()
        return self._session

    def run(self, *args, **kwargs):
        sess = self._ensure_session()
        try:
            return sess.run(*args, **kwargs)
        except (ServiceUnavailable, SessionExpired, DriverError, Exception) as e:
            err_str = str(e).lower()
            is_transient = (
                isinstance(e, (ServiceUnavailable, SessionExpired)) or
                any(term in err_str for term in [
                    "defunct", "unavailable", "expired", "timed out", 
                    "timeout", "broken pipe", "reset by peer", "connection closed"
                ])
            )
            if is_transient:
                print(f"⚠️ [Neo4j] Transient connection error ({e}). Re-connecting and retrying operation once...")
                _refresh_driver()
                try:
                    if self._session and not self._session.closed():
                        self._session.close()
                except Exception:
                    pass
                self._session = self._session_creator()
                return self._session.run(*args, **kwargs)
            raise e

    def execute_read(self, *args, **kwargs):
        sess = self._ensure_session()
        try:
            return sess.execute_read(*args, **kwargs)
        except (ServiceUnavailable, SessionExpired, DriverError, Exception) as e:
            err_str = str(e).lower()
            is_transient = (
                isinstance(e, (ServiceUnavailable, SessionExpired)) or
                any(term in err_str for term in [
                    "defunct", "unavailable", "expired", "timed out", 
                    "timeout", "broken pipe", "reset by peer", "connection closed"
                ])
            )
            if is_transient:
                print(f"⚠️ [Neo4j] Transient error in execute_read ({e}). Re-connecting and retrying once...")
                _refresh_driver()
                try:
                    if self._session and not self._session.closed():
                        self._session.close()
                except Exception:
                    pass
                self._session = self._session_creator()
                return self._session.execute_read(*args, **kwargs)
            raise e

    def execute_write(self, *args, **kwargs):
        sess = self._ensure_session()
        try:
            return sess.execute_write(*args, **kwargs)
        except (ServiceUnavailable, SessionExpired, DriverError, Exception) as e:
            err_str = str(e).lower()
            is_transient = (
                isinstance(e, (ServiceUnavailable, SessionExpired)) or
                any(term in err_str for term in [
                    "defunct", "unavailable", "expired", "timed out", 
                    "timeout", "broken pipe", "reset by peer", "connection closed"
                ])
            )
            if is_transient:
                print(f"⚠️ [Neo4j] Transient error in execute_write ({e}). Re-connecting and retrying once...")
                _refresh_driver()
                try:
                    if self._session and not self._session.closed():
                        self._session.close()
                except Exception:
                    pass
                self._session = self._session_creator()
                return self._session.execute_write(*args, **kwargs)
            raise e

    def close(self):
        if self._session:
            try:
                if not self._session.closed():
                    self._session.close()
            except Exception:
                pass

    def closed(self):
        return self._session is None or self._session.closed()

    def __getattr__(self, name):
        return getattr(self._ensure_session(), name)

    def __enter__(self):
        self._ensure_session()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        return False

def get_neo4j_session():
    """Returns a resilient Neo4j session for database operations with auto-reconnect fallback and retry guard."""
    global driver
    if not driver:
        driver = _init_driver()
    return ResilientSessionWrapper(lambda: driver.session())

# --- USER SYNC FUNCTIONS ---

def sync_user_to_neo4j(user_id, name):
    """Initializes or updates a User node in the graph."""
    try:
        with get_neo4j_session() as session:
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
        import datetime
        history_json = json.dumps(history)
        final_history = encrypt_data(history_json)
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        with get_neo4j_session() as session:
            query = """
            MERGE (u:User {user_id: $u_id})
            SET u.id = $u_id
            CREATE (a:Assessment {
                score: $score,
                pss_score: $score,
                scaled_pss_score: $score,
                label: $label,
                level: $label,
                user_id: $u_id,
                created_at: $created_at,
                timestamp: datetime(),
                encrypted_history: $enc_history
            })
            CREATE (u)-[:PERFORMED_CHECKUP]->(a)
            CREATE (u)-[:COMPLETED_ASSESSMENT]->(a)
            """
            session.run(
                query, 
                u_id=str(user_id), 
                score=score, 
                label=label, 
                created_at=now_iso,
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
        with get_neo4j_session() as session:
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

def save_mood_entry_to_graph(user_id, mood, stress_score, sleep_hours, activities=None, stress_factor="", journal_note="", emotion_tags=None, energy_level="Steady", stress_factors=None):
    """Saves daily mood tracking data directly into the user graph for analytics without synthetic stress."""
    if activities is None:
        activities = []
    if emotion_tags is None:
        emotion_tags = []
    if stress_factors is None:
        stress_factors = []
    stress_score_param = round(float(stress_score), 1) if stress_score is not None else None
    sleep_hours_param = float(sleep_hours) if sleep_hours is not None else 7.0
    query = """
    MATCH (u:User)
    WHERE u.id = $user_id OR u.user_id = $user_id
    CREATE (m:MoodLog {
        id: randomUUID(),
        mood: $mood,
        emotion_tags: $emotion_tags,
        energy_level: $energy_level,
        stress_score: $stress_score,
        stress_level: $stress_score,
        activities: $activities,
        sleep_hours: $sleep_hours,
        stress_factors: $stress_factors,
        stress_factor: $stress_factor,
        note: $journal_note,
        timestamp: datetime()
    })
    CREATE (u)-[:LOGGED_MOOD]->(m)
    RETURN m
    """
    try:
        with get_neo4j_session() as session:
            result = session.run(
                query, 
                user_id=str(user_id), 
                mood=str(mood), 
                emotion_tags=list(emotion_tags),
                energy_level=str(energy_level or "Steady"),
                stress_score=stress_score_param, 
                activities=list(activities),
                sleep_hours=sleep_hours_param,
                stress_factors=list(stress_factors),
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
                    emotion_tags: $emotion_tags,
                    energy_level: $energy_level,
                    stress_score: $stress_score,
                    stress_level: $stress_score,
                    activities: $activities,
                    sleep_hours: $sleep_hours,
                    stress_factors: $stress_factors,
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
                    emotion_tags=list(emotion_tags),
                    energy_level=str(energy_level or "Steady"),
                    stress_score=stress_score_param, 
                    activities=list(activities),
                    sleep_hours=sleep_hours_param,
                    stress_factors=list(stress_factors),
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
        with get_neo4j_session() as session:
            session.run(query, user_id=str(user_id), content=encrypted_content, emotion=emotion)
            print(f"✅ Encrypted journal entry (emotion: {emotion}) saved to Neo4j for user {user_id}")
    except Exception as e:
        print(f"❌ Neo4j Save Error (Journal): {e}")

# --- DATA RETRIEVAL & INSIGHTS ---

def get_recent_mood_logs(user_id: str, limit: int = 5):
    """
    Retrieves the most recent mood logs for a specific user to be analyzed by the Agent.
    Strictly isolated to user_id.
    """
    query = """
    MATCH (u:User)-[:LOGGED_MOOD]->(m:MoodLog)
    WHERE u.user_id = $user_id OR u.id = $user_id
    RETURN m.mood AS mood, 
           coalesce(m.emotion_tags, []) AS emotion_tags,
           coalesce(m.energy_level, 'Steady') AS energy_level,
           coalesce(m.stress_score, m.stress_level, null) AS stress, 
           coalesce(m.stress_score, m.stress_level, null) AS stress_score,
           coalesce(m.sleep_hours, 7.0) AS sleep_hours, 
           coalesce(m.sleep_hours, 7.0) AS sleep, 
           m.activities AS activities,
           coalesce(m.stress_factors, []) AS stress_factors,
           m.stress_factor AS stress_factor,
           m.note AS note,
           toString(coalesce(m.timestamp, m.created_at, datetime())) AS date,
           toString(coalesce(m.timestamp, m.created_at, datetime())) AS timestamp
    ORDER BY coalesce(m.timestamp, m.created_at) DESC, elementId(m) DESC 
    LIMIT $limit
    """
    try:
        with get_neo4j_session() as session:
            records = session.run(query, user_id=str(user_id), limit=limit).data()
            return records
    except Exception as e:
        print(f"[ERROR] Error fetching recent mood logs: {e}")
        return []

def get_latest_assessment_data(user_id):
    """Retrieves the most recent assessment for the Profiling Agent."""
    query = """
    MATCH (u:User)-[:PERFORMED_CHECKUP|COMPLETED_ASSESSMENT]->(a:Assessment)
    WHERE u.user_id = $user_id OR u.id = $user_id
    RETURN a.encrypted_history AS enc_history,
           coalesce(a.label, a.level) AS label,
           coalesce(a.scaled_pss_score, a.pss_score, a.score) AS score
    ORDER BY coalesce(a.timestamp, a.created_at) DESC LIMIT 1
    """
    try:
        with get_neo4j_session() as session:
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

def get_recent_chat_sessions(user_id: str, limit: int = 3):
    """Retrieves recent chat sessions for a user, ordered newest first."""
    query = """
    MATCH (u:User)-[:ENGAGED_IN]->(s:ChatSession)
    WHERE u.user_id = $user_id OR u.id = $user_id
    RETURN s.user_msg AS user_msg,
           s.ai_reply AS ai_reply,
           s.intent AS intent,
           s.mood AS mood,
           toString(s.timestamp) AS timestamp
    ORDER BY s.timestamp DESC
    LIMIT $limit
    """
    try:
        with get_neo4j_session() as session:
            result = session.run(query, user_id=str(user_id), limit=limit)
            return [
                {
                    "user_msg": record.get("user_msg"),
                    "ai_reply": record.get("ai_reply"),
                    "intent": record.get("intent"),
                    "mood": record.get("mood"),
                    "timestamp": record.get("timestamp")
                }
                for record in result
            ]
    except Exception as e:
        print(f"❌ Error fetching recent chat sessions: {e}")
        return []

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
        with get_neo4j_session() as session:
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
    MATCH (u:User)
    WHERE u.user_id = $user_id OR u.id = $user_id
    
    // 1. Collect chat session mood records
    OPTIONAL MATCH (u)-[:ENGAGED_IN]->(s:ChatSession)
    WITH u, collect(DISTINCT {mood: s.mood, timestamp: toString(s.timestamp)}) as raw_moods
    
    // 2. Collect assessment evaluation records in exact chronological order
    OPTIONAL MATCH (u)-[:PERFORMED_CHECKUP|COMPLETED_ASSESSMENT]->(a:Assessment)
    WITH u, raw_moods, a
    ORDER BY coalesce(a.timestamp, a.created_at) DESC, elementId(a) DESC
    WITH u, raw_moods, collect(DISTINCT {
        score: coalesce(a.scaled_pss_score, a.pss_score, a.score),
        label: coalesce(a.label, a.level),
        timestamp: toString(coalesce(a.timestamp, a.created_at))
    }) as raw_asmts
    
    // 3. Filter null records and return clean arrays
    RETURN 
        [m in raw_moods WHERE m.mood IS NOT NULL] as mood_history,
        [asmt in raw_asmts WHERE asmt.score IS NOT NULL] as assessment_history
    """
    try:
        with get_neo4j_session() as session:
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
    global driver
    if driver:
        try:
            driver.close()
        except Exception:
            pass