from app.db.neo4j import get_neo4j_session, get_recent_mood_logs
from neo4j.exceptions import ServiceUnavailable, Neo4jError

def get_user_mental_health_summary(user_id: str):
    """
    Neo4j database එකෙන් පරිශීලකයාගේ Assessment දත්ත සහ මෑතකදී සේව් වුණු Mood Logs
    ලබාගෙන වඩාත් නිවැරදි මානසික සෞඛ්‍ය විශ්ලේෂණයක් (Analytics) ලබා දීම.
    """
    session = get_neo4j_session()
    
    # 1. Assessment දත්ත ලබාගැනීම සඳහා වන Cypher Query
    query = """
    MATCH (u:User {id: $user_id})-[:PERFORMED_CHECKUP]->(a:Assessment)
    WITH a ORDER BY a.timestamp DESC
    RETURN 
        avg(CASE WHEN a.score > 10 THEN 10 ELSE a.score END) as avg_stress, 
        count(a) as total_assessments,
        collect({
            date: toString(a.timestamp), 
            score: CASE WHEN a.score > 10 THEN 10 ELSE a.score END,
            label: a.label
        }) as history
    """
    
    try:
        # Query එක run කිරීම
        result = session.run(query, user_id=str(user_id)).single()
        
        # 2. මෑතකදී සේව් වුණු Mood Logs දත්ත ලබා ගැනීම (neo4j.py එකෙන්)
        recent_moods = get_recent_mood_logs(user_id, limit=5)

        # ⚠️ Python syntax වලට අනුව JS (!) වෙනුවට 'not' keyword එක මෙලෙස යෙදිය යුතුය
        if (not result or result["total_assessments"] == 0) and not recent_moods:
            return {
                "avg_stress": 0.0,
                "total_assessments": 0,
                "history": [],
                "recent_mood_logs": [],
                "summary": "ප්‍රමාණවත් දත්ත පද්ධතිය තුළ නොමැත. කරුණාකර පළමුව Mood Log එකක් හෝ Assessment එකක් සම්පූර්ණ කරන්න.",
                "monthly_progress": "0%",
                "status": "no_data"
            }

        # Assessment දත්ත පිරිසිදු කරගැනීම
        raw_avg = result["avg_stress"] if result and result["avg_stress"] is not None else 0
        avg_score = round(float(raw_avg), 1)
        total_logs = result["total_assessments"] if result else 0
        history_list = result["history"] if result else []

        # 3. Dynamic AI Summary Logic (Assessment සහ Mood Logs දෙකම ඇසුරෙන්)
        summary = ""
        
        # මෑතකාලීන Mood රටාව හඳුනාගැනීම
        has_high_stress_logs = any(m.get('stress', 0) > 7 for m in recent_moods)
        latest_mood = recent_moods[0]['mood'] if recent_moods else "Unknown"

        if avg_score > 7 or has_high_stress_logs:
            summary = f"ඔබේ ආතති මට්ටම ඉහළ අගයක පවතී (මෑතකාලීන මනෝභාවය: {latest_mood}). අධ්‍යයන කටයුතු අතරතුර විවේකයක් ගැනීමට හෝ වෘත්තීය උපදේශනයක් ලබා ගැනීමට උත්සාහ කරන්න."
        elif avg_score > 4 or (recent_moods and any(m.get('stress', 0) > 4 for m in recent_moods)):
            summary = "ඔබ මධ්‍යස්ථ ආතති මට්ටමක පසුවේ. දෛනිකව හුස්ම ගැනීමේ ව්‍යායාම (Relaxation) සිදු කිරීම සහ ප්‍රමාණවත් නින්දක් ලබා ගැනීම යෝග්‍ය වේ."
        else:
            summary = "ඔබ ඉතා යහපත් මානසික මට්ටමක පසුවේ. අධ්‍යයන කටයුතු සහ ජීවන රටාව අතර මෙම සමබරතාවය (Study-Life Balance) තවදුරටත් පවත්වා ගැනීමට උත්සාහ කරන්න."
            
        # 4. Progress Calculation
        monthly_progress = "0%"
        if len(history_list) >= 2:
            latest_score = history_list[0]['score']
            previous_score = history_list[1]['score']
            
            diff = latest_score - previous_score
            monthly_progress = f"{'+' if diff > 0 else ''}{int(diff * 10)}%"

        return {
            "avg_stress": avg_score,
            "total_assessments": total_logs,
            "history": history_list,
            "recent_mood_logs": recent_moods,
            "summary": summary,
            "monthly_progress": monthly_progress,
            "status": "success"
        }

    except (ServiceUnavailable, Neo4jError) as db_error:
        print(f"❌ Neo4j Connection/Query Error: {db_error}")
        return {
            "avg_stress": 0,
            "total_assessments": 0,
            "history": [],
            "recent_mood_logs": [],
            "summary": "Database පද්ධතිය සමඟ සම්බන්ධ වීමේ දෝෂයක් පවතී.",
            "monthly_progress": "0%",
            "status": "db_error"
        }

    except Exception as e:
        print(f"❌ Analytics Agent Unexpected Error: {e}")
        return {
            "avg_stress": 0,
            "total_assessments": 0,
            "history": [],
            "recent_mood_logs": [],
            "summary": "දත්ත විශ්ලේෂණය කිරීමේදී දෝෂයක් සිදුවිය.",
            "monthly_progress": "0%",
            "status": "error"
        }
        
    finally:
        # Session එක වසා දැමීම
        session.close()