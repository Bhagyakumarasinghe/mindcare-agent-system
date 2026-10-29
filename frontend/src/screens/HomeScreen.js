import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  MessageSquare,
  HeartPulse,
  Wind,
  BarChart3,
  ClipboardList,
  ChevronRight,
  X,
  Clock,
} from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserProfile, getUserAnalytics } from '../api/authService';

export default function HomeScreen({ navigation }) {
  const [userName, setUserName] = useState('User');
  const [analytics, setAnalytics] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const [isCrunchMode, setIsCrunchMode] = useState(false);

  const fetchUserData = useCallback(async () => {
    try {
      const response = await getUserProfile();
      if (response && response.status === 200) {
        const fullName = response.data.name;
        const firstName = fullName ? fullName.split(' ')[0] : 'User';
        setUserName(firstName);
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('User Profile: Guest or session expired.');
      } else {
        console.error('Error fetching user profile on Home:', error.message || error);
      }
    }
  }, []);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      const response = await getUserAnalytics();
      if (response && response.data && response.data.data) {
        setAnalytics(response.data.data);
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('Analytics: Unauthenticated. Showing default view.');
        setAnalytics(null);
      } else {
        console.error('Error fetching analytics on Home:', error.message || error);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Refresh data automatically on screen focus & sync exam crunch mode
  useFocusEffect(
    useCallback(() => {
      const syncCrunchMode = async () => {
        try {
          const val = await AsyncStorage.getItem('mindcare_exam_crunch_mode');
          setIsCrunchMode(val === 'true');
        } catch (e) {
          // ignore
        }
      };
      syncCrunchMode();
      fetchUserData();
      fetchAnalyticsData();
    }, [fetchUserData, fetchAnalyticsData])
  );

  const toggleCrunchMode = async () => {
    const nextVal = !isCrunchMode;
    setIsCrunchMode(nextVal);
    try {
      await AsyncStorage.setItem('mindcare_exam_crunch_mode', nextVal ? 'true' : 'false');
    } catch (e) {
      console.error('Error saving crunch mode state:', e);
    }
  };

  // Combine assessments and daily mood logs to compute weekly trend
  const getDynamicTrend = () => {
    const weeklyMap = [
      { day: 'Mon', val: 0, count: 0 },
      { day: 'Tue', val: 0, count: 0 },
      { day: 'Wed', val: 0, count: 0 },
      { day: 'Thu', val: 0, count: 0 },
      { day: 'Fri', val: 0, count: 0 },
      { day: 'Sat', val: 0, count: 0 },
      { day: 'Sun', val: 0, count: 0 },
    ];

    if (analytics?.history && analytics.history.length > 0) {
      analytics.history.forEach((entry) => {
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

    if (analytics?.recent_mood_logs && analytics.recent_mood_logs.length > 0) {
      analytics.recent_mood_logs.forEach((entry) => {
        if (entry.date && entry.stress !== undefined) {
          const cleanDate = entry.date.split('.')[0].replace('Z', '');
          const dateObj = new Date(cleanDate);
          if (!isNaN(dateObj.getTime())) {
            let dayIdx = dateObj.getDay();
            let adjustedIdx = dayIdx === 0 ? 6 : dayIdx - 1;
            const safeStress = entry.stress > 10 ? 10 : entry.stress;
            weeklyMap[adjustedIdx].val += safeStress;
            weeklyMap[adjustedIdx].count += 1;
          }
        }
      });
    }

    const hasData = weeklyMap.some((item) => item.count > 0);
    if (!hasData) {
      return weeklyMap.map((d) => ({ day: d.day, val: 8 }));
    }

    return weeklyMap.map((item) => {
      const avgScoreForDay = item.count > 0 ? item.val / item.count : 0;
      return {
        day: item.day,
        val: avgScoreForDay > 0 ? avgScoreForDay * 12 : 8,
      };
    });
  };

  // Dynamic Stress Level Category & Clinical Theme Mapping:
  // - Low / Optimal (0 - 3 or Low): Teal #0D9488, background #F0FDFA, border #99F6E4, Title: "Optimal Balance"
  // - Moderate / Okay (4 - 6 or Moderate): Amber #D97706, background #FFFBEB, border #FDE68A, Title: "Moderate Tension"
  // - High / Elevated (7 - 10 or High): Crimson Red #DC2626, background #FEF2F2, border #FECACA, Title: "High Cognitive Load"
  const getStressCategory = (score, analyticsData) => {
    const hasData = Boolean(
      (analyticsData?.total_assessments && analyticsData.total_assessments > 0) ||
      (analyticsData?.recent_mood_logs && analyticsData.recent_mood_logs.length > 0) ||
      (score !== undefined && score !== null && analyticsData?.status !== 'no_data')
    );

    if (score === undefined || score === null || !hasData) {
      return {
        tier: 'pending',
        label: 'Pending',
        title: 'Pending Evaluation',
        statusText: 'Pending Evaluation',
        subText: 'Complete daily check-ins to personalize your clinical profile',
        accentColor: '#64748B',
        bgColor: '#F1F5F9',
        borderColor: '#CBD5E1',
      };
    }

    // Handle string inputs (e.g. "Low", "Moderate", "High", "Optimal")
    if (typeof score === 'string') {
      const s = score.toLowerCase().trim();
      if (s.includes('high') || s.includes('severe') || s.includes('alert') || s.includes('elevated')) {
        return {
          tier: 'high',
          label: 'High Alert',
          title: 'Current State: Elevated Tension',
          statusText: 'Current State: Elevated Tension',
          subText: 'Latest Assessment: 8/10',
          accentColor: '#DC2626',
          bgColor: '#FEF2F2',
          borderColor: '#FECACA',
        };
      }
      if (s.includes('mod') || s.includes('okay') || s.includes('tension')) {
        return {
          tier: 'moderate',
          label: 'Moderate',
          title: 'Current State: Manageable Balance',
          statusText: 'Current State: Manageable Balance',
          subText: 'Latest Assessment: 6/10',
          accentColor: '#D97706',
          bgColor: '#FFFBEB',
          borderColor: '#FDE68A',
        };
      }
      if (s.includes('low') || s.includes('opt') || s.includes('calm') || s.includes('good')) {
        return {
          tier: 'low',
          label: 'Optimal',
          title: 'Current State: Optimal Balance',
          statusText: 'Current State: Optimal Balance',
          subText: 'Latest Assessment: 4/10',
          accentColor: '#0D9488',
          bgColor: '#F0FDFA',
          borderColor: '#99F6E4',
        };
      }
    }

    const numScore = Number(score);
    if (isNaN(numScore)) {
      return {
        tier: 'pending',
        label: 'Pending',
        title: 'Pending Evaluation',
        statusText: 'Pending Evaluation',
        subText: 'Complete daily check-ins to personalize your clinical profile',
        accentColor: '#64748B',
        bgColor: '#F1F5F9',
        borderColor: '#CBD5E1',
      };
    }

    if (numScore >= 7) {
      return {
        tier: 'high',
        label: 'High Alert',
        title: 'Current State: Elevated Tension',
        statusText: 'Current State: Elevated Tension',
        subText: 'Latest Assessment: 8/10',
        accentColor: '#DC2626',
        bgColor: '#FEF2F2',
        borderColor: '#FECACA',
      };
    }

    if (numScore >= 4) {
      return {
        tier: 'moderate',
        label: 'Moderate',
        title: 'Current State: Manageable Balance',
        statusText: 'Current State: Manageable Balance',
        subText: 'Latest Assessment: 6/10',
        accentColor: '#D97706',
        bgColor: '#FFFBEB',
        borderColor: '#FDE68A',
      };
    }

    return {
      tier: 'low',
      label: 'Optimal',
      title: 'Current State: Optimal Balance',
      statusText: 'Current State: Optimal Balance',
      subText: 'Latest Assessment: 4/10',
      accentColor: '#0D9488',
      bgColor: '#F0FDFA',
      borderColor: '#99F6E4',
    };
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserData();
    fetchAnalyticsData();
  };

  const hasCompletedAssessment = Boolean(
    analytics?.total_assessments && analytics.total_assessments > 0
  );
  const stressCategory = getStressCategory(analytics?.avg_stress, analytics);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0D9488" />
        }
      >
        {/* Header Greeting & Exam Crunch Mode Switch */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.welcomeText}>Welcome, {userName}</Text>
            <Text style={styles.subText}>How is your mind feeling today?</Text>
          </View>
          <TouchableOpacity
            style={[styles.crunchToggleBtn, isCrunchMode && styles.crunchToggleBtnActive]}
            onPress={toggleCrunchMode}
            activeOpacity={0.8}
            accessibilityLabel="Exam Crunch Mode Toggle"
          >
            <Ionicons
              name="time-outline"
              size={15}
              color={isCrunchMode ? '#0F766E' : '#64748B'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.crunchToggleText, isCrunchMode && styles.crunchToggleTextActive]}>
              {isCrunchMode ? 'Crunch ON' : 'Exam Mode'}
            </Text>
            <View style={[styles.switchTrack, isCrunchMode && styles.switchTrackActive]}>
              <View style={[styles.switchThumb, isCrunchMode && styles.switchThumbActive]} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Discreet Clinical Exam Crunch Mode Banner */}
        {isCrunchMode && (
          <View style={styles.crunchModeBanner}>
            <Ionicons name="time-outline" size={15} color="#0D9488" style={{ marginRight: 8 }} />
            <Text style={styles.crunchModeBannerText}>
              Exam Mode Active: Micro-breaks prioritized to reduce cognitive fatigue.
            </Text>
          </View>
        )}

        {/* Primary Banner: High-visibility dismissible status banner for unassessed users */}
        {!hasCompletedAssessment && !isBannerDismissed && (
          <View style={styles.promptBanner}>
            <View style={styles.promptBannerContent}>
              <View style={styles.promptBannerHeader}>
                <Text style={styles.promptBannerTitle}>Clinical Onboarding</Text>
                <TouchableOpacity
                  style={styles.promptBannerDismiss}
                  onPress={() => setIsBannerDismissed(true)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
              <Text style={styles.promptBannerText}>
                🌱 Please complete your first Clinical Assessment to personalize your plan.
              </Text>
              <TouchableOpacity
                style={styles.promptBannerBtn}
                onPress={() => navigation.navigate('Assessment')}
                activeOpacity={0.85}
              >
                <Text style={styles.promptBannerBtnText}>Start Assessment</Text>
                <ChevronRight size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Mental Health Status Card with Dynamic Stress Level Indicator */}
        <View style={[styles.statusCard, { borderColor: stressCategory.borderColor }]}>
          <View style={styles.statusHeaderRow}>
            <Text style={styles.statusLabel}>MENTAL HEALTH OVERVIEW</Text>
            {/* Single, clean status pill badge */}
            <View
              style={[
                styles.stressPill,
                {
                  backgroundColor: stressCategory.bgColor,
                  borderColor: stressCategory.borderColor,
                },
              ]}
            >
              <View style={[styles.stressDot, { backgroundColor: stressCategory.accentColor }]} />
              <Text style={[styles.stressPillText, { color: stressCategory.accentColor }]}>
                {stressCategory.label}
              </Text>
            </View>
          </View>

          <Text style={styles.statusValue}>{stressCategory.title}</Text>
          <Text style={styles.statusSub}>
            {stressCategory.tier === 'pending' ? (
              stressCategory.subText
            ) : (
              <>
                Latest Assessment:{' '}
                <Text style={[styles.statusHighlight, { color: stressCategory.accentColor }]}>
                  {analytics?.latest_assessment_score !== undefined && analytics?.latest_assessment_score !== null
                    ? `${Math.round(Number(analytics.latest_assessment_score))}/10`
                    : (analytics?.avg_stress !== undefined && analytics?.avg_stress !== null && !isNaN(Number(analytics?.avg_stress))
                        ? `${Math.round(Number(analytics.avg_stress))}/10`
                        : '4/10')}
                </Text>
              </>
            )}
          </Text>
        </View>

        {/* Clinical Support Sanctuary Card */}
        <TouchableOpacity
          style={styles.agentCard}
          onPress={() => navigation.navigate('Chat')}
          activeOpacity={0.88}
        >
          <View style={styles.agentIconWrapper}>
            <HeartPulse size={22} color="#FFFFFF" />
          </View>
          <View style={styles.agentTextContent}>
            <Text style={styles.agentTitle}>MindCare Support Sanctuary</Text>
            <Text style={styles.agentDesc}>Confidential, empathetic clinical guidance 24/7</Text>
          </View>
          <View style={styles.agentActionIcon}>
            <MessageSquare size={18} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* Stress Trend Card */}
        <View style={styles.graphCard}>
          <View style={styles.graphHeader}>
            <View>
              <Text style={styles.sectionTitle}>Weekly Stress Overview</Text>
              <Text style={styles.sectionSubtitle}>Daily resilience patterns</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Analytics')}
              style={styles.viewAllBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.viewAll}>View Insights</Text>
              <ChevronRight size={14} color="#0D9488" />
            </TouchableOpacity>
          </View>

          <View style={styles.barChartContainer}>
            {getDynamicTrend().map((item, index) => (
              <View key={index} style={styles.barWrapper}>
                <View
                  style={[
                    styles.barInner,
                    {
                      height: item.val,
                      backgroundColor: item.val > 70 ? '#0D9488' : '#99F6E4',
                      opacity: item.val <= 8 ? 0.35 : 1,
                    },
                  ]}
                />
                <Text style={styles.barDayText}>{item.day}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Access Section */}
        <View style={styles.quickAccessHeader}>
          <Text style={styles.gridHeader}>Quick Wellness Tools</Text>
          <Text style={styles.gridSubtitle}>Structured clinical activities</Text>
        </View>

        <View style={styles.grid}>
          <QuickAccessCard
            icon={<HeartPulse size={22} color="#0D9488" />}
            title="Mood Tracking"
            desc="Log daily feelings"
            onPress={() => navigation.navigate('MoodTracking')}
          />
          <QuickAccessCard
            icon={<Wind size={22} color="#0D9488" />}
            title="Stress Relief"
            desc="Guided breathwork"
            onPress={() => navigation.navigate('Relax')}
          />
          <QuickAccessCard
            icon={<BarChart3 size={22} color="#0D9488" />}
            title="Analytics"
            desc="Long-term reports"
            onPress={() => navigation.navigate('Analytics')}
          />
          <QuickAccessCard
            icon={<ClipboardList size={22} color="#0D9488" />}
            title="Assessment"
            desc="Clinical screening"
            onPress={() => navigation.navigate('Assessment')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const QuickAccessCard = ({ icon, title, desc, onPress }) => (
  <TouchableOpacity style={styles.qCard} onPress={onPress} activeOpacity={0.75}>
    <View style={styles.qIconBg}>{icon}</View>
    <Text style={styles.qTitle}>{title}</Text>
    <Text style={styles.qDesc}>{desc}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 96,
  },
  header: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  subText: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 4,
  },
  // Exam Crunch Mode Toggle & Banner
  crunchToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    elevation: 1,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  crunchToggleBtnActive: {
    backgroundColor: '#F0FDFA',
    borderColor: '#99F6E4',
  },
  crunchToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginRight: 6,
  },
  crunchToggleTextActive: {
    color: '#0F766E',
  },
  switchTrack: {
    width: 28,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#CBD5E1',
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: '#0D9488',
  },
  switchThumb: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  crunchModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
  },
  crunchModeBannerText: {
    color: '#0F766E',
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1,
  },
  // Dismissible Status Banner
  promptBanner: {
    backgroundColor: '#F0FDF4',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  promptBannerContent: {
    width: '100%',
  },
  promptBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  promptBannerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  promptBannerDismiss: {
    padding: 2,
  },
  promptBannerText: {
    fontSize: 14,
    color: '#166534',
    lineHeight: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  promptBannerBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#0D9488',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 4,
  },
  promptBannerBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  // Status Card
  statusCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statusLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  // Dynamic Stress Pill
  stressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  stressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stressPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  statusValue: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: -0.3,
  },
  statusSub: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
    fontWeight: '500',
  },
  statusHighlight: {
    fontWeight: '700',
  },
  agentCard: {
    backgroundColor: '#0D9488',
    padding: 18,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 4,
  },
  agentIconWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  agentTextContent: {
    flex: 1,
  },
  agentTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  agentDesc: {
    color: '#CCFBF1',
    fontSize: 12.5,
    marginTop: 2,
  },
  agentActionIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 8,
    borderRadius: 10,
    marginLeft: 8,
  },
  graphCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 20,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  graphHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '700',
    fontSize: 16,
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAll: {
    color: '#0D9488',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 2,
  },
  barChartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingTop: 10,
    paddingBottom: 4,
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  barInner: {
    width: 14,
    borderRadius: 7,
  },
  barDayText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 8,
    fontWeight: '600',
  },
  quickAccessHeader: {
    marginBottom: 12,
  },
  gridHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  gridSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  qCard: {
    backgroundColor: '#FFFFFF',
    width: '48%',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  qIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  qTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  qDesc: {
    fontSize: 11.5,
    color: '#64748B',
  },
});