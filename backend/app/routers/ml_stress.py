import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional, List
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
    pss_score: Optional[float] = Field(default=None, description="Scaled clinical PSS score 0-10")
    reflections: Optional[List[str]] = Field(default=None, description="Optional user written reflections from assessment steps")

class RecommendationRequest(BaseModel):
    predicted_stress: str = Field(default="Moderate")
    confidence: float = Field(default=0.8)
    study_hours: float = Field(default=5.0)
    sleep_hours: float = Field(default=7.0)
    physical_activity_hours: float = Field(default=1.5)
    extracurricular_hours: float = Field(default=2.0)
    pss_score: Optional[float] = Field(default=None)
    reflections: Optional[List[str]] = Field(default=None)

def generate_clinical_recommendations(
    predicted_stress: str,
    confidence: float,
    study_hours: float,
    sleep_hours: float,
    physical_activity_hours: float = 1.5,
    extracurricular_hours: float = 2.0,
    pss_score: Optional[float] = None,
    reflections: Optional[List[str]] = None
) -> list:
    """
    Prompts Gemini (gemini-flash-lite-latest) to generate 3 concise, clinically actionable,
    and student-friendly recommendations based on the student's actual assessment inputs,
    ML stress prediction, scaled PSS score, and reflections.
    Falls back to a verified clinical recommendation pool if Gemini is unavailable.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        try:
            client = genai.Client(api_key=api_key, http_options={'timeout': 30000})

            reflections_context = ""
            if reflections and isinstance(reflections, list):
                cleaned_refs = [str(r).strip() for r in reflections if str(r).strip()]
                if cleaned_refs:
                    reflections_context = f"\n- Student's Written Assessment Reflections: {' | '.join(cleaned_refs)}"

            pss_str = f"{round(float(pss_score), 1)}/10" if pss_score is not None else "Not specified"

            prompt = f"""
            Role: MindCare Clinical Behavioral Engine for university students.
            Student Assessment Context:
            - Evaluated Stress Level: {predicted_stress} (Confidence: {confidence})
            - Scaled Clinical PSS Score: {pss_str}
            - Last Night's Sleep: {sleep_hours} hours
            - Daily Focused Study/Work Duration: {study_hours} hours
            - Daily Physical Activity Duration: {physical_activity_hours} hours
            - Extracurricular Duration: {extracurricular_hours} hours{reflections_context}

            Task:
            Provide exactly 3 concise, student-friendly, empathetic, and actionable coping recommendations.
            Explicitly reference and adapt to their actual sleep ({sleep_hours}h) and study ({study_hours}h) habits and psychological state.
            Focus on evidence-based CBT, sleep hygiene, cognitive pacing, and autonomic regulation.

            Output Format:
            Return strictly a JSON array of exactly 3 objects with:
            - "title": Short clinical title (2-4 words, e.g. "Autonomic Reset", "Sleep Restoration", "Cognitive Pacing")
            - "desc": Concise, empathetic, actionable practical guidance (2 sentences referencing their actual sleep/study habits, max 30 words)
            - "icon": A Lucide icon name strictly from ['Moon', 'Clock', 'HeartPulse']
            """
            response = client.models.generate_content(
                model="gemini-flash-lite-latest",
                contents=prompt,
                config={"response_mime_type": "application/json"}
            )
            raw_text = response.text.strip()
            if "```" in raw_text:
                raw_text = raw_text.replace("```json", "").replace("```", "").strip()
            recs = json.loads(raw_text)
            if isinstance(recs, list) and len(recs) >= 3:
                valid_icons = {'Moon', 'Clock', 'HeartPulse'}
                default_icons = ['HeartPulse', 'Moon', 'Clock']
                cleaned_recs = []
                for i, r in enumerate(recs[:3]):
                    icon_name = r.get("icon", default_icons[i % 3])
                    if icon_name not in valid_icons:
                        icon_name = default_icons[i % 3]
                    cleaned_recs.append({
                        "title": r.get("title", f"Protocol {i+1}"),
                        "desc": r.get("desc", ""),
                        "icon": icon_name
                    })
                print(f"[Gemini Coping Protocols] Generated 3 personalized recommendations for student (Stress: {predicted_stress}, PSS: {pss_str})")
                logger.info("[Gemini Coping Protocols] Generated 3 personalized recommendations")
                return cleaned_recs
        except Exception as err:
            logger.warning("Gemini recommendation generation fallback applied: %s", err)
            print(f"[Gemini Coping Protocols] Fallback applied: {err}")

    # Deterministic Clinical Fallback Pool (strictly Moon, Clock, HeartPulse)
    if predicted_stress == "High":
        return [
            {
                "title": "Autonomic Regulation",
                "desc": "Engage in 5 minutes of rhythmic diaphragmatic breathing to downregulate sympathetic hyperarousal.",
                "icon": "HeartPulse"
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
                "icon": "HeartPulse"
            },
            {
                "title": "Sleep Consistency",
                "desc": f"With {sleep_hours}h sleep recorded, maintain a consistent bedtime schedule to bolster daily resilience.",
                "icon": "Moon"
            },
            {
                "title": "Cognitive Pacing",
                "desc": f"Adopt structured 35-minute study blocks across your {study_hours}h session with active resets.",
                "icon": "Clock"
            }
        ]
    else:  # Low
        return [
            {
                "title": "Autonomic Regulation",
                "desc": "Maintain emotional baseline stability by practicing periodic deep rhythmic breathing intervals throughout your day.",
                "icon": "HeartPulse"
            },
            {
                "title": "Sleep Consistency",
                "desc": f"Your {sleep_hours}h of sleep is supporting great cognitive recovery. Keep this steady rest schedule.",
                "icon": "Moon"
            },
            {
                "title": "Cognitive Pacing",
                "desc": f"Continue your positive daily {study_hours}h study cadence with mindful restorative breaks.",
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

    # Harmonize stress level with clinical psychometric scaled PSS score (0-10 scale)
    if payload.pss_score is not None:
        scaled_pss = round(float(payload.pss_score), 1)
        if scaled_pss >= 6.6:
            final_stress = "High"
        elif scaled_pss <= 3.5:
            final_stress = "Low"
        elif scaled_pss >= 5.5 and predicted_stress == "High":
            final_stress = "High"
        elif scaled_pss <= 4.0 and predicted_stress == "Low":
            final_stress = "Low"
        else:
            final_stress = "Moderate"
    else:
        final_stress = predicted_stress if predicted_stress in ["Low", "Moderate", "High"] else "Moderate"
        scaled_pss = 8.0 if final_stress == "High" else 5.5 if final_stress == "Moderate" else 2.5

    # 2. Link prediction and recommendations in Neo4j using Cypher
    now_iso = datetime.now(timezone.utc).isoformat()
    cypher_query = """
    MERGE (u:User {user_id: $user_id})
    SET u.id = $user_id
    CREATE (s:StressAssessment {
        id: randomUUID(),
        level: $level,
        label: $level,
        confidence: $confidence,
        score: $pss_score,
        pss_score: $pss_score,
        scaled_pss_score: $pss_score,
        user_id: $user_id,
        created_at: $created_at,
        timestamp: datetime()
    })
    CREATE (u)-[:RECORDED_ASSESSMENT]->(s)
    CREATE (u)-[:COMPLETED_ASSESSMENT]->(s)
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
                level=final_stress,
                confidence=confidence,
                pss_score=scaled_pss,
                created_at=now_iso,
            )
            records = list(result)

            if records:
                assessment_id = records[0]["assessment_id"]
                logger.info("Stress Assessment [%s] recorded in Neo4j for user %s with level %s (PSS: %s)",
                            assessment_id, payload.user_id, final_stress, scaled_pss)

            # Sync with longitudinal analytics (:Assessment) node
            try:
                from app.db.neo4j import save_assessment_to_graph
                save_assessment_to_graph(
                    user_id=str(payload.user_id),
                    score=scaled_pss,
                    label=final_stress,
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
        predicted_stress=final_stress,
        confidence=confidence,
        study_hours=payload.study_hours,
        sleep_hours=payload.sleep_hours,
        physical_activity_hours=payload.physical_activity_hours,
        extracurricular_hours=payload.extracurricular_hours,
        pss_score=scaled_pss,
        reflections=payload.reflections
    )

    # 4. Return JSON response
    return {
        "status": "success",
        "predicted_stress": final_stress,
        "stress_level": final_stress,
        "confidence": confidence,
        "pss_score": scaled_pss,
        "scaled_pss_score": scaled_pss,
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
        extracurricular_hours=payload.extracurricular_hours,
        pss_score=payload.pss_score,
        reflections=payload.reflections
    )
    return {
        "status": "success",
        "recommendations": recommendations
    }
