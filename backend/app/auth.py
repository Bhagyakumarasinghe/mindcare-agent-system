from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
from jose import jwt, JWTError  # මෙන්න මේ දෙක import කරගන්න
from app.utils.jwt_handler import decode_access_token

auth_scheme = HTTPBearer()

async def get_current_user(token: str = Depends(auth_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # decode_access_token එක හරහා payload එක ලබා ගැනීම
        payload = decode_access_token(token.credentials)
        user_id = payload.get("user_id")
        
        if user_id is None:
            raise credentials_exception
        return {"user_id": user_id}
        
    except JWTError:  # jose library එකේ පොදු error එක මෙයයි
        raise credentials_exception
    except Exception:
        raise credentials_exception