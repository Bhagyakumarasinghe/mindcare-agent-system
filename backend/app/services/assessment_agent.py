import os
import json
from google import genai
from dotenv import load_dotenv
from app.db.neo4j import save_assessment_to_graph
from app.utils.encryption import encrypt_data

load_dotenv()

# ඉතා වැදගත්: flash-lite-latest සඳහා v1beta පාවිච්චි කළ යුතුයි
client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY"),
    http_options={'api_version': 'v1beta'}
)

def get_next_question(user_id, user_history):
    """
    ප්‍රශ්න 5ක් සම්පූර්ණ වන තෙක් Adaptive Assessment එක පවත්වාගෙන යෑම.
    """
    
    # 1. ආරම්භක ප්‍රශ්නය (History එක හිස් නම්)
    if not user_history or len(user_history) == 0:
        return {"question": "Hi! I'm your MindCare assistant. To start our check-in, how has your mood been over the last few days?"}

    asked_questions = [str(item.get('question', '')).lower().strip() for item in user_history]
    turn_count = len(user_history)
    
    # ඔයාට අවශ්‍ය මොඩලය මෙතන නිවැරදිව තියෙනවා
    SELECTED_MODEL = "gemini-flash-lite-latest"

    print(f"\n--- [DEBUG ASSESSMENT START] ---")
    print(f"Turn: {turn_count} | User: {user_id}")

    # 2. ප්‍රශ්න 5ක් සම්පූර්ණ වූ පසු Scoring සිදු කිරීම
    if turn_count >= 5:
        print("DEBUG: Final step reached. Analyzing conversation for scoring...")
        
        analysis_prompt = f"""
        Role: Student Mental Health Expert.
        Task: Analyze the provided conversation and assign a stress score from 0 to 10.
        Conversation: {json.dumps(user_history)}
        Return ONLY valid JSON: 
        {{"score": integer, "label": "Good/Moderate/High Stress", "summary": "brief summary"}}
        """

        try:
            analysis_res = client.models.generate_content(
                model=SELECTED_MODEL,
                contents=analysis_prompt,
                config={'response_mime_type': 'application/json'}
            )
            
            analysis_result = json.loads(analysis_res.text.strip())
            final_score = max(0, min(int(analysis_result.get("score", 5)), 10))
            final_label = analysis_result.get("label", "Completed")
            
            # Encryption සහ Neo4j ගබඩා කිරීම
            save_assessment_to_graph(user_id, final_score, final_label, encrypt_data(json.dumps(user_history)))
            return {"question": f"FINISH | {final_score} | {final_label}"}

        except Exception as err:
            print(f"!!! ANALYSIS ERROR !!!: {err}")
            save_assessment_to_graph(user_id, 5, "Completed", encrypt_data(json.dumps(user_history)))
            return {"question": "FINISH | 5 | Assessment Completed"}

    # 3. ඊළඟ ප්‍රශ්නය ලබා ගැනීමට AI කැඳවීම
    prompt_text = f"""
    Role: Student Mental Health AI. 
    Ask ONE brief (max 10 words) follow-up question based on the user's last answer: "{user_history[-1].get('answer')}".
    Constraint: Focus on academic workload, sleep, or social life. Do not repeat topics: {asked_questions}.
    Return ONLY JSON: {{"question": "your_question"}}
    """

    try:
        print(f"DEBUG: Requesting next question from {SELECTED_MODEL}...")
        response = client.models.generate_content(
            model=SELECTED_MODEL,
            contents=prompt_text,
            config={
                'response_mime_type': 'application/json',
                'temperature': 0.7
            }
        )
        
        # AI එකෙන් එන දත්ත terminal එකේ print කරලා බලන්න
        print(f"DEBUG AI RESPONSE: {response.text}")
        
        return json.loads(response.text.strip())

    except Exception as e:
        print(f"!!! AI ERROR !!!: {str(e)}")
        # Fallback Mechanism: AI එකේ මොනවා හරි අවුලක් ආවොත් මේ ප්‍රශ්න ටික පිළිවෙලට අහනවා
        fallbacks = [
            "How has your sleep quality been over the past few nights?",
            "Are you feeling overwhelmed by your academic workload?",
            "Have you been able to spend time with friends or family lately?",
            "How is your energy level usually by the end of the day?"
        ]
        return {"question": fallbacks[turn_count-1] if turn_count <= len(fallbacks) else "Tell me more about how you feel."}