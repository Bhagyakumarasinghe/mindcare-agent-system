import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Download,
  TrendingDown,
  Moon,
  Calendar,
  Flame,
  Wind,
  GraduationCap,
  ChevronRight,
  Activity,
  AlertCircle,
  Heart,
  MessageCircle,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { getUserSummary, getJournalSummary, getUserProfile } from '../api/authService';
import { generateClinicalHTMLReport, exportClinicalPDF, isAcademicTrigger } from '../utils/clinicalReportPdf';
import { getActivityStats, syncActivityStats, computeWeeklyStressTrend } from '../utils/activityTracker';

// Module-level cache to provide instant transitions between screens
let cachedAnalytics = null;
let cachedJournalSummary = null;

export const invalidateAnalyticsCache = () => {
  cachedAnalytics = null;
  cachedJournalSummary = null;
};

export default function AnalyticsScreen({ navigation }) {
  const [analytics, setAnalytics] = useState(cachedAnalytics);
  const [journalSummary, setJournalSummary] = useState(cachedJournalSummary);
  const [latestBiometrics, setLatestBiometrics] = useState(null);
  const [userName, setUserName] = useState('Student');
  const [activityStats, setActivityStats] = useState({
    relaxSessions: 0,
    relaxMinutes: 0,
    studySessions: 0,
    studyMinutes: 0,
  });
  const [loading, setLoading] = useState(!cachedAnalytics);
  const [refreshing, setRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const isFetchingRef = useRef(false);

  const roundOne = (num) => Math.round(Number(num) * 10) / 10;

  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    // Check if stale flag is set from a recent mood check-in
    try {
      const isStale = await AsyncStorage.getItem('@mindcare_analytics_cache_stale');
      if (isStale) {
        cachedAnalytics = null;
        cachedJournalSummary = null;
        await AsyncStorage.removeItem('@mindcare_analytics_cache_stale');
      }
    } catch (e) {
      // ignore
    }

    if (isManualRefresh) {
      setRefreshing(true);
    } else if (!cachedAnalytics) {
      setLoading(true);
    }

    // Hydrate latest biometrics immediately
    try {
      const cachedProfile = await AsyncStorage.getItem('@mindcare_cached_profile');
      let quickUid = '';
      if (cachedProfile) {
        const p = JSON.parse(cachedProfile);
        quickUid = p.id || p.user_id || '';
        if (p.first_name || p.name || p.fullName) {
          setUserName(p.first_name || p.name || p.fullName);
        }
      }
      const [scopedBio, globalBio] = await Promise.all([
        quickUid ? AsyncStorage.getItem(`@mindcare_latest_biometrics_${quickUid}`) : null,
        AsyncStorage.getItem('@mindcare_latest_biometrics'),
      ]);
      const bioRaw = scopedBio || globalBio;
      if (bioRaw) {
        setLatestBiometrics(JSON.parse(bioRaw));
      }

      // Load unified activity stats
      const stats = await getActivityStats(quickUid);
      setActivityStats(stats);
    } catch (e) {
      // ignore
    }

    try {
      const [summaryResult, profileResult] = await Promise.allSettled([
        getUserSummary(),
        getUserProfile(),
      ]);

      let activeUserId = 'demo_user';
      if (profileResult.status === 'fulfilled' && profileResult.value?.data) {
        const pData = profileResult.value.data;
        activeUserId = pData.id || pData._id || pData.user_id || 'demo_user';
        if (pData.first_name || pData.name || pData.fullName) {
          setUserName(pData.first_name || pData.name || pData.fullName);
        }
      }

      let dataPayload = null;
      if (summaryResult.status === 'fulfilled' && summaryResult.value?.data) {
        dataPayload = summaryResult.value.data.data || summaryResult.value.data;
        cachedAnalytics = dataPayload;
        setAnalytics(dataPayload);
      }

      // Re-sync scoped biometrics & stats with resolved user ID and backend payload
      try {
        const [scopedBio, stats] = await Promise.all([
          activeUserId ? AsyncStorage.getItem(`@mindcare_latest_biometrics_${activeUserId}`) : null,
          syncActivityStats(activeUserId, dataPayload),
        ]);
        if (scopedBio) {
          setLatestBiometrics(JSON.parse(scopedBio));
        } else {
          setLatestBiometrics(null);
        }
        if (stats) {
          setActivityStats(stats);
        }
      } catch (bioErr) {
        // ignore
      }

      // Longitudinal journal reflection patterns
      try {
        const jResult = await getJournalSummary(activeUserId);
        if (jResult?.data?.status === 'success') {
          cachedJournalSummary = jResult.data;
          setJournalSummary(jResult.data);
        }
      } catch (journalErr) {
        // ignore
      }
    } catch (error) {
      console.warn('Analytics load notice:', error.message || error);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Immediately hydrate local activity stats on focus for instant non-zero counts
      getActivityStats().then((stats) => {
        if (stats) setActivityStats(stats);
      });
      loadData(false);
      return () => {
        isFetchingRef.current = false;
      };
    }, [loadData])
  );

  const onRefresh = () => {
    loadData(true);
  };

  // Blend local biometrics with recent_mood_logs for live UI updates
  const displayMoodLogs = useMemo(() => {
    const list = [...(analytics?.recent_mood_logs || [])];
    if (latestBiometrics) {
      const bioDate = latestBiometrics.date || latestBiometrics.timestamp || new Date().toISOString();
      const alreadyIncluded = list.some(
        (m) =>
          (m.date && m.date === bioDate) ||
          (m.timestamp && m.timestamp === bioDate) ||
          (m.mood === latestBiometrics.mood &&
            Math.abs(new Date(m.date || m.timestamp || 0) - new Date(bioDate)) < 60000)
      );
      if (!alreadyIncluded) {
        list.unshift({
          ...latestBiometrics,
          date: bioDate,
        });
      }
    }
    return list;
  }, [analytics?.recent_mood_logs, latestBiometrics]);

  // Derived 3-Card Core Snapshot Values (neutral '--' / '0' when no logs)
  const rawAvgStress = useMemo(() => {
    if (analytics?.avg_stress !== undefined && analytics?.avg_stress !== null) {
      const n = Number(analytics.avg_stress);
      if (!isNaN(n) && n > 0) return roundOne(n);
    }
    if (latestBiometrics?.stress_score !== undefined && latestBiometrics?.stress_score !== null) {
      const n = Number(latestBiometrics.stress_score);
      if (!isNaN(n)) return roundOne(n);
    }
    return null;
  }, [analytics?.avg_stress, latestBiometrics]);

  const rawAvgSleep = useMemo(() => {
    if (latestBiometrics?.sleep_hours !== undefined && latestBiometrics?.sleep_hours !== null) {
      const n = Number(latestBiometrics.sleep_hours);
      if (!isNaN(n) && n > 0) return roundOne(n);
    }
    if (analytics?.sleep_hours !== undefined && analytics?.sleep_hours !== null) {
      const n = Number(analytics.sleep_hours);
      if (!isNaN(n) && n > 0) return roundOne(n);
    }
    if (analytics?.avg_sleep !== undefined && analytics?.avg_sleep !== null) {
      const n = Number(analytics.avg_sleep);
      if (!isNaN(n) && n > 0) return roundOne(n);
    }
    return null;
  }, [analytics?.sleep_hours, analytics?.avg_sleep, latestBiometrics]);

  const totalAssessments = analytics?.total_assessments ?? 0;

  // 7-Day Stress & Sleep metrics for Monday - Sunday (active fill ONLY when logged)
  const weeklyMetrics = useMemo(() => {
    return computeWeeklyStressTrend(analytics?.history, displayMoodLogs, latestBiometrics);
  }, [analytics?.history, displayMoodLogs, latestBiometrics]);

  // Real-time Mood Distribution computed from logs
  const moodDistribution = useMemo(() => {
    if (!displayMoodLogs || displayMoodLogs.length === 0) return [];
    const countMap = {};
    displayMoodLogs.forEach((log) => {
      const m = log.mood || 'Reflection';
      countMap[m] = (countMap[m] || 0) + 1;
    });
    const total = displayMoodLogs.length;
    const moodColors = {
      Great: '#0D9488',
      Good: '#14B8A6',
      Calm: '#0D9488',
      Reflective: '#0F766E',
      Okay: '#64748B',
      Bad: '#F59E0B',
      Terrible: '#DC2626',
      Overwhelmed: '#DC2626',
      Anxious: '#F97316',
    };
    return Object.keys(countMap)
      .map((name) => ({
        name,
        count: countMap[name],
        pct: Math.round((countMap[name] / total) * 100),
        color: moodColors[name] || '#0D9488',
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [displayMoodLogs]);

  // Common Stress Factors
  const stressFactorsList = useMemo(() => {
    const rawFactors = journalSummary?.stress_factors || journalSummary?.top_triggers;
    if (rawFactors && Array.isArray(rawFactors) && rawFactors.length > 0) {
      const total = rawFactors.reduce((acc, f) => acc + (f.count || 1), 0);
      return rawFactors.slice(0, 4).map((f) => ({
        name: f.category || f.name || 'Workload Tension',
        count: f.count || 1,
        pct: total > 0 ? Math.round(((f.count || 1) / total) * 100) : 50,
      }));
    }

    const counts = {};
    (displayMoodLogs || []).forEach((log) => {
      const list = Array.isArray(log.stress_factors)
        ? log.stress_factors
        : log.stress_factor && log.stress_factor !== 'None'
        ? [log.stress_factor]
        : [];
      list.forEach((t) => {
        if (t && t !== 'None') {
          counts[t] = (counts[t] || 0) + 1;
        }
      });
    });

    const entries = Object.keys(counts);
    if (entries.length === 0) return [];
    const total = entries.reduce((acc, k) => acc + counts[k], 0);
    return entries
      .map((name) => ({
        name,
        count: counts[name],
        pct: total > 0 ? Math.round((counts[name] / total) * 100) : 50,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [journalSummary, displayMoodLogs]);

  // Hybrid Agent + Clinical Rule-Based Recommendations Engine
  const recommendations = useMemo(() => {
    const candidates = [];
    const sleepVal = rawAvgSleep !== null ? rawAvgSleep : (analytics?.avg_sleep ? Number(analytics.avg_sleep) : 0);
    const stressVal = rawAvgStress !== null ? rawAvgStress : (analytics?.avg_stress ? Number(analytics.avg_stress) : 0);

    // 1. Stress-Level Rule
    if (stressVal >= 6.5) {
      candidates.push({
        id: 'stress-high-alert',
        title: 'Immediate Autonomic Reset',
        desc: 'Elevated cognitive tension detected. A 2-minute physiological sigh or box breathing cycle rapidly down-regulates sympathetic hyperarousal.',
        icon: 'Wind',
        actionText: 'Start 2m Reset',
        route: 'Relax',
        priority: 10,
      });
    } else if (stressVal >= 4.0) {
      candidates.push({
        id: 'stress-moderate',
        title: 'Parasympathetic Centering',
        desc: 'Moderate tension observed. Taking an intentional 2-minute breathwork pause clears working memory and stabilizes cognitive endurance.',
        icon: 'Wind',
        actionText: 'Mindful Pause',
        route: 'Relax',
        priority: 7,
      });
    }

    // 2. Sleep Hygiene Rule
    if (sleepVal > 0 && sleepVal < 7.0) {
      candidates.push({
        id: 'sleep-hygiene',
        title: 'Circadian Wind-Down',
        desc: `Your recent average sleep is ${sleepVal.toFixed(1)}h, below the recommended 7.5h restorative window. Setting a 30-minute electronic curfew before bed protects cognitive stamina.`,
        icon: 'Moon',
        actionText: 'Relaxation Reset',
        route: 'Relax',
        priority: 8,
      });
    }

    // 3. Trigger-Aware Pacing Rule
    const primaryTrigger =
      stressFactorsList.length > 0 ? stressFactorsList[0].name : analytics?.common_trigger || 'General Academic Studies';
    const isAcademic = isAcademicTrigger(primaryTrigger);

    if (isAcademic) {
      candidates.push({
        id: 'academic-pacing',
        title: 'Stress-Adapted Study Pacing',
        desc: 'Protect working memory from cognitive overload. Pair 25m or 45m focus blocks with 5m or 10m neural reset breaks to maintain deep focus.',
        icon: 'GraduationCap',
        actionText: 'Open Study Track',
        route: 'AplusTrack',
        priority: 6,
      });
    } else {
      candidates.push({
        id: 'priority-planning',
        title: 'Structured Priority Planning',
        desc: 'Break financial or personal tasks into small, scheduled 20-minute planning check-ins to reduce mental overwhelm and restore emotional clarity.',
        icon: 'MessageCircle',
        actionText: 'Open MindCare Chat',
        route: 'Chat',
        priority: 6,
      });
    }

    // 4. Activity Engagement Rule (Surface when sessions are zero)
    if (activityStats.relaxSessions === 0) {
      candidates.push({
        id: 'engagement-relax',
        title: 'Initiate Mindful Decompression',
        desc: 'Take your first guided 2-minute breathing cycle to establish your personal autonomic regulation baseline.',
        icon: 'Wind',
        actionText: 'Start Breathing',
        route: 'Relax',
        priority: 5,
      });
    } else if (activityStats.studySessions === 0) {
      candidates.push({
        id: 'engagement-study',
        title: 'Initial Focus Block',
        desc: 'Complete your first structured study session on your syllabus topics to build steady academic pacing without cognitive fatigue.',
        icon: 'GraduationCap',
        actionText: 'Open Study Track',
        route: 'AplusTrack',
        priority: 4,
      });
    }

    // 5. Backend Recommendations Ingestion (Merge any agent recommendations from backend)
    const backendRecs = analytics?.recommendations || analytics?.ai_recommendations;
    if (Array.isArray(backendRecs) && backendRecs.length > 0) {
      backendRecs.forEach((r, idx) => {
        if (!r) return;
        const rawTitle = typeof r === 'string' ? 'Clinical Insight' : (r.title || 'Wellness Protocol');
        const cleanTitle = rawTitle.replace(/\bAI\b/gi, 'MindCare').replace(/gemini/gi, 'MindCare').trim();
        const rawDesc = typeof r === 'string' ? r : (r.desc || r.description || '');
        const cleanDesc = rawDesc
          .replace(/\bAI-generated\b/gi, 'Evidence-based')
          .replace(/\bAI\b/gi, 'clinical')
          .replace(/gemini/gi, 'MindCare')
          .trim();

        if (cleanDesc) {
          candidates.push({
            id: `backend-rec-${idx}`,
            title: cleanTitle,
            desc: cleanDesc,
            icon: r.icon === 'Moon' ? 'Moon' : r.icon === 'Clock' ? 'GraduationCap' : 'Heart',
            actionText: r.actionText || 'Explore Guideline',
            route: r.route || (r.icon === 'Moon' || r.icon === 'Wind' ? 'Relax' : 'AplusTrack'),
            priority: 3,
          });
        }
      });
    }

    // 6. Default Fallback if candidates is empty
    if (candidates.length === 0) {
      candidates.push({
        id: 'calm-baseline',
        title: 'Parasympathetic Centering',
        desc: 'Your stress markers indicate a steady, balanced state. Taking intentional 2-minute breathwork pauses sustains mental clarity throughout the day.',
        icon: 'Heart',
        actionText: 'Mindful Pause',
        route: 'Relax',
        priority: 1,
      });
    }

    // Deduplicate by title prefix and sort by priority descending
    const seenTitles = new Set();
    const unique = [];
    candidates
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .forEach((item) => {
        const key = item.title.toLowerCase().slice(0, 14);
        if (!seenTitles.has(key)) {
          seenTitles.add(key);
          unique.push(item);
        }
      });

    // Cap strictly at top 3 cards without repeating "AI" buzzwords
    return unique.slice(0, 3);
  }, [rawAvgSleep, rawAvgStress, stressFactorsList, analytics, activityStats]);

  // Direct PDF Export Pipeline with Android FileProvider URI Fix
  const handleExportPDF = async () => {
    if (isExporting) return;
    try {
      setIsExporting(true);

      const dynamicStress = rawAvgStress !== null ? rawAvgStress : 4.1;
      const primaryTrigger =
        stressFactorsList.length > 0 ? stressFactorsList[0].name : analytics?.common_trigger || 'General Academic Studies';
      const triggerPercentage =
        stressFactorsList.length > 0
          ? `${stressFactorsList[0].pct}%`
          : analytics?.trigger_percentage || '40%';

      const combinedData = {
        ...analytics,
        user_name: userName || analytics?.user_name || 'Student',
        patient_id: analytics?.patient_id || 'MC-10492',
        avg_stress: dynamicStress,
        avg_sleep: rawAvgSleep ?? 7.0,
        study_hours: analytics?.study_hours ?? 5.5,
        common_trigger: primaryTrigger,
        primary_stress_vector: primaryTrigger,
        trigger_percentage: triggerPercentage,
        variance: analytics?.variance ?? 0,
        is_baseline: analytics?.is_baseline ?? true,
        recent_mood_logs: displayMoodLogs,
        weekly_metrics: weeklyMetrics,
        mood_distribution: moodDistribution,
        stress_factors: stressFactorsList,
        activity_stats: activityStats,
        activity_summary: {
          mood_count: displayMoodLogs?.length ?? (analytics?.total_entries ?? 0),
          support_count: analytics?.total_chats ?? 0,
          assessment_count: totalAssessments,
          relaxation_count: activityStats.relaxSessions || (analytics?.total_relaxations ?? 0),
          relaxation_minutes: activityStats.relaxMinutes || (activityStats.relaxSessions * 2),
          study_sessions: activityStats.studySessions || 0,
          study_minutes: activityStats.studyMinutes || (activityStats.studySessions * 25),
        },
      };

      const html = generateClinicalHTMLReport(combinedData);
      const { uri } = await Print.printToFileAsync({ html });

      // Copy the generated PDF to a clean, shareable cache URI with an explicit .pdf extension
      const fileName = `MindCare_Wellness_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      const targetUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.copyAsync({ from: uri, to: targetUri });

      try {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(targetUri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Export MindCare Clinical Wellness Report',
            UTI: 'com.adobe.pdf',
          });
        } else {
          await Print.printAsync({ html });
        }
      } catch (shareErr) {
        await Print.printAsync({ html });
      }
    } catch (error) {
      const msg = error?.message || '';
      if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('dismiss')) {
        console.warn('PDF export notice:', error);
        Alert.alert('Export Notice', 'Unable to complete PDF export: ' + msg);
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#EDF5F4" translucent={false} />
      {/* Signature Ambient Translucent Mint-Teal & Soft Aqua Background Circles */}
      <View pointerEvents="none" style={styles.ambientOrbTop} />
      <View pointerEvents="none" style={styles.ambientOrbMiddle} />
      <View pointerEvents="none" style={styles.ambientOrbBottom} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* 1. Header with Direct Export PDF Action */}
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Wellness Analytics</Text>
            <Text style={styles.headerSubtitle}>Longitudinal mood, sleep & resilience trends</Text>
          </View>

          <TouchableOpacity
            style={styles.exportPillBtn}
            onPress={handleExportPDF}
            disabled={isExporting}
            activeOpacity={0.8}
            accessibilityLabel="Export Clinical PDF Report"
          >
            {isExporting ? (
              <ActivityIndicator size="small" color="#0D9488" style={{ marginRight: 5 }} />
            ) : (
              <Download size={14} color="#0D9488" strokeWidth={2.5} style={{ marginRight: 5 }} />
            )}
            <Text style={styles.exportPillText}>{isExporting ? 'Exporting...' : 'Export PDF'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0D9488']} />
          }
        >
          {/* Visual Hero Banner: tool-analytics.jpg with Subtle Bottom Scrim */}
          <View style={styles.heroBannerCard}>
            <Image
              source={require('../../assets/images/tool-analytics.jpg')}
              style={styles.heroBannerImg}
              resizeMode="cover"
            />
            <View style={styles.heroBannerBottomScrim}>
              <View style={styles.heroTagPill}>
                <Text style={styles.heroTagPillText}>CLINICAL OVERVIEW</Text>
              </View>
              <Text style={styles.heroTitleText}>Your Holistic Wellbeing</Text>
              <Text style={styles.heroSubText}>
                Evidence-based longitudinal tracking of autonomic tone, rest & focus
              </Text>
            </View>
          </View>

          {/* 2. 3-Card Core Snapshot Row (Clean typography without decorative icon boxes) */}
          <View style={styles.snapshotRow}>
            {/* Card 1: Avg. Stress */}
            <View style={styles.snapshotCard}>
              <Text style={styles.snapshotLabel}>AVG. STRESS</Text>
              <Text style={styles.snapshotValue}>
                {rawAvgStress !== null ? `${rawAvgStress.toFixed(1)}/10` : '--'}
              </Text>
              <View
                style={[
                  styles.snapshotStatusBadge,
                  rawAvgStress !== null && rawAvgStress >= 6.5
                    ? styles.badgeElevated
                    : rawAvgStress !== null && rawAvgStress >= 4.0
                    ? styles.badgeWarning
                    : styles.badgeCalm,
                ]}
              >
                <Text
                  style={[
                    styles.snapshotStatusText,
                    rawAvgStress !== null && rawAvgStress >= 6.5
                      ? { color: '#DC2626' }
                      : rawAvgStress !== null && rawAvgStress >= 4.0
                      ? { color: '#B45309' }
                      : { color: '#0F766E' },
                  ]}
                  numberOfLines={1}
                >
                  {rawAvgStress === null
                    ? 'No Logs'
                    : rawAvgStress >= 6.5
                    ? 'High Alert'
                    : rawAvgStress >= 4.0
                    ? 'Moderate'
                    : 'Calm'}
                </Text>
              </View>
            </View>

            {/* Card 2: Avg. Sleep */}
            <View style={styles.snapshotCard}>
              <Text style={styles.snapshotLabel}>AVG. SLEEP</Text>
              <Text style={styles.snapshotValue}>
                {rawAvgSleep !== null ? `${rawAvgSleep.toFixed(1)}h` : '--'}
              </Text>
              <View
                style={[
                  styles.snapshotStatusBadge,
                  rawAvgSleep !== null && rawAvgSleep < 7.0
                    ? styles.badgeWarning
                    : styles.badgeCalm,
                ]}
              >
                <Text
                  style={[
                    styles.snapshotStatusText,
                    rawAvgSleep !== null && rawAvgSleep < 7.0
                      ? { color: '#B45309' }
                      : { color: '#0F766E' },
                  ]}
                  numberOfLines={1}
                >
                  {rawAvgSleep === null
                    ? 'No Logs'
                    : rawAvgSleep >= 7.0
                    ? 'Optimal'
                    : 'Needs Rest'}
                </Text>
              </View>
            </View>

            {/* Card 3: Assessments */}
            <View style={styles.snapshotCard}>
              <Text style={styles.snapshotLabel}>ASSESSMENTS</Text>
              <Text style={styles.snapshotValue}>{totalAssessments}</Text>
              <View style={[styles.snapshotStatusBadge, styles.badgeCalm]}>
                <Text style={[styles.snapshotStatusText, { color: '#0F766E' }]} numberOfLines={1}>
                  {totalAssessments > 0 ? 'Evaluations' : 'None Yet'}
                </Text>
              </View>
            </View>
          </View>

          {/* 3. Dual Pure-View Analytics Charts */}
          {/* Chart 1: 7-Day Stress Trend */}
          <View style={styles.whiteCard}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardSectionTitle}>7-Day Stress Trend</Text>
                <Text style={styles.cardSectionSubtitle}>
                  Daily autonomic & perceived stress indicators (Mon–Sun)
                </Text>
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: '#0D9488' }]} />
                <Text style={styles.legendText}>Calm</Text>
                <View style={[styles.legendDot, { backgroundColor: '#D97706', marginLeft: 6 }]} />
                <Text style={styles.legendText}>Moderate</Text>
                <View style={[styles.legendDot, { backgroundColor: '#DC2626', marginLeft: 6 }]} />
                <Text style={styles.legendText}>High Alert</Text>
              </View>
            </View>

            <View style={styles.stressChartContainer}>
              {weeklyMetrics.map((item, idx) => {
                const fillHeight = item.hasStress
                  ? Math.max(10, Math.min(64, (item.stressScore / 10) * 64))
                  : 0;
                const isHighAlert = item.hasStress && item.stressScore >= 6.5;
                const isModerate = item.hasStress && item.stressScore >= 4.0;
                const barColor = isHighAlert ? '#DC2626' : isModerate ? '#D97706' : '#0D9488';

                return (
                  <View key={idx} style={styles.chartCol}>
                    {item.hasStress ? (
                      <Text style={[styles.barScoreLabel, { color: barColor }]}>
                        {item.stressScore.toFixed(1)}
                      </Text>
                    ) : (
                      <Text style={styles.barEmptyLabel}>-</Text>
                    )}

                    {/* Background Capsule Track (height: 64) */}
                    <View style={styles.capsuleTrack}>
                      {item.hasStress ? (
                        <View
                          style={[
                            styles.capsuleFill,
                            {
                              height: fillHeight,
                              backgroundColor: barColor,
                            },
                          ]}
                        />
                      ) : null}
                    </View>

                    <Text style={styles.dayLabelText}>{item.day}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Chart 2: 7-Day Sleep & Mood Distribution */}
          <View style={styles.whiteCard}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardSectionTitle}>Sleep & Mood Distribution</Text>
                <Text style={styles.cardSectionSubtitle}>
                  Rest duration against target reference & affect breakdown
                </Text>
              </View>
              <View style={styles.targetPill}>
                <Text style={styles.targetPillText}>Target: 7.5h</Text>
              </View>
            </View>

            {/* Daily Sleep Mini-Bars */}
            <View style={styles.sleepSubSection}>
              <Text style={styles.subHeaderLabel}>DAILY SLEEP DURATION</Text>
              <View style={styles.sleepChartContainer}>
                {weeklyMetrics.map((item, idx) => {
                  const sHeight = item.hasSleep
                    ? Math.max(8, Math.min(52, (item.sleepHours / 10) * 52))
                    : 0;
                  const isOptimalSleep = item.hasSleep && item.sleepHours >= 7.0;

                  return (
                    <View key={idx} style={styles.sleepCol}>
                      {item.hasSleep ? (
                        <Text style={styles.sleepBarValText}>{item.sleepHours.toFixed(1)}h</Text>
                      ) : (
                        <Text style={styles.sleepBarValText}>-</Text>
                      )}
                      <View style={styles.sleepTrack}>
                        {item.hasSleep ? (
                          <View
                            style={[
                              styles.sleepFill,
                              {
                                height: sHeight,
                                backgroundColor: isOptimalSleep ? '#0D9488' : '#D97706',
                              },
                            ]}
                          />
                        ) : null}
                      </View>
                      <Text style={styles.dayLabelText}>{item.day}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Horizontal Mood Distribution Bars */}
            <View style={styles.moodSubSection}>
              <Text style={styles.subHeaderLabel}>MOOD DISTRIBUTION</Text>
              {moodDistribution.length > 0 ? (
                <View style={styles.moodBarsList}>
                  {moodDistribution.map((m, index) => (
                    <View key={index} style={styles.moodBarRow}>
                      <View style={styles.moodBarTextRow}>
                        <Text style={styles.moodBarName}>{m.name}</Text>
                        <Text style={styles.moodBarCount}>
                          {m.pct}% ({m.count} {m.count === 1 ? 'log' : 'logs'})
                        </Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${m.pct}%`, backgroundColor: m.color },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyMoodBlock}>
                  <Text style={styles.emptyMoodBlockText}>
                    Log moods to unlock mood breakdown
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* 4. Common Stress Factors */}
          <View style={styles.whiteCard}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardSectionTitle}>Common Stress Factors</Text>
                <Text style={styles.cardSectionSubtitle}>
                  Logged academic, workload & cognitive triggers
                </Text>
              </View>
              <View style={styles.triggerAlertBadge}>
                <AlertCircle size={12} color="#0F766E" />
                <Text style={styles.triggerAlertBadgeText}>Observed Triggers</Text>
              </View>
            </View>

            {stressFactorsList.length > 0 ? (
              <View style={styles.triggersList}>
                {stressFactorsList.map((factor, index) => (
                  <View key={index} style={styles.triggerBarRow}>
                    <View style={styles.triggerLabelRow}>
                      <Text style={styles.triggerNameText}>{factor.name}</Text>
                      <Text style={styles.triggerCountText}>
                        {factor.count} {factor.count === 1 ? 'entry' : 'entries'} ({factor.pct}%)
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(100, Math.max(12, factor.pct))}%`,
                            backgroundColor: index === 0 ? '#0D9488' : '#14B8A6',
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyTriggersBlock}>
                <Text style={styles.emptyTriggersText}>
                  No active stress triggers reported yet. Check in daily to track recurring pressure points.
                </Text>
              </View>
            )}
          </View>

          {/* 5. Personalized Wellness Recommendations */}
          <View style={styles.whiteCard}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardSectionTitle}>Personalized Recommendations</Text>
                <Text style={styles.cardSectionSubtitle}>
                  Adaptive self-care routines based on your actual metrics
                </Text>
              </View>
            </View>

            <View style={styles.recsList}>
              {recommendations.map((rec) => {
                let RecIcon = Heart;
                if (rec.icon === 'Moon') RecIcon = Moon;
                else if (rec.icon === 'Wind') RecIcon = Wind;
                else if (rec.icon === 'GraduationCap') RecIcon = GraduationCap;
                else if (rec.icon === 'MessageCircle') RecIcon = MessageCircle;

                return (
                  <View key={rec.id} style={styles.recCard}>
                    <View style={styles.recIconWrap}>
                      <RecIcon size={18} color="#0D9488" strokeWidth={2.2} />
                    </View>
                    <View style={styles.recContentWrap}>
                      <Text style={styles.recTitle}>{rec.title}</Text>
                      <Text style={styles.recDesc}>{rec.desc}</Text>
                      <TouchableOpacity
                        style={styles.recActionLink}
                        onPress={() => navigation.navigate(rec.route)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.recActionLinkText}>{rec.actionText}</Text>
                        <ChevronRight size={13} color="#0D9488" strokeWidth={2.5} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* 6. Sole Clean Bottom Action Button Card: Activity & Module Progress */}
          <TouchableOpacity
            style={styles.actionNavCard}
            onPress={() => navigation.navigate('ActivityProgress')}
            activeOpacity={0.88}
            accessibilityLabel="Open Activity & Module Progress"
          >
            <View style={styles.actionNavHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionNavTitle}>Activity & Module Progress</Text>
                <Text style={styles.actionNavSubtitle}>
                  Live relaxation sessions and study blocks
                </Text>
              </View>
              <View style={styles.actionNavBadge}>
                <Text style={styles.actionNavBadgeText}>
                  {activityStats.relaxSessions} Relax • {activityStats.studySessions} Study
                </Text>
              </View>
            </View>
            <View style={styles.actionNavFooter}>
              <Text style={styles.actionNavFooterText}>View Detailed Progress</Text>
              <ChevronRight size={15} color="#0D9488" strokeWidth={2.5} />
            </View>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF5F4',
  },
  safeArea: {
    flex: 1,
  },
  // Signature Ambient Background Circles (Matching HomeScreen.js & RelaxScreen.js)
  ambientOrbTop: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(45, 212, 191, 0.22)',
  },
  ambientOrbMiddle: {
    position: 'absolute',
    top: 360,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(20, 184, 166, 0.18)',
  },
  ambientOrbBottom: {
    position: 'absolute',
    bottom: 100,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleWrap: {
    flex: 1,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  exportPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1.2,
    borderColor: '#99F6E4',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  exportPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D9488',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 130,
  },

  // Hero Banner Card (Bright & Visible with subtle bottom scrim)
  heroBannerCard: {
    height: 150,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  heroBannerImg: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  heroBannerBottomScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'flex-end',
  },
  heroTagPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(13, 148, 136, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    marginBottom: 6,
  },
  heroTagPillText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroTitleText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroSubText: {
    color: '#E2E8F0',
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 3,
    fontWeight: '500',
  },

  // 3-Card Core Snapshot Row
  snapshotRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  snapshotCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  snapshotIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  snapshotLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  snapshotValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  snapshotStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  snapshotStatusText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  badgeCalm: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  badgeElevated: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  badgeWarning: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },

  // White Generic Content Card
  whiteCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  cardSectionSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 4,
  },
  legendText: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
  },
  targetPill: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  targetPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0D9488',
  },

  // 7-Day Stress Bar Chart
  stressChartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 106,
    paddingTop: 8,
  },
  chartCol: {
    alignItems: 'center',
    flex: 1,
  },
  barScoreLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#0D9488',
    marginBottom: 4,
    height: 14,
  },
  barEmptyLabel: {
    fontSize: 9.5,
    color: '#CBD5E1',
    marginBottom: 4,
    height: 14,
  },
  capsuleTrack: {
    width: 24,
    height: 64,
    borderRadius: 8,
    backgroundColor: 'rgba(13, 148, 136, 0.08)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'hidden',
  },
  capsuleFill: {
    width: '100%',
    borderRadius: 8,
  },
  dayLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 6,
  },

  // Sleep & Mood Companion Sections
  sleepSubSection: {
    marginBottom: 16,
  },
  subHeaderLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  sleepChartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 84,
  },
  sleepCol: {
    alignItems: 'center',
    flex: 1,
  },
  sleepBarValText: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 3,
    height: 12,
  },
  sleepTrack: {
    width: 18,
    height: 52,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  sleepFill: {
    width: '100%',
    borderRadius: 6,
  },
  moodSubSection: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 14,
  },
  moodBarsList: {
    gap: 10,
  },
  moodBarRow: {
    gap: 4,
  },
  moodBarTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  moodBarName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  moodBarCount: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  emptyMoodBlock: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyMoodBlockText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },

  // Common Stress Factors
  triggerAlertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  triggerAlertBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0F766E',
  },
  triggersList: {
    gap: 12,
  },
  triggerBarRow: {
    gap: 4,
  },
  triggerLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  triggerNameText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  triggerCountText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyTriggersBlock: {
    paddingVertical: 14,
  },
  emptyTriggersText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },

  // Personalized Recommendations
  recsList: {
    gap: 12,
  },
  recCard: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  recIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  recContentWrap: {
    flex: 1,
  },
  recTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  recDesc: {
    fontSize: 11.5,
    color: '#475569',
    lineHeight: 16,
    marginBottom: 6,
  },
  recActionLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recActionLinkText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0D9488',
    marginRight: 2,
  },

  // Bottom Navigation Action Cards
  actionNavCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  actionNavHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionNavThumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  actionNavIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionNavTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  actionNavSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  actionNavBadge: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  actionNavBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0D9488',
  },
  actionNavFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.7)',
    paddingTop: 10,
  },
  actionNavFooterText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0D9488',
  },
});
