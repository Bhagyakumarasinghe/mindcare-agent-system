import os
import time
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv

# අපේ Neo4j සහ Encryption Utilities import කිරීම
from app.db.neo4j import save_assessment_to_graph

load_dotenv()

# Gemini Client එක Initialize කිරීම
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def get_next_question(user_id, user_history):
    """
    user_id: MongoDB එකෙන් එන User ID එක (Neo4j වලට දත්ත යැවීමට අවශ්‍යයි)
    user_history: [{"question": "...", "answer": "..."}]
    """
    
    # 1. ආරම්භක ප්‍රශ්නය (History එකක් නැතිනම්)
    if not user_history:
        return "Hi! I'm your MindCare assistant. To start our check-in, how has your mood been over the last few days?"

    asked_questions = [item['question'].lower() for item in user_history]
    turn_count = len(user_history)

    # 2. භාවිතා කරන Model එක (ඔයාගේ AI Studio ලැයිස්තුවේ ඇති අලුත්ම එක)
    # 404 error එක එන්නේ gemini-1.5-flash දැන් පරණ නිසා.
    selected_model = "gemini-3.1-flash-lite-preview" 

    # Prompt එක සැකසීම
    prompt_text = f"""
    Role: Mental Health Assessment Agent for university students in Sri Lanka.
    Current Conversation History: {user_history}
    
    Instructions:
    - If total turns are {turn_count} and >= 5, return exactly: FINISH | [Score 1-10] | [Label]
    - Otherwise, ask ONE empathetic, short follow-up question related to mental well-being.
    - Avoid these previous topics: {asked_questions}
    - Maximum response length: 15 words.
    """

    # 3. SMART RETRY LOGIC (Rate limits සහ Quota issues වලට)
    max_retries = 2
    response_text = ""

    for attempt in range(max_retries):
        try:
            # Request එක යවන්න කලින් පොඩි විවේකයක් (Rate limit protection)
            time.sleep(1) 

            response = client.models.generate_content(
                model=selected_model,
                contents=prompt_text
            )

            if response and hasattr(response, "text") and response.text:
                response_text = response.text.strip()
                break 
            
        except Exception as e:
            error_str = str(e).lower()
            print(f"Attempt {attempt + 1} failed with {selected_model}: {e}")

            # 404 Error එකක් ආවොත් model alias එක වෙනස් කරමු
            if "404" in error_str:
                selected_model = "gemini-flash-lite-latest"
                continue

            # 429 Quota Error එකක් ආවොත් තත්පර 5ක් ඉමු
            if "429" in error_str and attempt < max_retries - 1:
                print("Quota exceeded. Retrying in 5 seconds...")
                time.sleep(5)
                continue
            break

    # --- NEO4J INTEGRATION (The Final Step) ---
    # AI එක Assessment එක ඉවර කළා නම්, ඒ දත්ත Neo4j වලට සේව් කරමු
    if response_text and "FINISH" in response_text:
        try:
            # AI එවූ Format එක: FINISH | 8 | Highly Stressed
            parts = response_text.split("|")
            if len(parts) >= 3:
                final_score = int(parts[1].strip())
                final_label = parts[2].strip()

                # Neo4j වෙත ආරක්ෂිතව (Encrypted) දත්ත යැවීම
                save_assessment_to_graph(
                    user_id=user_id, 
                    score=final_score, 
                    label=final_label, 
                    history=user_history
                )
            
            return response_text # FINISH | Score | Label

        except Exception as ex:
            print(f"Failed to sync assessment to Neo4j: {ex}")

    # AI එකෙන් සාමාන්‍ය ප්‍රශ්නයක් ආවා නම් ඒක යවන්න
    if response_text:
        return response_text

    # --- FALLBACK POOL (AI වැඩ නැතිනම් පමණක්) ---
    print("All AI attempts failed. Using static fallback.")
    fallback_pool = [
        "How has your sleep quality been over the past few nights?",
        "Are you feeling overwhelmed by your current academic workload?",
        "Have you been able to spend time with friends or family lately?",
        "How is your energy level usually by the end of the day?"
    ]
    
    for q in fallback_pool:
        if not any(q.lower()[:15] in asked for asked in asked_questions):
            return q
            
    return "Thank you for sharing. Is there anything else you'd like to tell me today?"