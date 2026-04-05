import os
import json
from neo4j import GraphDatabase
from dotenv import load_dotenv
from app.utils.encryption import encrypt_data

# .env file එක load කිරීම
load_dotenv()

# Credentials ලබා ගැනීම
NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USERNAME", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

# පියවර 1: URI එක SSL error නොවෙන විදිහට සකස් කිරීම
# Aura DB වලදී 'neo4j+s' වෙනුවට 'neo4j+ssc' පාවිච්චි කිරීම වඩාත් සුදුසුයි
if NEO4J_URI and "neo4j+s://" in NEO4J_URI:
    NEO4J_URI = NEO4J_URI.replace("neo4j+s://", "neo4j+ssc://")

# පියවර 2: Driver එක සෑදීම
driver = GraphDatabase.driver(
    NEO4J_URI, 
    auth=(NEO4J_USER, NEO4J_PASSWORD)
)

def sync_user_to_neo4j(user_id, name):
    """නව පරිශීලකයෙකු ලියාපදිංචි වූ විට User Node එකක් හදයි."""
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

def save_assessment_to_graph(user_id, score, label, history):
    """Assessment එකක් අවසානයේ දත්ත Encrypt කර සේව් කරයි."""
    try:
        # Privacy සඳහා History එක JSON කර Encrypt කිරීම
        history_json = json.dumps(history)
        encrypted_history = encrypt_data(history_json)

        with driver.session() as session:
            # Cypher Query: User node එක සොයාගෙන නව Assessment node එකක් සාදා සම්බන්ධ කරයි
            query = """
            MERGE (u:User {id: $u_id})
            CREATE (a:Assessment {
                score: $score,
                label: $label,
                encrypted_history: $enc_history,
                timestamp: datetime()
            })
            CREATE (u)-[:PERFORMED_CHECKUP]->(a)
            RETURN a
            """
            session.run(
                query, 
                u_id=str(user_id), 
                score=score, 
                label=label, 
                enc_history=encrypted_history
            )
            print(f"✅ Assessment safely synced to Neo4j for {user_id}")
    except Exception as e:
        print(f"❌ Neo4j Sync Error (Assessment): {e}")

def close_driver():
    """ඇප් එක නතර කරන විට driver එක වසා දැමීමට"""
    driver.close()

# Test කිරීමට පමණක් (Optional)
if __name__ == "__main__":
    sync_user_to_neo4j("U001", "Bhagya")