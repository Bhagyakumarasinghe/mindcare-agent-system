import os
import logging
from passlib.context import CryptContext
from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("mindcare.security")

# --- Password Hashing (bcrypt) ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    # Truncate to 72 chars to satisfy bcrypt limit
    return pwd_context.hash(password[:72])

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Truncate input to 72 chars before verifying
    return pwd_context.verify(plain_password[:72], hashed_password)


# --- Symmetric Field-Level Encryption (Fernet AES-128-CBC) ---
_raw_key = os.getenv("ENCRYPTION_KEY", "").strip().strip('"').strip("'")

if _raw_key:
    try:
        _fernet = Fernet(_raw_key.encode("utf-8"))
    except Exception as e:
        logger.error(f"Failed to initialize Fernet with ENCRYPTION_KEY: {e}")
        _fernet = None
else:
    logger.warning("⚠️ Warning: ENCRYPTION_KEY not found in environment. Generating fallback key.")
    _fernet = Fernet(Fernet.generate_key())


def encrypt_text(plain_text: str) -> str:
    """
    Encrypts a plain text string into a URL-safe base64-encoded ciphertext using Fernet.
    Returns the ciphertext string.
    """
    if not plain_text or not isinstance(plain_text, str):
        return plain_text if plain_text is not None else ""
    if not _fernet:
        return plain_text
    try:
        return _fernet.encrypt(plain_text.encode("utf-8")).decode("utf-8")
    except Exception as e:
        logger.error(f"Encryption failed: {e}")
        return plain_text


def decrypt_text(cipher_text: str) -> str:
    """
    Decrypts a Fernet ciphertext back into plaintext.
    Falls back gracefully to returning the original text if plaintext or unencrypted text is encountered.
    """
    if not cipher_text or not isinstance(cipher_text, str):
        return cipher_text if cipher_text is not None else ""
    if not _fernet:
        return cipher_text
    try:
        return _fernet.decrypt(cipher_text.encode("utf-8")).decode("utf-8")
    except (InvalidToken, Exception) as e:
        # Fallback to returning original string (e.g. legacy plain text)
        return cipher_text


# Backward compatibility aliases
encrypt_data = encrypt_text
decrypt_data = decrypt_text