from cryptography.fernet import Fernet
import os
from dotenv import load_dotenv

load_dotenv()

# .env එකේ ඇති ENCRYPTION_KEY එක ලබා ගැනීම
key = os.getenv("ENCRYPTION_KEY")
cipher_suite = Fernet(key.encode()) if key else None

def encrypt_data(data: str) -> str:
    """දත්ත කියවන්න බැරි string එකක් බවට පත් කරයි."""
    if not data or not cipher_suite:
        return data
    return cipher_suite.encrypt(data.encode()).decode()

def decrypt_data(encrypted_data: str) -> str:
    """Encrypt කළ දත්ත නැවත කියවිය හැකි string එකක් බවට පත් කරයි."""
    if not encrypted_data or not cipher_suite:
        return encrypted_data
    return cipher_suite.decrypt(encrypted_data.encode()).decode()