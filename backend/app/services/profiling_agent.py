import json
from app.db.neo4j import get_latest_assessment_data
from app.utils.encryption import decrypt_data

def get_student_profile_summary(user_id: str):
    """
    Retrieves the latest assessment for a specific user, decrypts the 
    sensitive history data, and generates a summarized context string 
    for the Therapy Agent to provide personalized support.
    """
    
    # --- STEP 1: FETCH DATA FROM NEO4J ---
    # Retrieves a dictionary containing encrypted_history, label, and score
    data = get_latest_assessment_data(user_id)
    
    # Check if data is valid and is a dictionary
    if not data or not isinstance(data, dict):
        # Standard context for a first-time user
        return "This is a new student. No previous mental health records found."

    try:
        # --- STEP 2: DECRYPTION & PARSING ---
        # Get the encrypted string from the database results
        encrypted_blob = data.get('encrypted_history')
        
        if not encrypted_blob:
            # Fallback if history is missing but status exists
            return f"The student was recently identified with '{data.get('label', 'Unknown')}' status."

        # Decrypt the ciphertext back into a plain JSON string using Fernet logic
        decrypted_json = decrypt_data(encrypted_blob)
        
        # Parse the JSON string into a Python list of dictionaries (Q&A history)
        history = json.loads(decrypted_json)
        
        # Ensure history is a list before slicing
        if not isinstance(history, list):
            return f"The student was recently identified with '{data.get('label', 'Unknown')}' status."

        # --- STEP 3: CONTEXT GENERATION ---
        # Basic summary header with the assessment outcome (Mental Health Status)
        summary = (
            f"The student was recently assessed with '{data.get('label')}' status "
            f"(Score: {data.get('score')}). In their last assessment, they mentioned: "
        )
        
        # Extract the last two interactions from the history to keep the LLM prompt concise
        # Using .get() for dictionary safety within the list comprehension
        recent_details = []
        for item in history[-2:]:
            if isinstance(item, dict):
                question = item.get('question', 'N/A')
                answer = item.get('answer', 'N/A')
                recent_details.append(f"{question} -> {answer}")
            
        details_str = ", ".join(recent_details) if recent_details else "No specific details shared."
        
        # Combine the status and the specific details into a single context string
        return summary + details_str

    except Exception as e:
        # Log the specific error for backend debugging
        print(f"❌ Profiling Agent Error during decryption/parsing: {e}")
        
        # Safe fallback: return only the basic label if decryption fails
        status_label = data.get('label', 'Unknown') if isinstance(data, dict) else "Unknown"
        return f"The student was recently identified with '{status_label}' status."

if __name__ == "__main__":
    # Test block for internal verification (Replace with a valid test ID)
    # test_id = "69ade7b62e360f1ac6666ecc"
    # print(get_student_profile_summary(test_id))
    pass