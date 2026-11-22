import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ArrowLeft,
  Wind,
  GraduationCap,
  Clock,
  Moon,
  Flame,
  Heart,
  ChevronRight,
  Calendar,
  Sparkles,
} from 'lucide-react-native';
import { getUserSummary, getUserProfile } from '../api/authService';
import { getActivityStats, syncActivityStats } from '../utils/activityTracker';

export default function ActivityProgressScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState('demo_user');
  const [activityStats, setActivityStats] = useState({
    relaxSessions: 0,
    relaxMinutes: 0,
    studySessions: 0,
    studyMinutes: 0,
  });
  const [latestBiometrics, setLatestBiometrics] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);

  const loadProgressData = useCallback(async () => {
    try {
      // 1. Resolve user ID from cached profile
      let targetUser = 'demo_user';
      try {
        const cachedProf = await AsyncStorage.getItem('@mindcare_cached_profile');
        if (cachedProf) {
          const parsed = JSON.parse(cachedProf);
          targetUser = parsed.id || parsed.user_id || 'demo_user';
          setUserId(targetUser);
        }
      } catch (e) {
        // ignore
      }

      // 1b. Immediately hydrate local activity stats for instant render
      const localStats = await getActivityStats(targetUser);
      setActivityStats(localStats);

      // 2. Fetch server recent logs & activity data first
      let summaryPayload = null;
      try {
        const summaryRes = await getUserSummary();
        summaryPayload = summaryRes?.data?.data || summaryRes?.data;
        if (summaryPayload?.recent_mood_logs && Array.isArray(summaryPayload.recent_mood_logs)) {
          setRecentLogs(summaryPayload.recent_mood_logs);
        }
      } catch (apiErr) {
        console.warn('Recent logs fetch note:', apiErr.message || apiErr);
      }

      // 3. Synchronize activity stats taking the maximum of backend and local AsyncStorage
      const stats = await syncActivityStats(targetUser, summaryPayload);
      setActivityStats(stats);

      // 4. Fetch latest biometrics strictly scoped to user
      try {
        if (targetUser && targetUser !== 'demo_user') {
          const scopedBio = await AsyncStorage.getItem(`@mindcare_latest_biometrics_${targetUser}`);
          setLatestBiometrics(scopedBio ? JSON.parse(scopedBio) : null);
        } else {
          setLatestBiometrics(null);
        }
      } catch (e) {
        setLatestBiometrics(null);
      }
    } catch (err) {
      console.warn('ActivityProgress load error:', err.message || err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProgressData();
    }, [loadProgressData])
  );

  // Combine latest local biometrics if not already in recentLogs
  const displayLogs = (() => {
    const list = [...recentLogs];
    if (latestBiometrics) {
      const bioDate = latestBiometrics.date || latestBiometrics.timestamp || new Date().toISOString();
      const alreadyPresent = list.some(
        (m) =>
          (m.date && m.date === bioDate) ||
          (m.timestamp && m.timestamp === bioDate) ||
          (m.mood === latestBiometrics.mood &&
            Math.abs(new Date(m.date || m.timestamp || 0) - new Date(bioDate)) < 60000)
      );
      if (!alreadyPresent) {
        list.unshift({
          ...latestBiometrics,
          date: bioDate,
        });
      }
    }
    return list;
  })();

  const formatLogDate = (rawDate) => {
    if (!rawDate) return 'Today';
    try {
      const clean = typeof rawDate === 'string' ? rawDate.split('.')[0].replace('Z', '') : rawDate;
      const d = new Date(clean);
      if (isNaN(d.getTime())) return 'Recently';
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return 'Recently';
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
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={20} color="#0D9488" strokeWidth={2.5} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Activity & Module Progress</Text>
            <Text style={styles.headerSubtitle}>Live tracking of relaxation & academic sessions</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Section: 2-Column Module Progress Cards */}
          <Text style={styles.sectionHeading}>Active Self-Care Modules</Text>

          <View style={styles.modulesRow}>
            {/* Stress Relief Progress Card */}
            <View style={styles.moduleCard}>
              <View style={styles.moduleCardHeader}>
                <View style={[styles.moduleIconCircle, { backgroundColor: '#F0FDFA', borderColor: '#CCFBF1' }]}>
                  <Wind size={20} color="#0D9488" />
                </View>
                <View style={styles.badgePill}>
                  <Text style={styles.badgePillText}>Relaxation</Text>
                </View>
              </View>

              <Text style={styles.moduleTitle}>Stress Relief</Text>
              <Text style={styles.moduleSub}>Guided breathwork & decompression</Text>

              <View style={styles.statCountRow}>
                <View style={styles.statCountBlock}>
                  <Text style={styles.statCountBig}>{activityStats.relaxSessions}</Text>
                  <Text style={styles.statCountUnit}>sessions</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCountBlock}>
                  <Text style={styles.statCountBig}>{activityStats.relaxMinutes}</Text>
                  <Text style={styles.statCountUnit}>minutes</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.moduleActionBtn}
                onPress={() => navigation.navigate('Relax')}
                activeOpacity={0.85}
              >
                <Text style={styles.moduleActionBtnText}>Start Session</Text>
                <ChevronRight size={14} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            {/* A+ Study Track Progress Card */}
            <View style={styles.moduleCard}>
              <View style={styles.moduleCardHeader}>
                <View style={[styles.moduleIconCircle, { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7' }]}>
                  <GraduationCap size={20} color="#D97706" />
                </View>
                <View style={[styles.badgePill, { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7' }]}>
                  <Text style={[styles.badgePillText, { color: '#B45309' }]}>Study</Text>
                </View>
              </View>

              <Text style={styles.moduleTitle}>A+ Study Track</Text>
              <Text style={styles.moduleSub}>Stress-adapted study & focus pacing</Text>

              <View style={styles.statCountRow}>
                <View style={styles.statCountBlock}>
                  <Text style={[styles.statCountBig, { color: '#D97706' }]}>{activityStats.studySessions}</Text>
                  <Text style={styles.statCountUnit}>blocks</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCountBlock}>
                  <Text style={[styles.statCountBig, { color: '#D97706' }]}>{activityStats.studyMinutes}</Text>
                  <Text style={styles.statCountUnit}>minutes</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.moduleActionBtn, { backgroundColor: '#D97706' }]}
                onPress={() => navigation.navigate('AplusTrack')}
                activeOpacity={0.85}
              >
                <Text style={styles.moduleActionBtnText}>Open Study Track</Text>
                <ChevronRight size={14} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Section: Recent Self-Reflection Logs */}
          <View style={styles.logsSectionHeader}>
            <Text style={styles.sectionHeading}>Recent Self-Reflection Logs</Text>
            <Text style={styles.sectionSubHeading}>
              Logged feelings, rest intervals & cognitive factors
            </Text>
          </View>

          {displayLogs.length > 0 ? (
            <View style={styles.logsList}>
              {displayLogs.map((log, index) => {
                const sleepNum =
                  log.sleep_hours !== undefined && log.sleep_hours !== null
                    ? Number(log.sleep_hours)
                    : null;
                const hasSleep = sleepNum !== null && !isNaN(sleepNum);
                const energy = log.energy_level || 'Steady';
                const moodName = log.mood || 'Reflection';

                const factors = Array.isArray(log.stress_factors)
                  ? log.stress_factors.filter((f) => f && f !== 'None')
                  : log.stress_factor && log.stress_factor !== 'None'
                  ? [log.stress_factor]
                  : [];

                const userNote = log.journal_note || log.notes || log.note;
                const microRef = log.micro_reflection;

                return (
                  <View key={index} style={styles.logCard}>
                    {/* Log Card Top Row */}
                    <View style={styles.logCardTopRow}>
                      <View style={styles.moodBadgeRow}>
                        <View style={styles.moodDot} />
                        <Text style={styles.moodBadgeText}>{moodName}</Text>
                      </View>
                      <View style={styles.dateBadge}>
                        <Calendar size={11} color="#64748B" style={{ marginRight: 4 }} />
                        <Text style={styles.dateBadgeText}>
                          {formatLogDate(log.date || log.timestamp)}
                        </Text>
                      </View>
                    </View>

                    {/* Metadata Chips Row (No Truncation) */}
                    <View style={styles.chipsRow}>
                      {hasSleep && (
                        <View style={styles.chipItem}>
                          <Moon size={12} color="#0D9488" style={{ marginRight: 4 }} />
                          <Text style={styles.chipText}>{sleepNum.toFixed(1)}h rest</Text>
                        </View>
                      )}
                      <View style={styles.chipItem}>
                        <Clock size={12} color="#0D9488" style={{ marginRight: 4 }} />
                        <Text style={styles.chipText}>{energy} Energy</Text>
                      </View>
                      {factors.length > 0 && (
                        <View style={[styles.chipItem, styles.triggerChip]}>
                          <Flame size={12} color="#D97706" style={{ marginRight: 4 }} />
                          <Text style={[styles.chipText, { color: '#B45309' }]}>
                            {factors[0]}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* User Journal Note (if logged) */}
                    {userNote ? (
                      <View style={styles.noteBox}>
                        <Text style={styles.noteLabel}>Reflection Note</Text>
                        <Text style={styles.noteText}>{userNote}</Text>
                      </View>
                    ) : null}

                    {/* Clinical Micro-Reflection (if generated) */}
                    {microRef ? (
                      <View style={styles.reflectionBox}>
                        <View style={styles.reflectionHeaderRow}>
                          <Sparkles size={12} color="#0D9488" style={{ marginRight: 4 }} />
                          <Text style={styles.reflectionLabel}>Clinical Companion Note</Text>
                        </View>
                        <Text style={styles.reflectionText}>{microRef}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Heart size={32} color="#94A3B8" style={{ marginBottom: 10 }} />
              <Text style={styles.emptyTitle}>No Self-Reflection Logs Yet</Text>
              <Text style={styles.emptySubtitle}>
                Complete a daily mood check-in to see your longitudinal emotional patterns and rest logs here.
              </Text>
              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={() => navigation.navigate('MoodTracking')}
                activeOpacity={0.85}
              >
                <Text style={styles.emptyActionBtnText}>Log Today's Mood</Text>
                <ChevronRight size={14} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 40 }} />
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 32,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  sectionSubHeading: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 12,
  },
  modulesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  moduleCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  moduleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  moduleIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePill: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0D9488',
  },
  moduleTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  moduleSub: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
    marginBottom: 12,
    minHeight: 30,
  },
  statCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  statCountBlock: {
    flex: 1,
    alignItems: 'center',
  },
  statCountBig: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0D9488',
  },
  statCountUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#E2E8F0',
  },
  moduleActionBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    gap: 4,
  },
  moduleActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  logsSectionHeader: {
    marginBottom: 2,
  },
  logsList: {
    gap: 12,
  },
  logCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  logCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  moodBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  moodDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#0D9488',
    marginRight: 6,
  },
  moodBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D9488',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateBadgeText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  chipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  triggerChip: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FEF3C7',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  noteBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noteLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  noteText: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 18,
    fontWeight: '500',
  },
  reflectionBox: {
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  reflectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  reflectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F766E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reflectionText: {
    fontSize: 12.5,
    color: '#0F766E',
    lineHeight: 18,
    fontWeight: '500',
  },
  emptyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  emptyActionBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});

