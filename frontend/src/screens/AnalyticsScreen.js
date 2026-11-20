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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  ChevronRight,
  FileText,
  TrendingDown,
  Calendar,
  Activity,
  Heart,
  BookOpen,
  AlertCircle,
  ClipboardList,
  Download,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getUserSummary, getJournalSummary, getUserProfile } from '../api/authService';
import { generateClinicalHTMLReport } from '../utils/clinicalReportPdf';

// Module-level cache to provide instant transitions between screens
let cachedAnalytics = null;
let cachedJournalSummary = null;

export const invalidateAnalyticsCache = () => {
  cachedAnalytics = null;
  cachedJournalSummary = null;
};

const AnalyticsScreen = ({ navigation }) => {
  const [analytics, setAnalytics] = useState(cachedAnalytics);
  const [journalSummary, setJournalSummary] = useState(cachedJournalSummary);
  const [latestBiometrics, setLatestBiometrics] = useState(null);
  const [loading, setLoading] = useState(!cachedAnalytics);
  const [refreshing, setRefreshing] = useState(false);
  const [isNavigatingReport, setIsNavigatingReport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const isFetchingRef = useRef(false);

  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    // Invalidate module-level cache if a recent mood log flagged it as stale
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

    // Sync latest local biometrics cache immediately before network round-trips
    try {
      const cachedProfile = await AsyncStorage.getItem('@mindcare_cached_profile');
      let quickUid = '';
      if (cachedProfile) {
        const p = JSON.parse(cachedProfile);
        quickUid = p.id || p.user_id || '';
      }
      const [scopedBio, globalBio] = await Promise.all([
        quickUid ? AsyncStorage.getItem(`@mindcare_latest_biometrics_${quickUid}`) : null,
        AsyncStorage.getItem('@mindcare_latest_biometrics'),
      ]);
      const bioRaw = scopedBio || globalBio;
      if (bioRaw) {
        setLatestBiometrics(JSON.parse(bioRaw));
      }
    } catch (e) {
      // ignore
    }

    try {
      // Parallel fetch of user summary and user profile
      const [summaryResult, profileResult] = await Promise.allSettled([
        getUserSummary(),
        getUserProfile(),
      ]);

      let activeUserId = 'demo_user';
      if (profileResult.status === 'fulfilled' && profileResult.value?.data) {
        const pData = profileResult.value.data;
        activeUserId = pData.id || pData._id || pData.user_id || 'demo_user';
      }

      // Re-check scoped biometrics with resolved user ID
      try {
        const scopedBio = activeUserId
          ? await AsyncStorage.getItem(`@mindcare_latest_biometrics_${activeUserId}`)
          : null;
        if (scopedBio) {
          setLatestBiometrics(JSON.parse(scopedBio));
        }
      } catch (bioErr) {
        // ignore
      }

      if (summaryResult.status === 'fulfilled' && summaryResult.value?.data) {
        const dataPayload = summaryResult.value.data.data || summaryResult.value.data;
        cachedAnalytics = dataPayload;
        setAnalytics(dataPayload);
      }

      // Fetch longitudinal journal reflection patterns dynamically from Neo4j
      try {
        const jResult = await getJournalSummary(activeUserId);
        if (jResult?.data?.status === 'success') {
          cachedJournalSummary = jResult.data;
          setJournalSummary(jResult.data);
        }
      } catch (journalErr) {
        console.log('Journal summary fetch note:', journalErr.message || journalErr);
      }
    } catch (error) {
      console.warn('Analytics load notice:', error.message || error);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch updated analytics once per focus without freezing the UI or triggering re-render loops
  useFocusEffect(
    useCallback(() => {
      loadData(false);
      return () => {
        isFetchingRef.current = false;
      };
    }, [loadData])
  );

  const onRefresh = () => {
    loadData(true);
  };

  // Map clinical assessment history and recent mood check-ins into 7-day weekly metrics
  const mapHistoryToWeeklyTrend = (history, recentMoodLogs, localBio) => {
    const weeklyMap = [
      { day: 'Mon', val: 0, count: 0 },
      { day: 'Tue', val: 0, count: 0 },
      { day: 'Wed', val: 0, count: 0 },
      { day: 'Thu', val: 0, count: 0 },
      { day: 'Fri', val: 0, count: 0 },
      { day: 'Sat', val: 0, count: 0 },
      { day: 'Sun', val: 0, count: 0 },
    ];

    if (history && history.length > 0) {
      history.forEach((entry) => {
        if (entry.date && entry.score !== undefined) {
          const cleanDate = entry.date.split('.')[0].replace('Z', '');
          const dateObj = new Date(cleanDate);
          if (!isNaN(dateObj.getTime())) {
            let dayIdx = dateObj.getDay();
            let adjustedIdx = dayIdx === 0 ? 6 : dayIdx - 1;
            const safeScore = entry.score > 10 ? 10 : entry.score;
            weeklyMap[adjustedIdx].val += safeScore;
            weeklyMap[adjustedIdx].count += 1;
          }
        }
      });
    }

    // Blend recent mood logs into the 7-day trend
    const moodToStress = { Great: 2.0, Good: 3.5, Okay: 5.0, Bad: 7.5, Terrible: 9.0 };
    if (recentMoodLogs && Array.isArray(recentMoodLogs) && recentMoodLogs.length > 0) {
      recentMoodLogs.forEach((log) => {
        const rawDate = log.date || log.timestamp;
        if (rawDate) {
          const cleanDate = typeof rawDate === 'string' ? rawDate.split('.')[0].replace('Z', '') : rawDate;
          const dateObj = new Date(cleanDate);
          if (!isNaN(dateObj.getTime())) {
            let dayIdx = dateObj.getDay();
            let adjustedIdx = dayIdx === 0 ? 6 : dayIdx - 1;
            let stressVal = log.stress_score ?? log.stress_level;
            if (stressVal === null || stressVal === undefined) {
              stressVal = moodToStress[log.mood] ?? 5.0;
            }
            const safeScore = Math.min(10, Math.max(1, Number(stressVal)));
            weeklyMap[adjustedIdx].val += safeScore;
            weeklyMap[adjustedIdx].count += 1;
          }
        }
      });
    }

    // Blend local latestBiometrics if available for today
    if (localBio) {
      const today = new Date();
      let dayIdx = today.getDay();
      let adjustedIdx = dayIdx === 0 ? 6 : dayIdx - 1;
      let stressVal = localBio.stress_score ?? localBio.stress_level;
      if (stressVal === null || stressVal === undefined) {
        stressVal = moodToStress[localBio.mood] ?? 5.0;
      }
      const safeScore = Math.min(10, Math.max(1, Number(stressVal)));
      weeklyMap[adjustedIdx].val += safeScore;
      weeklyMap[adjustedIdx].count += 1;
    }

    const hasData = weeklyMap.some((item) => item.count > 0);
    if (!hasData) {
      return weeklyMap.map((d) => ({ day: d.day, val: 14 }));
    }

    return weeklyMap.map((item) => {
      const avgScoreForDay = item.count > 0 ? item.val / item.count : 0;
      return {
        day: item.day,
        val: avgScoreForDay > 0 ? Math.max(18, Math.min(100, avgScoreForDay * 10)) : 14,
      };
    });
  };

  const dynamicWeeklyTrend = mapHistoryToWeeklyTrend(
    analytics?.history,
    analytics?.recent_mood_logs,
    latestBiometrics
  );

  // Blend local biometrics with recent_mood_logs for immediate rendering
  const displayMoodLogs = useMemo(() => {
    const list = [...(analytics?.recent_mood_logs || [])];
    if (latestBiometrics) {
      const bioDate = latestBiometrics.date || latestBiometrics.timestamp || new Date().toISOString();
      const alreadyIncluded = list.some(
        (m) => (m.date && m.date === bioDate) || (m.timestamp && m.timestamp === bioDate) || (m.mood === latestBiometrics.mood && Math.abs(new Date(m.date || m.timestamp || 0) - new Date(bioDate)) < 60000)
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

  const fallbackHolistic = [
    { day: 'Mon', val: 14, score: 0, has_data: false },
    { day: 'Tue', val: 14, score: 0, has_data: false },
    { day: 'Wed', val: 14, score: 0, has_data: false },
    { day: 'Thu', val: 14, score: 0, has_data: false },
    { day: 'Fri', val: 14, score: 0, has_data: false },
    { day: 'Sat', val: 14, score: 0, has_data: false },
    { day: 'Sun', val: 14, score: 0, has_data: false },
  ];
  const holisticTrend =
    analytics?.holistic_wellness_trend && Array.isArray(analytics.holistic_wellness_trend) && analytics.holistic_wellness_trend.length === 7
      ? analytics.holistic_wellness_trend
      : fallbackHolistic;

  const analyticsData = {
    emotions: journalSummary?.emotions || journalSummary?.emotion_distribution || [],
    stress_factors: journalSummary?.stress_factors || journalSummary?.top_triggers || [],
    total_entries:
      journalSummary?.total_entries ??
      (displayMoodLogs?.length || 0),
    avg_sentiment: journalSummary?.avg_sentiment ?? 0.0,
  };

  // Clinical PDF Export Pipeline
  const handleExportPDF = async () => {
    if (isExporting) return;
    try {
      setIsExporting(true);

      const dynamicStress = analytics?.avg_stress !== undefined && analytics?.avg_stress !== null
        ? Number(analytics.avg_stress)
        : 4.1;

      const topTriggerItem = analyticsData.stress_factors && analyticsData.stress_factors.length > 0
        ? analyticsData.stress_factors[0]
        : null;

      const primaryTrigger = topTriggerItem
        ? topTriggerItem.category
        : (analytics?.common_trigger || 'Academic Workload');

      const triggerPercentage = topTriggerItem
        ? `${topTriggerItem.count} ${topTriggerItem.count === 1 ? 'entry' : 'entries'}`
        : (analytics?.trigger_percentage || '40%');

      const combinedData = {
        ...analytics,
        user_name: analytics?.user_name || 'Student',
        patient_id: analytics?.patient_id || 'MC-10492',
        avg_stress: dynamicStress,
        avg_sleep: latestBiometrics?.sleep_hours ?? analytics?.sleep_hours ?? analytics?.avg_sleep ?? 7.0,
        study_hours: analytics?.study_hours ?? 5.5,
        common_trigger: primaryTrigger,
        trigger_percentage: triggerPercentage,
        variance: analytics?.variance ?? 0,
        is_baseline: analytics?.is_baseline ?? true,
        recent_mood_logs: displayMoodLogs,
        activity_summary: {
          mood_count: displayMoodLogs?.length ?? (analytics?.total_entries ?? 0),
          support_count: analytics?.total_chats ?? 0,
          assessment_count: analytics?.total_assessments ?? 0,
          relaxation_count: analytics?.total_relaxations ?? 0,
        }
      };

      const htmlContent = generateClinicalHTMLReport(combinedData);
      await Print.printAsync({ html: htmlContent });
    } catch (error) {
      const msg = error?.message || '';
      if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('dismiss')) {
        console.warn('PDF Generation Error:', error);
        Alert.alert('Export Error', 'Unable to generate PDF report: ' + msg);
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0D9488" />
        }
      >
        {/* Header with Export Action */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Clinical Analytics</Text>
              <Text style={styles.headerSubtitle}>Self-Reflection & Clinical Wellness Trends</Text>
            </View>
            <TouchableOpacity
              style={styles.exportBtn}
              onPress={handleExportPDF}
              disabled={isExporting}
              activeOpacity={0.8}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#0D9488" style={{ marginRight: 6 }} />
              ) : (
                <Download color="#0D9488" size={16} style={{ marginRight: 6 }} />
              )}
              <Text style={styles.exportBtnText}>{isExporting ? 'Exporting...' : 'Export PDF'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Loading progress bar indicator (non-blocking) */}
        {loading && !analytics && (
          <View style={styles.loadingBanner}>
            <ActivityIndicator size="small" color="#0D9488" />
            <Text style={styles.loadingBannerText}>Updating clinical insights...</Text>
          </View>
        )}

        {/* Stats Summary Cards */}
        <View style={styles.statsRow}>
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <TrendingDown size={18} color="#0D9488" />
            </View>
            <Text style={styles.cardLabel}>7-DAY AVERAGE STRESS</Text>
            <Text style={styles.cardValue}>
              {analytics?.avg_stress !== undefined && analytics?.avg_stress !== null && !isNaN(Number(analytics?.avg_stress))
                ? `${Number(analytics.avg_stress).toFixed(1)}/10`
                : '4.1/10'}
            </Text>
            <Text
              style={[
                styles.cardSubText,
                { color: analytics?.avg_stress > 7 ? '#EF4444' : '#10B981' },
              ]}
            >
              {analytics?.avg_stress > 7 ? 'Elevated Range' : 'Balanced Range'}
            </Text>
          </View>

          <View style={styles.card}>
            <View style={[styles.iconCircle, { backgroundColor: '#F0FDFA' }]}>
              <Calendar size={18} color="#0D9488" />
            </View>
            <Text style={styles.cardLabel}>TOTAL ASSESSMENTS</Text>
            <Text style={styles.cardValue}>{analytics?.total_assessments ?? 0}</Text>
            <Text style={[styles.cardSubText, { color: '#0D9488' }]}>Logged evaluations</Text>
          </View>
        </View>

        {/* Weekly Resilience Index Chart */}
        <View style={styles.whiteCard}>
          <Text style={styles.cardTitle}>Assessment Progress Patterns</Text>
          <Text style={styles.cardSub}>Aggregated longitudinal stress balance</Text>
          <View style={styles.chartContainer}>
            {dynamicWeeklyTrend.map((item, index) => (
              <View key={index} style={styles.chartBarWrapper}>
                <View
                  style={[
                    styles.chartBar,
                    {
                      height: item.val,
                      backgroundColor: item.val > 65 ? '#0D9488' : '#99F6E4',
                      opacity: item.val <= 12 ? 0.35 : 1,
                    },
                  ]}
                />
                <Text style={styles.chartDayText}>{item.day}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Mood & Lifestyle Tracking Section Divider & Header */}
        <View style={styles.sectionDividerWrap}>
          <View style={styles.sectionDividerLine} />
          <View style={styles.sectionTitleBlock}>
            <Text style={styles.sectionMainTitle}>Mood & Lifestyle Tracking</Text>
            <Text style={styles.sectionMainSubtitle}>
              Daily affect, energy, sleep & trigger patterns
            </Text>
          </View>
        </View>

        {/* Recent Mood Records Section */}
        <View style={styles.moodSectionContainer}>
          <Text style={styles.sectionTitle}>Self-Reflection Logs</Text>
          {displayMoodLogs && displayMoodLogs.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.moodScrollContainer}
            >
              {displayMoodLogs.map((log, idx) => {
                const energyLabel = log.energy_level ? `${log.energy_level} Energy` : 'Steady Energy';

                const rawDate = log.date || log.timestamp;
                const dateStr = rawDate
                  ? new Date(rawDate.split('.')[0].replace('Z', '')).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'Today';

                const emotionLabel =
                  log.emotion_tags && Array.isArray(log.emotion_tags) && log.emotion_tags.length > 0
                    ? log.emotion_tags[0]
                    : null;

                const subtitle = emotionLabel ? `${emotionLabel} • ${dateStr}` : dateStr;

                return (
                  <View key={idx} style={styles.moodCard}>
                    <View style={styles.moodHeaderRow}>
                      <Heart size={18} color="#0D9488" />
                      <View
                        style={[
                          styles.moodStressTag,
                          {
                            backgroundColor: 'rgba(13, 148, 136, 0.12)',
                            borderColor: '#CCFBF1',
                            borderWidth: 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.moodStressTagText,
                            { color: '#0D9488' },
                          ]}
                          numberOfLines={1}
                        >
                          {energyLabel}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.moodNameText} numberOfLines={1}>
                      {log.mood || 'Reflection'}
                    </Text>
                    <Text style={styles.moodDateText} numberOfLines={1}>
                      {subtitle}
                    </Text>
                    {log.sleep_hours !== undefined && log.sleep_hours !== null && (
                      <View style={styles.moodMetaFooterRow}>
                        <View style={styles.moodMetaChip}>
                          <Text style={styles.moodMetaChipText}>
                            {typeof log.sleep_hours === 'number' ? log.sleep_hours.toFixed(1) : log.sleep_hours}h rest
                          </Text>
                        </View>
                        {log.stress_factors && Array.isArray(log.stress_factors) && log.stress_factors.length > 0 && log.stress_factors[0] !== 'None' && (
                          <View style={[styles.moodMetaChip, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
                            <Text style={[styles.moodMetaChipText, { color: '#475569' }]} numberOfLines={1}>
                              {log.stress_factors[0]}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.emptyMoodCard}>
              <Text style={styles.emptyMoodText}>No self-reflection mood logs recorded yet.</Text>
            </View>
          )}
        </View>

        {/* Mood & Trigger Insights */}
        <View style={styles.whiteCard}>
          <View style={styles.journalSummaryHeader}>
            <View style={styles.journalIconCircle}>
              <BookOpen size={18} color="#0D9488" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Mood & Trigger Insights</Text>
              <Text style={styles.cardSub}>Longitudinal emotional themes & stress triggers</Text>
            </View>
          </View>

          {analyticsData.total_entries === 0 && (!analyticsData.emotions || analyticsData.emotions.length === 0) ? (
            <View style={styles.emptyJournalState}>
              <Text style={styles.emptyJournalStateText}>
                No mood check-ins or reflection logs recorded yet.
              </Text>
            </View>
          ) : (
            <View style={styles.emotionsSection}>
              {/* EMOTIONAL REFLECTION PATTERNS */}
              {analyticsData.emotions && analyticsData.emotions.length > 0 && (
                <>
                  <Text style={styles.subSectionTitle}>EMOTIONAL REFLECTION PATTERNS</Text>
                  {analyticsData.emotions.map((item, index) => (
                    <View key={index} style={styles.emotionProgressRow}>
                      <View style={styles.emotionLabelRow}>
                        <Text style={styles.emotionLabelText}>{item.name}</Text>
                        <Text style={styles.emotionPercentText}>{item.percentage}% ({item.count} logs)</Text>
                      </View>
                      <View style={styles.emotionProgressBarTrack}>
                        <View 
                          style={[
                            styles.emotionProgressBarFill, 
                            { 
                              width: `${item.percentage}%`,
                              backgroundColor: index === 0 ? '#0D9488' : index === 1 ? '#0F766E' : index === 2 ? '#14B8A6' : '#5EEAD4'
                            }
                          ]} 
                        />
                      </View>
                    </View>
                  ))}
                </>
              )}

              {/* COMMON STRESS FACTORS */}
              {analyticsData.stress_factors && analyticsData.stress_factors.length > 0 && (
                <View style={styles.triggersSection}>
                  <Text style={styles.subSectionTitle}>COMMON STRESS FACTORS</Text>
                  <View style={styles.triggersBadgeWrap}>
                    {analyticsData.stress_factors.map((item, idx) => (
                      <View key={idx} style={styles.triggerBadgeItem}>
                        <AlertCircle size={13} color="#0F766E" />
                        <Text style={styles.triggerBadgeText}>
                          {item.category} ({item.count} {item.count === 1 ? 'entry' : 'entries'})
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Self-Reflection Balance (Warm clinical phrasing without raw NLP numbers) */}
              <View style={styles.sentimentIndexRow}>
                <Text style={styles.sentimentIndexLabel}>Self-Reflection Balance:</Text>
                <Text style={[styles.sentimentIndexValue, { color: '#0D9488' }]}>
                  {analyticsData.avg_sentiment > 0.2
                    ? 'Positive Adaptive Balance'
                    : analyticsData.avg_sentiment < -0.2
                    ? 'Elevated Stress State'
                    : 'Balanced Equilibrium'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Unified Holistic Wellness Index Chart */}
        <View style={styles.holisticCard}>
          <View style={styles.holisticHeaderRow}>
            <View style={styles.holisticIconCircle}>
              <Activity size={18} color="#0D9488" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cardTitle}>Holistic Wellness Index</Text>
              <Text style={styles.cardSub}>Combined daily score from Assessments, Mood, Sleep & Self-Care</Text>
            </View>
            {analytics?.avg_wellness_index !== undefined && (
              <View style={styles.holisticAvgBadge}>
                <Text style={styles.holisticAvgBadgeText}>{Math.round(analytics.avg_wellness_index)}/100</Text>
              </View>
            )}
          </View>

          <View style={styles.chartContainer}>
            {holisticTrend.map((item, index) => {
              const barHeight = Math.max(14, Math.min(100, item.val));
              const hasData = item.has_data !== false && item.val > 14;
              return (
                <View key={index} style={styles.chartBarWrapper}>
                  {hasData && (
                    <Text style={styles.holisticBarScoreText}>
                      {Math.round(item.score || item.val)}
                    </Text>
                  )}
                  <View
                    style={[
                      styles.chartBar,
                      {
                        height: barHeight,
                        backgroundColor: '#0D9488',
                        opacity: hasData ? 1 : 0.28,
                      },
                    ]}
                  />
                  <Text style={styles.chartDayText}>{item.day}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Clinical Insight Card (Warm Heart/Clipboard Icon, No Sparkles) */}
        <View style={styles.insightCard}>
          <View style={styles.insightIconCircle}>
            <Heart size={20} color="#0D9488" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.insightTitle}>MindCare Clinical Insight</Text>
            <Text style={styles.insightDescription}>
              {analytics?.summary ||
                'Consistent check-ins and reflection logs help illuminate behavioral recovery patterns.'}
            </Text>
          </View>
        </View>

        {/* Longitudinal Status Card */}
        <View
          style={[
            styles.progressCard,
            { backgroundColor: analytics?.avg_stress > 7 ? '#EF4444' : '#0D9488' },
          ]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={styles.progressLabel}>CLINICAL STATUS</Text>
              <Text style={styles.progressValue}>
                {analytics?.avg_stress > 7 ? 'Attention Required' : 'Optimal Balance'}
              </Text>
            </View>
            <View style={styles.progressIcon}>
              <Activity size={22} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.progressDescription}>
            Stress markers are calculated based on your longitudinal self-assessments. Progress index:{' '}
            {analytics?.monthly_progress || '0%'}
          </Text>
        </View>

        {/* Full Report Link */}
        <TouchableOpacity
          style={styles.reportRedirectCard}
          onPress={() => {
            navigation.navigate('WeeklyReport', {
              cachedReport: analytics,
              user_name: analytics?.user_name || 'Student',
              avg_stress: analytics?.avg_stress,
            });
          }}
          activeOpacity={0.8}
        >
          <View style={styles.reportIconCircle}>
            <FileText color="#0D9488" size={20} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.reportRedirectTitle}>View Comprehensive Report</Text>
            <Text style={styles.reportRedirectSub}>
              Download or share clinical PDF breakdown
            </Text>
          </View>
          <ChevronRight color="#94A3B8" size={20} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContainer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 96 },
  header: { marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#0F172A', letterSpacing: -0.4 },
  headerSubtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  exportBtnText: {
    color: '#0D9488',
    fontWeight: '700',
    fontSize: 13,
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  loadingBannerText: { fontSize: 12, color: '#0F766E', fontWeight: '500' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    width: '48%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  cardLabel: { fontSize: 10.5, color: '#64748B', fontWeight: '700', letterSpacing: 1.1 },
  cardValue: { fontSize: 22, fontWeight: '700', color: '#0F172A', marginTop: 2 },
  cardSubText: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  whiteCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  cardSub: { fontSize: 12, color: '#64748B', marginTop: 2, marginBottom: 16 },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingTop: 10,
    paddingBottom: 4,
  },
  chartBarWrapper: { alignItems: 'center', flex: 1 },
  chartBar: { width: 14, borderRadius: 7 },
  chartDayText: { fontSize: 11, color: '#64748B', marginTop: 8, fontWeight: '600' },
  moodSectionContainer: { marginBottom: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  moodScrollContainer: { paddingRight: 8 },
  moodCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 16,
    marginRight: 10,
    width: 152,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  moodHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  moodStressTag: { paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 8 },
  moodStressTagText: { fontSize: 10, fontWeight: '700' },
  moodNameText: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 2 },
  moodDateText: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  moodMetaFooterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
  },
  moodMetaChip: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: 120,
  },
  moodMetaChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0D9488',
  },
  emptyMoodCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  emptyMoodText: { fontSize: 13, color: '#64748B' },

  // Section Divider for Mood & Lifestyle Tracking
  sectionDividerWrap: {
    marginTop: 6,
    marginBottom: 16,
  },
  sectionDividerLine: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 14,
  },
  sectionTitleBlock: {
    marginBottom: 2,
  },
  sectionMainTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  sectionMainSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
  },

  // Holistic Wellness Index Card
  holisticCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    padding: 18,
    borderRadius: 24,
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  holisticHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  holisticIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  holisticAvgBadge: {
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  holisticAvgBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D9488',
  },
  holisticBarScoreText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#0D9488',
    marginBottom: 4,
  },

  insightCard: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 20,
    flexDirection: 'row',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  insightIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  insightTitle: { fontWeight: '700', fontSize: 15, color: '#0F172A' },
  insightDescription: { fontSize: 12.5, color: '#64748B', marginTop: 4, lineHeight: 18 },
  progressCard: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 18,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  progressLabel: { color: 'rgba(255, 255, 255, 0.85)', fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  progressValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginTop: 4 },
  progressIcon: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 12 },
  progressDescription: { color: 'rgba(255, 255, 255, 0.9)', fontSize: 12.5, marginTop: 10, lineHeight: 18 },
  reportRedirectCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  reportIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  reportRedirectTitle: { fontWeight: '700', fontSize: 15, color: '#0F172A' },
  reportRedirectSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  journalSummaryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  journalIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E6F4F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emotionsSection: { marginTop: 4 },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 6,
  },
  emotionProgressRow: { marginBottom: 12 },
  emotionLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  emotionLabelText: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  emotionPercentText: { fontSize: 12, fontWeight: '600', color: '#0D9488' },
  emotionProgressBarTrack: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  emotionProgressBarFill: { height: '100%', borderRadius: 4 },
  triggersSection: { marginTop: 14 },
  triggersBadgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  triggerBadgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  triggerBadgeText: { fontSize: 12, fontWeight: '600', color: '#0F766E' },
  sentimentIndexRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  sentimentIndexLabel: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  sentimentIndexValue: { fontSize: 12, fontWeight: '700' },
  emptyJournalState: { paddingVertical: 10, paddingHorizontal: 4 },
  emptyJournalStateText: { fontSize: 13, color: '#94A3B8', lineHeight: 19 },
});

export default AnalyticsScreen;