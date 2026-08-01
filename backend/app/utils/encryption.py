import os
from cryptography.fernet import Fernet
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get encryption key from .env file
# Ensure ENCRYPTION_KEY is a valid Fernet key (32 url-safe base64-encoded bytes)
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")

if ENCRYPTION_KEY:
    cipher_suite = Fernet(ENCRYPTION_KEY.encode())
else:
    cipher_suite = None
    print("⚠️ Warning: ENCRYPTION_KEY not found in .env file!")

def encrypt_data(data: str) -> str:
    """
    Encrypts a plain text string into a cipher text.
    """
    if not data or not cipher_suite:
        return data
    return cipher_suite.encrypt(data.encode()).decode()

def decrypt_data(encrypted_data: str) -> str:
    """
    Decrypts a cipher text back into plain text.
    """
    if not encrypted_data or not cipher_suite:
        return encrypted_data
    try:
        return cipher_suite.decrypt(encrypted_data.encode()).decode()
    except Exception as e:
        print(f"❌ Decryption failed: {e}")
        return encrypted_data