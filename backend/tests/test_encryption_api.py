import requests
import sys
from pathlib import Path

# Add backend directory
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
load_dotenv(backend_dir / ".env")

from app.db.neo4j import get_neo4j_session
from app.utils.security import decrypt_text

BASE = "http://localhost:8000"

def test_encryption_flow():
    test_user = "test_privacy_compliance_user"
    secret_text = "Confidential Reflection: Feeling grateful and serene after breathwork exercise."

    print("1. Sending POST /api/journal/analyze-and-record...")
    res = requests.post(f"{BASE}/api/journal/analyze-and-record", json={
        "user_id": test_user,
        "content": secret_text
    })
    print("Status:", res.status_code)
    data = res.json()
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {data}"
    print("Emotion analyzed:", data.get("analysis", {}).get("dominant_emotion"))

    print("\n2. Checking Neo4j directly for ciphertext storage...")
    with get_neo4j_session() as session:
        record = session.run(
            "MATCH (u:User {id: $uid})-[:LOGGED_JOURNAL]->(j:JournalEntry) RETURN j.content as content",
            uid=test_user
        ).single()
        assert record is not None, "JournalEntry node not found in Neo4j!"
        stored_content = record["content"]
        print("Raw stored content in Neo4j:")
        print(stored_content)
        assert stored_content.startswith("gAAAAA"), "Stored content is not Fernet ciphertext!"
        assert "Confidential" not in stored_content, "Plain text leaked into Neo4j!"
        print("[PASS] Plaintext is NOT in Neo4j. Ciphertext is safely stored.")

    print("\n3. Testing GET /api/journal/history with automatic decryption...")
    hist_res = requests.get(f"{BASE}/api/journal/history", params={"user_id": test_user})
    print("History status:", hist_res.status_code)
    hist_data = hist_res.json()
    assert hist_res.status_code == 200
    entries = hist_data.get("entries", [])
    assert len(entries) >= 1
    returned_content = entries[0]["content"]
    print("Decrypted content returned to client:")
    print(returned_content)
    assert returned_content == secret_text, "Decrypted text does not match original!"
    print("[PASS] Decrypted text matches original secret text perfectly.")

    print("\n4. Testing GET /api/analytics/journal-summary with decrypted recent entries...")
    sum_res = requests.get(f"{BASE}/api/analytics/journal-summary", params={"user_id": test_user})
    print("Summary status:", sum_res.status_code)
    sum_data = sum_res.json()
    assert sum_res.status_code == 200
    recent = sum_data.get("recent_entries", [])
    if recent:
        assert recent[0]["content"] == secret_text
        print("[PASS] Journal summary recent_entries decrypted properly.")

    print("\n5. Cleaning up test user...")
    with get_neo4j_session() as session:
        session.run(
            """
            MATCH (u:User {id: $uid})
            OPTIONAL MATCH (u)-[r:LOGGED_JOURNAL]->(j:JournalEntry)
            DETACH DELETE u, j
            """,
            uid=test_user
        )
    print("Test cleanup complete.")
    print("\nALL PRIVACY & ENCRYPTION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_encryption_flow()
