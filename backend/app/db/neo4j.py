from neo4j import GraphDatabase
import os
from dotenv import load_dotenv

load_dotenv()

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USER")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

# Driver එක සාදාගැනීම
driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

# 1. User Node එකක් හැදීම හෝ Update කිරීම
def sync_user_to_neo4j(user_id, name):
    with driver.session() as session:
        session.run(
            "MERGE (u:User {id: $id}) SET u.name = $name",
            id=str(user_id), name=name
        )

# 2. Connection එක close කිරීමට (අවශ්‍ය නම් පමණි)
def close_driver():
    driver.close()