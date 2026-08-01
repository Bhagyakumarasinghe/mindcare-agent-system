import os
import json
from google import genai
from dotenv import load_dotenv

# Import internal modules for database, context retrieval, and security
from app.db.neo4j import save_chat_to_graph
from app.services.profiling_agent import get_student_profile_summary
from app.utils.encryption import encrypt_data

# Load environment variables from .env file
load_dotenv()

# Initialize the Gemini Generative AI Client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def get_therapy_response(user_id: str, user_message: str):
    """
    Handles the therapy session flow:
    1. Fetches student history from the Profiling Agent.
    2. Generates a personalized CBT-based response using Gemini.
    3. Encrypts the conversation data.
    4. Saves the interaction to Neo4j.
    """
    
    # --- STEP 1: CONTEXT RETRIEVAL ---
    # Fetch the decrypted profile summary (last assessments, etc.)
    student_context = get_student_profile_summary(user_id)
    
    selected_model = "gemini-flash-lite-latest"

    # --- STEP 2: PROMPT ENGINEERING ---
    # Constructing a detailed prompt that includes user context for personalization
    prompt_text = f"""
    Role: You are MindCare AI, a warm, compassionate CBT-based companion for university students in Sri Lanka.
    
    Student's History Context: {student_context}
    
    Instructions:
    - If the context shows stress, poor sleep, or academic pressure, acknowledge it subtly.
    - Help identify Thoughts, Feelings, and Behaviors using CBT principles.
    - Suggest one tiny, actionable behavioral step (e.g., breathing, drinking water, short walk).
    - Tone: Friendly, peer-to-peer, supportive. NOT clinical or robotic.
    - Counselor Policy: Only suggest professional help for extreme crises (self-harm/danger).
    - Response length: Max 50 words.

    Return the output EXACTLY in this JSON format:
    {{
      "reply": "your empathetic response here",
      "mood": "One-word mood (e.g., Sad, Stressed, Happy, Tired)"
    }}

    User Message: "{user_message}"
    """

    try:
        # --- STEP 3: AI GENERATION ---
        # Requesting a structured JSON response from Gemini
        response = client.models.generate_content(
            model=selected_model,
            contents=prompt_text,
            config={'response_mime_type': 'application/json'}
        )
        
        # Parse the JSON string from Gemini response
        res_data = json.loads(response.text.strip())
        ai_reply = res_data.get("reply", "I'm here for you. Tell me more about how you're feeling.")
        detected_mood = res_data.get("mood", "Neutral")

        # --- STEP 4: ENCRYPTION & STORAGE ---
        # Encrypt the messages to ensure privacy in the Neo4j database
        encrypted_user_msg = encrypt_data(user_message)
        encrypted_ai_res = encrypt_data(ai_reply)

        # Save to the graph database with the 'THERAPY' intent
        save_chat_to_graph(
            user_id, 
            encrypted_user_msg, 
            encrypted_ai_res, 
            "THERAPY", 
            detected_mood
        )

        return ai_reply

    except Exception as e:
        # Log the error for debugging
        print(f"Therapy Agent Error: {e}")
        
        # Standard fallback response
        fallback_msg = "I'm here to listen. Would you like to tell me more about what's on your mind?"
        
        try:
            # Attempt to save the fallback interaction (still encrypted)
            enc_user = encrypt_data(user_message)
            enc_fallback = encrypt_data(fallback_msg)
            save_chat_to_graph(user_id, enc_user, enc_fallback, "THERAPY", "Neutral")
        except:
            # Final safeguard if database call fails
            pass
            
        return fallback_msg