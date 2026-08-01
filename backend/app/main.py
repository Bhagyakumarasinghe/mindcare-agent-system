from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.mongo import db
from app.routers import auth_routes, protected_routes, user_routes, relax_routes

app = FastAPI(title="Mind Care Backend")

# ✅ 1. CORS Middleware (Mobile App එකට සම්බන්ධ වීමට අත්‍යවශ්‍යයි)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],
)

# Routers සම්බන්ධ කිරීම
app.include_router(auth_routes.router)
app.include_router(protected_routes.router)
app.include_router(user_routes.router)
app.include_router(relax_routes.router)  # 🌟 Relaxation & Tools Router

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
    return {
        "message": "Mind Care Backend is running!",
        "status": "Healthy",
        "agents_active": ["Orchestrator", "Assessment", "Therapy", "Analytics"]
    }