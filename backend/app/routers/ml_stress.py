import os
import json
import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from google import genai
from app.services.ml_service import predict_stress_level
from app.db.neo4j import get_neo4j_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ml", tags=["ML Stress Prediction"])

class PredictAndRecordRequest(BaseModel):
    user_id: str = Field(..., description="User ID in Neo4j")
    study_hours: float = Field(..., description="Study Hours Per Day")
    extracurricular_hours: float = Field(default=2.0, description="Extracurricular Hours Per Day")
    sleep_hours: float = Field(..., description="Sleep Hours Per Day")
    physical_activity_hours: float = Field(default=1.5, description="Physical Activity Hours Per Day")
    pss_score: float = Field(default=None, description="Scaled clinical PSS score 0-10")

class RecommendationRequest(BaseModel):
    predicted_stress: str = Field(default="Moderate")
    confidence: float = Field(default=0.8)
    study_hours: float = Field(default=5.0)
    sleep_hours: float = Field(default=7.0)
    physical_activity_hours: float = Field(default=1.5)
    extracurricular_hours: float = Field(default=2.0)

def generate_clinical_recommendations(
    predicted_stress: str,
    confidence: float,
    study_hours: float,
    sleep_hours: float,
    physical_activity_hours: float = 1.5,
    extracurricular_hours: float = 2.0
) -> list:
    """
    Prompts Gemini to generate 3 concise, clinically actionable recommendations
    based on ML stress prediction and lifestyle metrics.
    Falls back to a verified clinical recommendation pool if Gemini is unavailable.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        try:
            client = genai.Client(api_key=api_key)
            prompt = f"""
            Role: MindCare Clinical Behavioral Engine for university students.
            Student Assessment Context:
            - Evaluated Stress Level: {predicted_stress} (Confidence: {confidence})
            - Last Night's Sleep: {sleep_hours} hours
            - Daily Focused Study/Work Duration: {study_hours} hours
            - Daily Physical Activity Duration: {physical_activity_hours} hours
            - Extracurricular Duration: {extracurricular_hours} hours

            Task:
            Provide exactly 3 concise, clinically actionable, and empathetic wellness recommendations.
            Focus on evidence-based CBT, sleep hygiene, cognitive pacing, and autonomic regulation.

            Output Format:
            Return strictly a JSON array of 3 objects with:
            - "title": Short clinical title (2-4 words)
            - "desc": Concise actionable guidance (1-2 sentences, max 25 words)
            - "icon": A Lucide icon name strictly from ['Clock', 'Activity', 'Moon']
            """
            response = client.models.generate_content(
                model="gemini-flash-lite-latest",
                contents=prompt,
                config={"response_mime_type": "application/json"}
            )
            recs = json.loads(response.text.strip())
            if isinstance(recs, list) and len(recs) >= 3:
                return recs[:3]
        except Exception as err:
            logger.warning("Gemini recommendation generation fallback applied: %s", err)

    # Deterministic Clinical Fallback Pool (strictly Clock, Activity, Moon)
    if predicted_stress == "High":
        return [
            {
                "title": "Autonomic Regulation",
                "desc": "Engage in 5 minutes of rhythmic diaphragmatic breathing to reduce autonomic nervous system hyperarousal.",
                "icon": "Activity"
            },
            {
                "title": "Sleep Consistency",
                "desc": f"With {sleep_hours}h sleep logged, initiate a 45-minute digital sunset tonight to restore REM restorative cycles.",
                "icon": "Moon"
            },
            {
                "title": "Cognitive Pacing",
                "desc": f"Divide your {study_hours}h daily study load into 25-minute Pomodoro intervals to mitigate mental fatigue.",
                "icon": "Clock"
            }
        ]
    elif predicted_stress == "Moderate":
        return [
            {
                "title": "Autonomic Regulation",
                "desc": "Incorporate a 10-minute mindful pause between study blocks to refresh cognitive working memory and autonomic tone.",
                "icon": "Activity"
            },
            {
                "title": "Sleep Consistency",
                "desc": "Maintain a consistent sleep window target of 7-8 hours to sustain emotional resilience.",
                "icon": "Moon"
            },
            {
                "title": "Cognitive Pacing",
                "desc": "Adopt structured 35-minute study intervals and restorative breaks to sustain executive attention.",
                "icon": "Clock"
            }
        ]
    else:  # Low
        return [
            {
                "title": "Autonomic Regulation",
                "desc": "Maintain emotional baseline stability by practicing periodic deep rhythmic breathing intervals.",
                "icon": "Activity"
            },
            {
                "title": "Sleep Consistency",
                "desc": "Your rest and habits are well-balanced. Keep maintaining regular sleep and relaxation windows.",
                "icon": "Moon"
            },
            {
                "title": "Cognitive Pacing",
                "desc": f"Continue your positive daily {study_hours}h study cadence with mindful breaks to sustain academic stamina.",
                "icon": "Clock"
            }
        ]

@router.post("/predict-and-record")
async def predict_and_record(payload: PredictAndRecordRequest):
    """
    Computes ML stress level prediction based on habit hours, links the
    assessment and recommended coping strategies to the user in Neo4j,
    and returns Gemini-powered personalized recommendations.
    """
    # 1. Compute ML prediction via predict_stress_level
    try:
        prediction = predict_stress_level(
            study_hours=payload.study_hours,
            extracurricular_hours=payload.extracurricular_hours,
            sleep_hours=payload.sleep_hours,
            physical_activity_hours=payload.physical_activity_hours,
        )
        predicted_stress = prediction["predicted_stress"]
        confidence = prediction["confidence"]
    except Exception as e:
        logger.error("ML Prediction Error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ML Prediction Error: {str(e)}"
        )

    # 2. Link prediction and recommendations in Neo4j using Cypher
    cypher_query = """
    MATCH (u:User {id: $user_id})
    CREATE (s:StressAssessment {
        id: randomUUID(),
        level: $level,
        confidence: $confidence,
        timestamp: datetime()
    })
    CREATE (u)-[:RECORDED_ASSESSMENT]->(s)
    WITH s
    MATCH (c:CopingStrategy)
    WHERE (s.level = 'High' AND c.name IN ['Deep Breathing', 'Guided Meditation'])
       OR (s.level = 'Moderate' AND c.name IN ['Mindful Walk', 'Music Relaxation'])
       OR (s.level = 'Low' AND c.name IN ['Daily Journaling', 'Gratitude Note'])
    CREATE (s)-[:RECOMMENDS]->(c)
    RETURN s.id AS assessment_id
    """

    assessment_id = None
    try:
        with get_neo4j_session() as session:
            result = session.run(
                cypher_query,
                user_id=str(payload.user_id),
                level=predicted_stress,
                confidence=confidence,
            )
            records = list(result)

            # If user node does not exist yet in Neo4j, ensure it and retry graph linking
            if not records:
                user_check = session.run(
                    "MATCH (u:User {id: $user_id}) RETURN u",
                    user_id=str(payload.user_id)
                ).single()
                if not user_check:
                    session.run(
                        "MERGE (u:User {id: $user_id})",
                        user_id=str(payload.user_id)
                    )
                    retry_res = session.run(
                        cypher_query,
                        user_id=str(payload.user_id),
                        level=predicted_stress,
                        confidence=confidence,
                    )
                    records = list(retry_res)

            if records:
                assessment_id = records[0]["assessment_id"]
                logger.info("Stress Assessment [%s] recorded in Neo4j for user %s with level %s",
                            assessment_id, payload.user_id, predicted_stress)

            # Sync with longitudinal analytics (:Assessment) node if pss_score provided
            if payload.pss_score is not None:
                try:
                    from app.db.neo4j import save_assessment_to_graph
                    save_assessment_to_graph(
                        user_id=str(payload.user_id),
                        score=float(payload.pss_score),
                        label=predicted_stress,
                        history=[]
                    )
                except Exception as save_err:
                    logger.warning("Dual graph sync to Assessment node skipped: %s", save_err)

    except Exception as db_err:
        logger.error("Neo4j Graph Error in /predict-and-record: %s", db_err)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Neo4j database error: {str(db_err)}"
        )

    # 3. Generate Gemini dynamic clinical recommendations
    recommendations = generate_clinical_recommendations(
        predicted_stress=predicted_stress,
        confidence=confidence,
        study_hours=payload.study_hours,
        sleep_hours=payload.sleep_hours,
        physical_activity_hours=payload.physical_activity_hours,
        extracurricular_hours=payload.extracurricular_hours
    )

    # 4. Return JSON response
    return {
        "status": "success",
        "predicted_stress": predicted_stress,
        "confidence": confidence,
        "assessment_id": assessment_id,
        "recommendations": recommendations,
    }

@router.post("/recommendations")
async def get_recommendations_endpoint(payload: RecommendationRequest):
    """
    Stand-alone endpoint to retrieve 3 concise Gemini-powered clinical recommendations.
    """
    recommendations = generate_clinical_recommendations(
        predicted_stress=payload.predicted_stress,
        confidence=payload.confidence,
        study_hours=payload.study_hours,
        sleep_hours=payload.sleep_hours,
        physical_activity_hours=payload.physical_activity_hours,
        extracurricular_hours=payload.extracurricular_hours
    )
    return {
        "status": "success",
        "recommendations": recommendations
    }
