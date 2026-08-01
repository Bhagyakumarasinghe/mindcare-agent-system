import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def route_user_intent(user_input):
    """
    Classifies the user's intent to route the request to the correct AI Agent.
    """
    
    # Using the latest Gemini model as per your configuration
    selected_model = "gemini-3.1-flash-lite-preview"

    prompt_text = f"""
    You are an AI Orchestrator for MindCare, a Mental Health Support App for Sri Lankan students.
    Your job is to classify the user's intent based on their message.

    User Message: "{user_input}"

    Categories:
    1. 'ASSESSMENT': Use this ONLY if the user wants to start a NEW mental health test, begins a fresh check-in, or explicitly asks for a diagnostic quiz.
    2. 'THERAPY': Use this if the user is discussing feelings, problems (like exam stress), or ASKING ABOUT PREVIOUS ASSESSMENT RESULTS, past scores, or their history. 

    Special Logic:
    - If the user mentions "last assessment," "previous score," or "what did I mention before," categorize as 'THERAPY' so the Profiling Agent can retrieve their memory.
    - Do NOT trigger 'ASSESSMENT' for questions about past data.

    Response Rules:
    - Respond with ONLY the word 'ASSESSMENT' or 'THERAPY'.
    - Do not include any other text or punctuation.
    """

    try:
        response = client.models.generate_content(
            model=selected_model,
            contents=prompt_text
        )

        if response and hasattr(response, "text") and response.text:
            intent = response.text.strip().upper()
            
            # Strict filtering to ensure only expected keywords are returned
            if "ASSESSMENT" in intent:
                return "ASSESSMENT"
            else:
                return "THERAPY"
                
    except Exception as e:
        print(f"Orchestrator Error: {e}")
        # Defaulting to THERAPY ensures a conversational fallback rather than a rigid quiz
        return "THERAPY"

# Example Tests:
# print(route_user_intent("Start a new stress test")) -> Returns ASSESSMENT
# print(route_user_intent("What was my last assessment score?")) -> Returns THERAPY