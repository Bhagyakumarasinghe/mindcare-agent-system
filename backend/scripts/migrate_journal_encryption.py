"""
One-Time Migration & Cleanup Script for Neo4j JournalEntry Field-Level Encryption

Usage:
  python scripts/migrate_journal_encryption.py --action encrypt   # Encrypts all plain-text JournalEntry nodes in-place
  python scripts/migrate_journal_encryption.py --action verify    # Verifies all JournalEntry nodes are encrypted & decryptable
  python scripts/migrate_journal_encryption.py --action delete    # (Optional) Deletes all test JournalEntry nodes
"""

import sys
import os
import argparse
from pathlib import Path

# Safe stdout encoding for Windows console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
load_dotenv(backend_dir / ".env")

from app.db.neo4j import get_neo4j_session
from app.utils.security import encrypt_text, decrypt_text

def is_encrypted(text: str) -> bool:
    """Checks if text appears to be a Fernet URL-safe base64 token."""
    if not text:
        return False
    return text.startswith("gAAAAA") and len(text) >= 80

def migrate_encrypt():
    print("[*] Starting in-place encryption of unencrypted JournalEntry nodes in Neo4j...")
    with get_neo4j_session() as session:
        records = session.run(
            "MATCH (j:JournalEntry) RETURN elementId(j) as eid, j.id as jid, j.content as content"
        ).data()

        total = len(records)
        print(f"[*] Found {total} total JournalEntry node(s) in Neo4j.")

        migrated_count = 0
        already_encrypted_count = 0

        for r in records:
            eid = r["eid"]
            jid = r["jid"] or "N/A"
            raw_content = r["content"] or ""

            if is_encrypted(raw_content):
                print(f"  [SKIP] Node {jid} ({eid}) is already encrypted.")
                already_encrypted_count += 1
                continue

            ciphertext = encrypt_text(raw_content)

            # Update node in Neo4j with encrypted ciphertext
            session.run(
                """
                MATCH (j:JournalEntry)
                WHERE elementId(j) = $eid
                SET j.content = $ciphertext
                """,
                eid=eid,
                ciphertext=ciphertext
            )

            # Verification of update
            decrypted = decrypt_text(ciphertext)
            assert decrypted == raw_content, "Decryption sanity check failed!"

            print(f"  [SUCCESS] Node {jid} ({eid}) encrypted:")
            print(f"     Original:  \"{raw_content[:45]}...\"")
            print(f"     Encrypted: \"{ciphertext[:45]}...\"")
            migrated_count += 1

        print(f"\n[DONE] Migration Complete: {migrated_count} node(s) encrypted, {already_encrypted_count} already encrypted.")

def verify_encryption():
    print("[*] Verifying JournalEntry nodes in Neo4j...")
    with get_neo4j_session() as session:
        records = session.run(
            "MATCH (j:JournalEntry) RETURN elementId(j) as eid, j.id as jid, j.content as content, j.emotion as emotion"
        ).data()

        print(f"[*] Inspecting {len(records)} JournalEntry node(s):")
        for idx, r in enumerate(records, 1):
            content = r["content"] or ""
            encrypted = is_encrypted(content)
            decrypted = decrypt_text(content)
            status = "ENCRYPTED" if encrypted else "PLAIN TEXT"
            print(f"\n  [{idx}] Status: {status} | Emotion: {r.get('emotion')}")
            print(f"      Ciphertext in Neo4j: \"{content[:50]}...\"")
            print(f"      Decrypted for Client: \"{decrypted[:60]}...\"")

def delete_test_nodes():
    confirm = input("[?] Are you sure you want to delete ALL test JournalEntry nodes in Neo4j? (y/N): ")
    if confirm.lower() != "y":
        print("Cancelled.")
        return
    with get_neo4j_session() as session:
        result = session.run("MATCH (j:JournalEntry) DETACH DELETE j RETURN count(j) as deleted").single()
        print(f"[x] Deleted {result['deleted']} JournalEntry node(s) from Neo4j.")

def main():
    parser = argparse.ArgumentParser(description="Migrate & Clean Neo4j Journal Encryption")
    parser.add_argument(
        "--action", 
        choices=["encrypt", "verify", "delete"], 
        default="encrypt",
        help="Action to perform: 'encrypt' (default), 'verify', or 'delete'"
    )
    args = parser.parse_args()

    if args.action == "encrypt":
        migrate_encrypt()
        print("\nRunning verification pass:")
        verify_encryption()
    elif args.action == "verify":
        verify_encryption()
    elif args.action == "delete":
        delete_test_nodes()

if __name__ == "__main__":
    main()
