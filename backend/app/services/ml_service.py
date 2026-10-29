import os
import warnings
import numpy as np
import pandas as pd
import joblib

# Suppress minor version warnings when loading the model
warnings.filterwarnings("ignore", category=UserWarning)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "ml", "stress_model.pkl")
LABEL_ENCODER_PATH = os.path.join(BASE_DIR, "ml", "stress_label_encoder.pkl")

# Load model and label encoder once on service initialization
stress_model = joblib.load(MODEL_PATH)
stress_label_encoder = joblib.load(LABEL_ENCODER_PATH)

FEATURE_COLUMNS = [
    'Study_Hours_Per_Day',
    'Extracurricular_Hours_Per_Day',
    'Sleep_Hours_Per_Day',
    'Physical_Activity_Hours_Per_Day'
]

def predict_stress_level(
    study_hours: float,
    extracurricular_hours: float,
    sleep_hours: float,
    physical_activity_hours: float
) -> dict:
    """
    Predicts student stress level based on daily habit hours.

    Args:
        study_hours: Study Hours Per Day
        extracurricular_hours: Extracurricular Hours Per Day
        sleep_hours: Sleep Hours Per Day
        physical_activity_hours: Physical Activity Hours Per Day

    Returns:
        dict: {"predicted_stress": label_str, "confidence": round(float(confidence), 2)}
    """
    data = pd.DataFrame(
        [[float(study_hours), float(extracurricular_hours), float(sleep_hours), float(physical_activity_hours)]],
        columns=FEATURE_COLUMNS
    )

    probabilities = stress_model.predict_proba(data)[0]
    predicted_index = int(np.argmax(probabilities))
    confidence = float(probabilities[predicted_index])
    label_str = str(stress_label_encoder.inverse_transform([predicted_index])[0])

    return {
        "predicted_stress": label_str,
        "confidence": round(float(confidence), 2)
    }
