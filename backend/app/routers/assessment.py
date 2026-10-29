"""
Assessment Evaluation Router & Fallback Service.
Handles PSS psychometric text evaluations and resilient fallback scoring.
"""
from fastapi import APIRouter, Depends
from app.routers.protected_routes import get_current_user
from app.routers.user_routes import (
    EvaluateResponseRequest,
    evaluate_assessment_response,
    estimate_likert_from_text
)

router = APIRouter(prefix="/assessment", tags=["Assessment Evaluator"])

@router.post("/evaluate-response")
async def evaluate_response(data: EvaluateResponseRequest, current_user: dict = Depends(get_current_user)):
    return await evaluate_assessment_response(data, current_user)
