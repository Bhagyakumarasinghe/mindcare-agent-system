import AsyncStorage from '@react-native-async-storage/async-storage';
import { logActivity } from '../api/authService';

/**
 * Unified Activity Tracker & Longitudinal Stress Trend Helper for MindCare
 * Manages live telemetry counters for relaxation sessions and study blocks across screens
 * Storage key:
 *  - Strict User-scoped: @mindcare_activity_stats_${userId}
 */

export const LEGACY_STORAGE_KEYS = [
  '@mindcare_latest_biometrics',
  '@mindcare_latest_biometrics_default',
  '@mindcare_activity_stats',
  '@mindcare_activity_stats_default',
  '@mindcare_mood_logs',
  '@mindcare_mood_logs_default',
  'mindcare_latest_assessment',
  'user_profile_image',
  'user',
];

/**
 * Purges all non-user-scoped and legacy fallback keys from AsyncStorage.
 * Must be called on login, register, and logout so new accounts never inherit old records.
 */
export const clearLegacyGlobalStorage = async () => {
  try {
    await AsyncStorage.multiRemove(LEGACY_STORAGE_KEYS);
  } catch (e) {
    console.warn('Error clearing legacy global storage:', e?.message || e);
  }
};

export const getActivityStats = async (userId) => {
  try {
    let targetId = userId;
    if (!targetId || targetId === 'demo_user') {
      const cachedProf = await AsyncStorage.getItem('@mindcare_cached_profile');
      if (cachedProf) {
        const p = JSON.parse(cachedProf);
        targetId = p.id || p.user_id || '';
      }
    }

    if (!targetId || targetId === 'demo_user') {
      return { relaxSessions: 0, relaxMinutes: 0, studySessions: 0, studyMinutes: 0, lastUpdated: Date.now() };
    }

    const scoped = await AsyncStorage.getItem(`@mindcare_activity_stats_${targetId}`);
    if (scoped) {
      const p = JSON.parse(scoped);
      let relaxSessions = Number(p.relaxSessions) || 0;
      let relaxMinutes = Number(p.relaxMinutes) || 0;
      let studySessions = Number(p.studySessions) || 0;
      let studyMinutes = Number(p.studyMinutes) || 0;

      if (relaxSessions > 0 && relaxMinutes === 0) {
        relaxMinutes = relaxSessions * 2;
      }
      if (studySessions > 0 && studyMinutes === 0) {
        studyMinutes = studySessions * 25;
      }

      return {
        relaxSessions,
        relaxMinutes,
        studySessions,
        studyMinutes,
        lastUpdated: p.lastUpdated || Date.now(),
      };
    }
  } catch (e) {
    console.warn('Error reading activity stats:', e.message || e);
  }
  return { relaxSessions: 0, relaxMinutes: 0, studySessions: 0, studyMinutes: 0, lastUpdated: Date.now() };
};

export const recordRelaxSession = async (userId, minutes = 2, activityType = 'Breathing Exercise', notes = '') => {
  try {
    let targetId = userId;
    if (!targetId || targetId === 'demo_user') {
      const cachedProf = await AsyncStorage.getItem('@mindcare_cached_profile');
      if (cachedProf) {
        const p = JSON.parse(cachedProf);
        targetId = p.id || p.user_id || '';
      }
    }

    const current = await getActivityStats(targetId);
    const addedMinutes = Math.max(1, Math.round(Number(minutes) || 2));

    const updated = {
      relaxSessions: (current.relaxSessions || 0) + 1,
      relaxMinutes: (current.relaxMinutes || 0) + addedMinutes,
      studySessions: current.studySessions || 0,
      studyMinutes: current.studyMinutes || 0,
      lastUpdated: Date.now(),
    };

    if (targetId && targetId !== 'demo_user') {
      await AsyncStorage.setItem(`@mindcare_activity_stats_${targetId}`, JSON.stringify(updated));
    }

    // Asynchronously synchronize session activity with backend telemetry
    try {
      logActivity({
        user_id: targetId && targetId !== 'demo_user' ? targetId : undefined,
        activity_type: activityType || 'Breathing Exercise',
        duration_minutes: addedMinutes,
        timestamp: new Date().toISOString(),
        notes: typeof notes === 'string' ? notes : JSON.stringify(notes || {}),
      }).catch((err) => {
        console.warn('Activity backend sync notice:', err?.message || err);
      });
    } catch {
      // Non-blocking telemetry
    }

    return updated;
  } catch (e) {
    console.warn('Error recording relax session:', e.message || e);
    return null;
  }
};

export const recordStudySession = async (userId, minutes = 25, studyGoal = 'Focus Timer', notes = '') => {
  try {
    let targetId = userId;
    if (!targetId || targetId === 'demo_user') {
      const cachedProf = await AsyncStorage.getItem('@mindcare_cached_profile');
      if (cachedProf) {
        const p = JSON.parse(cachedProf);
        targetId = p.id || p.user_id || '';
      }
    }

    const current = await getActivityStats(targetId);
    const addedMinutes = Math.max(1, Math.round(Number(minutes) || 25));

    const updated = {
      relaxSessions: current.relaxSessions || 0,
      relaxMinutes: current.relaxMinutes || 0,
      studySessions: (current.studySessions || 0) + 1,
      studyMinutes: (current.studyMinutes || 0) + addedMinutes,
      lastUpdated: Date.now(),
    };

    if (targetId && targetId !== 'demo_user') {
      await AsyncStorage.setItem(`@mindcare_activity_stats_${targetId}`, JSON.stringify(updated));
    }

    // Asynchronously synchronize session activity with backend telemetry
    try {
      logActivity({
        user_id: targetId && targetId !== 'demo_user' ? targetId : undefined,
        activity_type: 'Focus Timer',
        duration_minutes: addedMinutes,
        timestamp: new Date().toISOString(),
        notes: typeof notes === 'string' ? notes : JSON.stringify(notes || { goal: studyGoal }),
      }).catch((err) => {
        console.warn('Activity backend sync notice:', err?.message || err);
      });
    } catch {
      // Non-blocking telemetry
    }

    return updated;
  } catch (e) {
    console.warn('Error recording study session:', e.message || e);
    return null;
  }
};

/**
 * Synchronizes activity stats strictly scoped to this user
 * Guarantees that sessions and minutes take the maximum of local and backend counts
 */
export const syncActivityStats = async (userId, backendData = {}) => {
  try {
    let targetId = userId;
    if (!targetId || targetId === 'demo_user') {
      const cachedProf = await AsyncStorage.getItem('@mindcare_cached_profile');
      if (cachedProf) {
        const p = JSON.parse(cachedProf);
        targetId = p.id || p.user_id || '';
      }
    }

    const current = await getActivityStats(targetId);
    const actSummary = backendData?.activity_summary || {};

    const bRelaxSessions = Number(
      actSummary.relaxation_count ??
      actSummary.relaxSessions ??
      backendData?.relaxation_count ??
      backendData?.total_relaxations ??
      0
    );
    const bRelaxMinutes = Number(
      actSummary.relaxation_minutes ??
      actSummary.relaxMinutes ??
      backendData?.relaxation_minutes ??
      (bRelaxSessions * 2)
    );
    const bStudySessions = Number(
      actSummary.study_sessions ??
      actSummary.studySessions ??
      actSummary.study_count ??
      backendData?.study_sessions ??
      backendData?.completed_topics_count ??
      0
    );
    const bStudyMinutes = Number(
      actSummary.study_minutes ??
      actSummary.studyMinutes ??
      backendData?.study_minutes ??
      (bStudySessions * 25)
    );

    let finalRelaxSessions = Math.max(Number(current.relaxSessions) || 0, isNaN(bRelaxSessions) ? 0 : bRelaxSessions);
    let finalRelaxMinutes = Math.max(Number(current.relaxMinutes) || 0, isNaN(bRelaxMinutes) ? 0 : bRelaxMinutes);
    let finalStudySessions = Math.max(Number(current.studySessions) || 0, isNaN(bStudySessions) ? 0 : bStudySessions);
    let finalStudyMinutes = Math.max(Number(current.studyMinutes) || 0, isNaN(bStudyMinutes) ? 0 : bStudyMinutes);

    if (finalRelaxSessions > 0 && finalRelaxMinutes === 0) {
      finalRelaxMinutes = finalRelaxSessions * 2;
    }
    if (finalStudySessions > 0 && finalStudyMinutes === 0) {
      finalStudyMinutes = finalStudySessions * 25;
    }

    const merged = {
      relaxSessions: finalRelaxSessions,
      relaxMinutes: finalRelaxMinutes,
      studySessions: finalStudySessions,
      studyMinutes: finalStudyMinutes,
      lastUpdated: Date.now(),
    };

    if (targetId && targetId !== 'demo_user') {
      await AsyncStorage.setItem(`@mindcare_activity_stats_${targetId}`, JSON.stringify(merged));
    }

    return merged;
  } catch (e) {
    console.warn('Error syncing activity stats:', e.message || e);
    return await getActivityStats(userId);
  }
};

/**
 * Shared 7-Day Stress & Sleep metrics generator (Mon–Sun)
 * Used identically across HomeScreen and AnalyticsScreen
 */
export const computeWeeklyStressTrend = (history = [], moodLogs = [], latestBiometrics = null) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const map = days.map((day) => ({
    day,
    stressSum: 0,
    stressCount: 0,
    sleepSum: 0,
    sleepCount: 0,
  }));

  // 1. Clinical assessments
  if (history && Array.isArray(history)) {
    history.forEach((entry) => {
      if (entry.date && entry.score !== undefined) {
        const cleanDate = typeof entry.date === 'string' ? entry.date.split('.')[0].replace('Z', '') : entry.date;
        const d = new Date(cleanDate);
        if (!isNaN(d.getTime())) {
          let dayIdx = d.getDay();
          let adjustedIdx = dayIdx === 0 ? 6 : dayIdx - 1;
          const safeScore = Math.min(10, Math.max(0, Number(entry.score)));
          map[adjustedIdx].stressSum += safeScore;
          map[adjustedIdx].stressCount += 1;
        }
      }
    });
  }

  // 2. Mood check-in logs
  const moodToStress = { Great: 2.0, Good: 3.5, Okay: 5.0, Bad: 7.5, Terrible: 9.0 };
  const blendedLogs = [...(moodLogs || [])];
  if (latestBiometrics) {
    const bioDate = latestBiometrics.date || latestBiometrics.timestamp || new Date().toISOString();
    const alreadyIncluded = blendedLogs.some(
      (m) =>
        (m.date && m.date === bioDate) ||
        (m.timestamp && m.timestamp === bioDate) ||
        (m.mood === latestBiometrics.mood &&
          Math.abs(new Date(m.date || m.timestamp || 0) - new Date(bioDate)) < 60000)
    );
    if (!alreadyIncluded) {
      blendedLogs.unshift({
        ...latestBiometrics,
        date: bioDate,
      });
    }
  }

  if (blendedLogs && Array.isArray(blendedLogs)) {
    blendedLogs.forEach((log) => {
      const rawDate = log.date || log.timestamp;
      if (rawDate) {
        const cleanDate = typeof rawDate === 'string' ? rawDate.split('.')[0].replace('Z', '') : rawDate;
        const d = new Date(cleanDate);
        if (!isNaN(d.getTime())) {
          let dayIdx = d.getDay();
          let adjustedIdx = dayIdx === 0 ? 6 : dayIdx - 1;

          let stressVal = log.stress_score ?? log.stress_level;
          if (stressVal === null || stressVal === undefined) {
            stressVal = moodToStress[log.mood] ?? 5.0;
          }
          map[adjustedIdx].stressSum += Math.min(10, Math.max(0, Number(stressVal)));
          map[adjustedIdx].stressCount += 1;

          if (log.sleep_hours !== undefined && log.sleep_hours !== null) {
            const sNum = Number(log.sleep_hours);
            if (!isNaN(sNum) && sNum > 0) {
              map[adjustedIdx].sleepSum += sNum;
              map[adjustedIdx].sleepCount += 1;
            }
          }
        }
      }
    });
  }

  // 3. Blend latest local biometrics for today if not already counted
  if (latestBiometrics) {
    const today = new Date();
    let dayIdx = today.getDay();
    let adjustedIdx = dayIdx === 0 ? 6 : dayIdx - 1;
    if (map[adjustedIdx].stressCount === 0) {
      let sVal =
        latestBiometrics.stress_score ??
        latestBiometrics.stress_level ??
        moodToStress[latestBiometrics.mood] ??
        5.0;
      map[adjustedIdx].stressSum += Math.min(10, Math.max(0, Number(sVal)));
      map[adjustedIdx].stressCount += 1;
    }
    if (map[adjustedIdx].sleepCount === 0 && latestBiometrics.sleep_hours) {
      const sNum = Number(latestBiometrics.sleep_hours);
      if (!isNaN(sNum) && sNum > 0) {
        map[adjustedIdx].sleepSum += sNum;
        map[adjustedIdx].sleepCount += 1;
      }
    }
  }

  return map.map((item) => {
    const hasStress = item.stressCount > 0;
    const stressScore = hasStress ? Number((item.stressSum / item.stressCount).toFixed(1)) : 0;
    const hasSleep = item.sleepCount > 0;
    const sleepHours = hasSleep ? Number((item.sleepSum / item.sleepCount).toFixed(1)) : 0;
    return {
      day: item.day,
      hasData: hasStress,
      hasStress,
      score: stressScore,
      stressScore,
      val: hasStress ? Math.max(10, Math.min(64, (stressScore / 10) * 64)) : 0,
      hasSleep,
      sleepHours,
    };
  });
};
