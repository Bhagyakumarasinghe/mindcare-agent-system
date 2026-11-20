from app.db.neo4j import get_neo4j_session, get_recent_mood_logs
from neo4j.exceptions import ServiceUnavailable, Neo4jError

def get_user_mental_health_summary(user_id: str):
    """
    Retrieves user assessment records and recent mood logs strictly scoped from Neo4j
    to produce clinical mental health analytics and summary metrics in exact chronological order.
    """
    session = get_neo4j_session()
    
    try:
        # 1. Fetch user-owned assessments ordered strictly newest-first
        asmt_query = """
        MATCH (u:User)-[:COMPLETED_ASSESSMENT|PERFORMED_CHECKUP]->(a:Assessment)
        WHERE u.user_id = $user_id OR u.id = $user_id
        RETURN coalesce(a.scaled_pss_score, a.pss_score, a.score, CASE coalesce(a.level, a.label) WHEN 'High' THEN 8.0 WHEN 'Moderate' THEN 5.5 WHEN 'Low' THEN 2.5 ELSE 5.0 END) AS score,
               coalesce(a.level, a.label, 'Moderate') AS level,
               coalesce(a.created_at, toString(a.timestamp), toString(datetime())) AS date,
               coalesce(a.timestamp, a.created_at) AS raw_ts
        ORDER BY coalesce(a.timestamp, a.created_at) DESC, elementId(a) DESC
        LIMIT 20
        """
        asmt_records = session.run(asmt_query, user_id=str(user_id)).data()

        # 2. Activity counts strictly scoped to this user
        counts_query = """
        MATCH (u:User)
        WHERE u.user_id = $user_id OR u.id = $user_id
        OPTIONAL MATCH (u)-[:LOGGED_MOOD]->(m:MoodLog)
        OPTIONAL MATCH (u)-[:LOGGED_JOURNAL|WROTE_JOURNAL]->(j)
        RETURN count(DISTINCT m) AS total_moods,
               count(DISTINCT j) AS total_journals,
               avg(CASE WHEN m.stress_score IS NOT NULL THEN m.stress_score WHEN m.stress_level IS NOT NULL THEN m.stress_level ELSE null END) AS avg_mood_stress
        """
        counts_res = session.run(counts_query, user_id=str(user_id)).single()
        recent_moods = get_recent_mood_logs(user_id, limit=5)

        total_asmt = len(asmt_records)
        total_moods = int(counts_res["total_moods"]) if counts_res and counts_res.get("total_moods") else 0
        total_journals = int(counts_res["total_journals"]) if counts_res and counts_res.get("total_journals") else 0
        total_entries = total_asmt + total_moods + total_journals

        history_list = [
            {
                "date": str(r["date"]),
                "score": round(float(r["score"]), 1) if r.get("score") is not None else 5.0,
                "level": str(r["level"]),
                "label": str(r["level"])
            }
            for r in asmt_records
        ]

        latest_assessment = history_list[0] if history_list else None
        latest_assessment_score = latest_assessment["score"] if latest_assessment else None
        latest_assessment_level = latest_assessment["level"] if latest_assessment else None

        if total_entries == 0 and not recent_moods:
            return {
                "avg_stress": 0.0,
                "latest_assessment_score": None,
                "latest_assessment_level": None,
                "total_assessments": 0,
                "total_entries": 0,
                "entries_count": 0,
                "history": [],
                "recent_mood_logs": [],
                "summary": "All systems operational. Please complete a mood log or assessment to begin tracking.",
                "monthly_progress": "0%",
                "status": "no_data"
            }

        # Calculate real avg_stress purely driven by actual Clinical Stress Assessments (:Assessment nodes)
        avg_asmt = (sum(h["score"] for h in history_list) / len(history_list)) if history_list else None
        
        if avg_asmt is not None:
            combined_avg = avg_asmt
        else:
            combined_avg = 0.0

        avg_score = round(float(combined_avg), 1)

        # 3. Dynamic AI Summary Logic based on Assessment and Mood Logs
        summary = ""
        latest_mood = recent_moods[0]['mood'] if recent_moods else "Stable"

        if avg_score > 7:
            summary = f"Your clinical stress indicators are elevated (recent mood: {latest_mood}). Structured cognitive rest and guided decompression are recommended."
        elif avg_score > 4:
            summary = f"Your metrics reflect a moderate stress index (recent mood: {latest_mood}). Daily mindful breathing exercises and maintaining consistent sleep hygiene are advised."
        elif avg_score > 0:
            summary = f"Your stress indicators reflect a low and balanced state (recent mood: {latest_mood}). Continue your positive daily routines and balanced lifestyle."
        else:
            summary = f"Recent mood logged as {latest_mood}. Complete a clinical assessment to generate personalized stress metrics."
            
        # 4. Longitudinal Progress Calculation
        monthly_progress = "0%"
        if len(history_list) >= 2:
            latest_score = history_list[0]['score']
            previous_score = history_list[1]['score']
            diff = latest_score - previous_score
            monthly_progress = f"{'+' if diff > 0 else ''}{int(diff * 10)}%"

        # 5. Extract latest sleep and average sleep metrics from recent mood logs
        all_sleeps = [float(m["sleep_hours"]) for m in recent_moods if m.get("sleep_hours") is not None]
        latest_sleep = all_sleeps[0] if all_sleeps else 7.0
        avg_sleep = round(sum(all_sleeps) / len(all_sleeps), 1) if all_sleeps else 7.0

        return {
            "avg_stress": avg_score,
            "latest_assessment_score": latest_assessment_score,
            "latest_assessment_level": latest_assessment_level,
            "total_assessments": total_asmt,
            "total_entries": total_entries,
            "entries_count": total_entries,
            "sleep_hours": latest_sleep,
            "avg_sleep": avg_sleep,
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
            "latest_assessment_score": None,
            "latest_assessment_level": None,
            "total_assessments": 0,
            "sleep_hours": 7.0,
            "avg_sleep": 7.0,
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
            "latest_assessment_score": None,
            "latest_assessment_level": None,
            "total_assessments": 0,
            "sleep_hours": 7.0,
            "avg_sleep": 7.0,
            "history": [],
            "recent_mood_logs": [],
            "summary": "All systems operational.",
            "monthly_progress": "0%",
            "status": "error"
        }
        
    finally:
        session.close()