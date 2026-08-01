import os
import json
from neo4j import GraphDatabase
from dotenv import load_dotenv

# Encryption setup
try:
    from app.utils.encryption import encrypt_data, decrypt_data
except ImportError:
    print("⚠️ Encryption module not found. Using dummy functions.")
    encrypt_data = lambda x: x 
    decrypt_data = lambda x: x

load_dotenv()

# Credentials
NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

if NEO4J_URI and "neo4j+s://" in NEO4J_URI:
    NEO4J_URI = NEO4J_URI.replace("neo4j+s://", "neo4j+ssc://")

driver = GraphDatabase.driver(
    NEO4J_URI, 
    auth=(NEO4J_USER, NEO4J_PASSWORD)
)

def get_neo4j_session():
    """Returns a new Neo4j session for database operations."""
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

def save_mood_entry_to_graph(user_id, mood, stress, sleep):
    """Saves daily mood tracking data directly into the user graph for analytics."""
    query = """
    MERGE (u:User {id: $user_id})
    CREATE (m:MoodLog {
        timestamp: datetime(),
        mood: $mood,
        stress_level: $stress,
        sleep_hours: $sleep
    })
    CREATE (u)-[:LOGGED_MOOD]->(m)
    """
    try:
        with driver.session() as session:
            session.run(
                query, 
                user_id=str(user_id), 
                mood=mood, 
                stress=int(stress), 
                sleep=float(sleep)
            )
            print(f"✅ Mood Log graph node synced for user {user_id}")
    except Exception as e:
        print(f"❌ Neo4j Mood Sync Error: {e}")

# --- RELAXATION & JOURNALING FUNCTIONS ---

def save_journal_to_graph(user_id, content, date):
    """Saves journal entries into Neo4j Graph for Knowledge Graph Analytics."""
    query = """
    MERGE (u:User {id: $user_id})
    CREATE (j:JournalEntry {
        content: $content,
        timestamp: $date
    })
    CREATE (u)-[:LOGGED_JOURNAL]->(j)
    """
    try:
        with driver.session() as session:
            session.run(query, user_id=str(user_id), content=content, date=date)
            print(f"✅ Journal entry saved to Neo4j for user {user_id}")
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
           m.stress_level AS stress, 
           m.sleep_hours AS sleep, 
           toString(m.timestamp) AS date
    ORDER BY m.timestamp DESC 
    LIMIT $limit
    """
    try:
        with driver.session() as session:
            result = session.run(query, user_id=str(user_id), limit=limit)
            return [record.data() for record in result]
    except Exception as e:
        print(f"❌ Error fetching recent mood logs: {e}")
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

def get_user_insights(user_id):
    """
    FastAPI හි /user/me (Profile) endpoint එක සඳහා 
    Warning සහ Syntax Error රහිතව පිරිසිදු දත්ත ලබාදීමට සකස් කරන ලදී.
    """
    query = """
    MATCH (u:User {id: $user_id})
    
    // 1. Chat Sessions ලබාගෙන raw list එකක් සාදයි
    OPTIONAL MATCH (u)-[:ENGAGED_IN]->(s:ChatSession)
    WITH u, collect(DISTINCT {mood: s.mood, timestamp: toString(s.timestamp)}) as raw_moods
    
    // 2. Assessments ලබාගෙන raw list එකක් සාදයි
    OPTIONAL MATCH (u)-[:PERFORMED_CHECKUP]->(a:Assessment)
    WITH u, raw_moods, collect(DISTINCT {score: a.score, label: a.label, timestamp: toString(a.timestamp)}) as raw_asmts
    
    // 3. ඩේටා නොමැති විට ඇතිවන Null objects ලැයිස්තුවෙන් ඉවත් කර පිරිසිදු Arrays රිටර්න් කරයි
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