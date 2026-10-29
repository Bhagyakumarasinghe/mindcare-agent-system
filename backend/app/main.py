from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.mongo import db
from app.routers import auth_routes, protected_routes, user_routes, relax_routes, ml_stress, journal, assessment, academic, analytics, chat, agent_services

app = FastAPI(title="Mind Care Backend")

# 1. CORS Middleware for Mobile App Connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],
)

# Connect Application Routers
app.include_router(auth_routes.router)
app.include_router(protected_routes.router)
app.include_router(user_routes.router)
app.include_router(chat.router)  # Clinical Support & Crisis Intervention Chat Router
app.include_router(relax_routes.router)  # Relaxation & Tools Router
app.include_router(ml_stress.router)  # ML Stress Inference & Neo4j Router
app.include_router(journal.router)  # AI Journal & Longitudinal Analytics Router
app.include_router(analytics.router)  # Dynamic Analytics & Reflection Patterns Router
app.include_router(assessment.router)  # Assessment Evaluator Router
app.include_router(academic.router)  # Academic Cognitive Pacing Router
app.include_router(agent_services.router)  # Academic Decomposer & CBT Reframing Router

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
# MindCare Clinical Analytics & Mood Tracking synchronized