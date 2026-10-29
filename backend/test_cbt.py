import os, json
from google import genai
from dotenv import load_dotenv

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

topics = ["Exam Anxiety", "Deadline Pressure", "Self-Doubt & Fear"]

for topic in topics:
    prompt = f"""
    You are a Clinical CBT Specialist for university students.
    The student selected or expressed the topic: '{topic}'.
    
    Generate a distinct, clinically precise CBT reframe specifically tailored to '{topic}'.
    - If Exam Anxiety: target anticipatory failure and test distress.
    - If Deadline Pressure: target urgency panic, cognitive chunking, and time scarcity.
    - If Self-Doubt: target imposter syndrome and capability verification.

    Return strictly a JSON object:
    {{
      "thought_identification": "Concise distortion name and academic context",
      "reality_check": "One precise, grounding empirical reality check question",
      "cognitive_reframe": "One empowering, realistic, evidence-based reframing sentence"
    }}
    """
    res = client.models.generate_content(model="gemini-3.5-flash", contents=prompt)
    raw = res.text.strip()
    if "```" in raw:
        raw = raw.replace("```json", "").replace("```", "").strip()
    data = json.loads(raw)
    print(f"=== TOPIC: {topic} ===")
    print("Thought ID:", data.get("thought_identification"))
    print("Reality Check:", data.get("reality_check"))
    print("Cognitive Reframe:", data.get("cognitive_reframe"))
