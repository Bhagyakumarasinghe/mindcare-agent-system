from fastapi import FastAPI
from app.db.mongo import db
from app.routers import auth_routes, protected_routes, user_routes

app = FastAPI(title="Mind Care Backend")

# Routers
app.include_router(auth_routes.router)
app.include_router(protected_routes.router)
app.include_router(user_routes.router)

# MongoDB connection check
@app.on_event("startup")
async def startup_db_check():
    try:
        await db.command("ping")
        print("✅ MongoDB Connected Successfully!")
    except Exception as e:
        print("❌ MongoDB Connection Failed:", e)

# Root route
@app.get("/")
async def root():
    return {"message": "Mind Care Backend is running!"}