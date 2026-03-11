from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware # අලුතින් එක් කළා
from app.db.mongo import db
from app.routers import auth_routes, protected_routes, user_routes

app = FastAPI(title="Mind Care Backend")

# ✅ 1. CORS Middleware එක අනිවාර්යයෙන්ම අවශ්‍යයි
# මෙය නොමැතිව Mobile App එකට Backend එකට සම්බන්ධ විය නොහැක.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # සියලුම මූලාශ්‍රවලට අවසර දෙන්න
    allow_credentials=True,
    allow_methods=["*"],  # GET, POST, PUT, DELETE සියල්ලට අවසර
    allow_headers=["*"],
)

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