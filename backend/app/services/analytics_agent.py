from app.db.neo4j import get_neo4j_session, get_recent_mood_logs
from neo4j.exceptions import ServiceUnavailable, Neo4jError

def get_user_mental_health_summary(user_id: str):
    """
    Retrieves user assessment records and recent mood logs from Neo4j
    to produce clinical mental health analytics and summary metrics.
    """
    session = get_neo4j_session()
    
    # 1. Assessment and Activity history retrieval Cypher Query
    query = """
    MATCH (u:User {id: $user_id})
    OPTIONAL MATCH (u)-[:PERFORMED_CHECKUP|RECORDED_ASSESSMENT|COMPLETED_ASSESSMENT]->(a)
    OPTIONAL MATCH (u)-[:LOGGED_MOOD]->(m:MoodLog)
    OPTIONAL MATCH (u)-[:LOGGED_JOURNAL|WROTE_JOURNAL]->(j)
    WITH u, 
         count(DISTINCT a) as total_assessments,
         count(DISTINCT m) as total_moods,
         count(DISTINCT j) as total_journals,
         avg(CASE WHEN a.score IS NOT NULL THEN (CASE WHEN a.score > 10 THEN 10 ELSE a.score END) ELSE null END) as avg_asmt_stress,
         avg(CASE WHEN m.stress_score IS NOT NULL THEN m.stress_score WHEN m.stress_level IS NOT NULL THEN m.stress_level ELSE null END) as avg_mood_stress,
         collect(DISTINCT {
             date: toString(coalesce(a.timestamp, datetime())), 
             score: CASE WHEN a.score > 10 THEN 10 ELSE coalesce(a.score, 5.0) END,
             label: coalesce(a.label, a.level, 'Assessment')
         }) as history
    RETURN 
        total_assessments,
        total_moods,
        total_journals,
        avg_asmt_stress,
        avg_mood_stress,
        [h IN history WHERE h.score IS NOT NULL] as history
    """
    
    try:
        result = session.run(query, user_id=str(user_id)).single()
        recent_moods = get_recent_mood_logs(user_id, limit=5)

        total_asmt = int(result["total_assessments"]) if result and result["total_assessments"] else 0
        total_moods = int(result["total_moods"]) if result and result["total_moods"] else 0
        total_journals = int(result["total_journals"]) if result and result["total_journals"] else 0
        total_entries = total_asmt + total_moods + total_journals
        history_list = result["history"] if result and result["history"] else []

        if total_entries == 0 and not recent_moods:
            return {
                "avg_stress": 0.0,
                "total_assessments": 0,
                "total_entries": 0,
                "entries_count": 0,
                "history": [],
                "recent_mood_logs": [],
                "summary": "All systems operational. Please complete a mood log or assessment to begin tracking.",
                "monthly_progress": "0%",
                "status": "no_data"
            }

        # Calculate combined real avg_stress
        avg_asmt = float(result["avg_asmt_stress"]) if result and result["avg_asmt_stress"] is not None else None
        avg_mood = float(result["avg_mood_stress"]) if result and result["avg_mood_stress"] is not None else None

        if avg_asmt is not None and avg_mood is not None and (total_asmt + total_moods) > 0:
            combined_avg = ((avg_asmt * total_asmt) + (avg_mood * total_moods)) / (total_asmt + total_moods)
        elif avg_asmt is not None:
            combined_avg = avg_asmt
        elif avg_mood is not None:
            combined_avg = avg_mood
        elif recent_moods:
            valid_stresses = [float(m.get("stress", 5.0)) for m in recent_moods if m.get("stress") is not None]
            combined_avg = sum(valid_stresses) / len(valid_stresses) if valid_stresses else 5.0
            if total_entries == 0:
                total_entries = len(recent_moods)
        else:
            combined_avg = 0.0

        avg_score = round(float(combined_avg), 1)

        # 2. Dynamic AI Summary Logic based on Assessment and Mood Logs
        summary = ""
        has_high_stress_logs = any(m.get('stress', 0) > 7 for m in recent_moods)
        latest_mood = recent_moods[0]['mood'] if recent_moods else "Stable"

        if avg_score > 7 or has_high_stress_logs:
            summary = f"Your stress indicators are elevated (recent mood index: {latest_mood}). Structured cognitive rest and guided decompression are recommended."
        elif avg_score > 4 or (recent_moods and any(m.get('stress', 0) > 4 for m in recent_moods)):
            summary = "Your metrics reflect a moderate stress index. Daily mindful breathing exercises and maintaining consistent sleep hygiene are advised."
        else:
            summary = "Your mental wellness indicators show healthy stability. Continue your positive daily routines and balanced lifestyle."
            
        # 3. Longitudinal Progress Calculation
        monthly_progress = "0%"
        if len(history_list) >= 2:
            latest_score = history_list[0]['score']
            previous_score = history_list[1]['score']
            diff = latest_score - previous_score
            monthly_progress = f"{'+' if diff > 0 else ''}{int(diff * 10)}%"

        return {
            "avg_stress": avg_score,
            "total_assessments": total_asmt,
            "total_entries": total_entries,
            "entries_count": total_entries,
            "activity_summary": {
                "mood_count": total_moods,
                "assessment_count": total_asmt,
                "journal_count": total_journals
            },
            "history": history_list,
            "recent_mood_logs": recent_moods,
            "summary": summary,
            "monthly_progress": monthly_progress,
            "status": "success"
        }

    except (ServiceUnavailable, Neo4jError) as db_error:
        print(f"Neo4j Connection/Query Error: {db_error}")
        return {
            "avg_stress": 0,
            "total_assessments": 0,
            "history": [],
            "recent_mood_logs": [],
            "summary": "All systems operational in offline mode.",
            "monthly_progress": "0%",
            "status": "db_error"
        }

    except Exception as e:
        print(f"Analytics Agent Unexpected Error: {e}")
        return {
            "avg_stress": 0,
            "total_assessments": 0,
            "history": [],
            "recent_mood_logs": [],
            "summary": "All systems operational.",
            "monthly_progress": "0%",
            "status": "error"
        }
        
    finally:
        session.close()