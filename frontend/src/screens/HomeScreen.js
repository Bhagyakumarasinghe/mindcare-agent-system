import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Image,
  FlatList,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MessageSquare,
  ChevronRight,
  X,
  Search,
  HelpCircle,
  Sparkles,
} from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserProfile, getUserAnalytics } from '../api/authService';
import { computeWeeklyStressTrend } from '../utils/activityTracker';

const { width } = Dimensions.get('window');
const BANNER_WIDTH = width - 40; // 20px padding on each side

const HERO_BANNERS = [
  {
    id: '1',
    image: require('../../assets/images/banner-1.png'),
    tag: 'DAILY MINDFULNESS',
    title: 'Find Calm in Every Breath',
  },
  {
    id: '2',
    image: require('../../assets/images/banner-2.png'),
    tag: 'CLINICAL INSIGHTS',
    title: 'Empower Your Mental Balance',
  },
  {
    id: '3',
    image: require('../../assets/images/banner-3.png'),
    tag: 'RESILIENCE ROADMAP',
    title: 'Progress One Day at a Time',
  },
];

const WELLNESS_TOOLS = [
  {
    title: 'Mood Tracking',
    desc: 'Log daily feelings',
    image: require('../../assets/images/tool-mood.png'),
    route: 'MoodTracking',
  },
  {
    title: 'Stress Relief',
    desc: 'Guided breathwork',
    image: require('../../assets/images/tool-relax.png'),
    route: 'Relax',
  },
  {
    title: 'A+ Study Track',
    desc: 'Stress-adapted study',
    image: require('../../assets/images/A+-track.jpg'),
    route: 'AplusTrack',
  },
  {
    title: 'Assessment',
    desc: 'Clinical screening',
    image: require('../../assets/images/tool-assessment.png'),
    route: 'Assessment',
  },
];

const SEARCHABLE_DESTINATIONS = [
  {
    id: 'chat',
    title: 'MindCare AI Chat',
    desc: 'Confidential clinical guidance & coping',
    keywords: ['chat', 'ai', 'support', 'sanctuary', 'talk', 'bot', 'therapy', 'cbt', 'mindcare'],
    route: 'Chat',
    iconName: 'chatbubble-ellipses-outline',
  },
  {
    id: 'mood',
    title: 'Mood Tracking',
    desc: 'Log daily feelings & emotional check-in',
    keywords: ['mood', 'feelings', 'emotion', 'tracking', 'daily', 'check-in', 'log', 'happy', 'sad'],
    route: 'MoodTracking',
    iconName: 'happy-outline',
  },
  {
    id: 'breathing',
    title: 'Breathing Exercise',
    desc: 'Box breathing & 2-min instant reset',
    keywords: ['breathing', 'breath', 'box breathing', 'instant decompression', 'reset', 'relax', 'calm', 'lung', 'pre-exam'],
    route: 'Breathing',
    iconName: 'leaf-outline',
  },
  {
    id: 'focustimer',
    title: 'Focus Timer',
    desc: 'Pomodoro intervals & cognitive pacing',
    keywords: ['focus', 'timer', 'study', 'pomodoro', 'work', 'clock', 'concentration', 'pacing'],
    route: 'FocusTimer',
    iconName: 'timer-outline',
  },
  {
    id: 'meditation',
    title: 'Guided Meditation',
    desc: 'Audio mindfulness & peaceful stillness',
    keywords: ['meditation', 'guided', 'mindfulness', 'audio', 'peace', 'stillness', 'sanctuary'],
    route: 'MeditationScreen',
    iconName: 'headset-outline',
  },
  {
    id: 'journal',
    title: 'Reflective Journal',
    desc: 'Express thoughts & sentiment analysis',
    keywords: ['journal', 'reflective', 'write', 'diary', 'journaling', 'thoughts', 'reflection'],
    route: 'JournalScreen',
    iconName: 'book-outline',
  },
  {
    id: 'aplus',
    title: 'A+ Study Track',
    desc: 'Stress-adapted study pacing & modules',
    keywords: ['a+', 'aplus', 'study', 'track', 'academic', 'resilience', 'exam', 'module', 'subject', 'modules'],
    route: 'AplusTrack',
    iconName: 'school-outline',
  },
  {
    id: 'assessment',
    title: 'Clinical Assessment',
    desc: 'PSS stress screening & clinical score',
    keywords: ['assessment', 'test', 'pss', 'screening', 'clinical', 'evaluation', 'score', 'stress test'],
    route: 'Assessment',
    iconName: 'clipboard-outline',
  },
  {
    id: 'analytics',
    title: 'Wellness Analytics',
    desc: 'Long-term stress history & trends',
    keywords: ['analytics', 'insights', 'chart', 'trends', 'weekly', 'history', 'report'],
    route: 'Analytics',
    iconName: 'bar-chart-outline',
  },
];

export default function HomeScreen({ navigation }) {
  const [userName, setUserName] = useState('User');
  const [analytics, setAnalytics] = useState(null);
  const [latestLocalAssessment, setLatestLocalAssessment] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [isCrunchMode, setIsCrunchMode] = useState(false);
  const [activeBanner, setActiveBanner] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [latestBiometrics, setLatestBiometrics] = useState(null);
  const [userId, setUserId] = useState('');

  // Auto-show Quick Start Guide Modal on first visit strictly scoped to this user
  const checkGuideStatus = useCallback(async (uid) => {
    if (!uid) return;
    try {
      const seen = await AsyncStorage.getItem('@mindcare_onboarding_seen_' + uid);
      if (seen !== 'true') {
        setShowGuideModal(true);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const handleDismissGuide = async (navigateTo = null) => {
    try {
      if (userId) {
        await AsyncStorage.setItem('@mindcare_onboarding_seen_' + userId, 'true');
      }
      await AsyncStorage.setItem('@mindcare_seen_home_guide', 'true');
    } catch (e) {
      console.warn('Error saving guide status:', e);
    }
    setShowGuideModal(false);
    if (navigateTo) {
      navigation.navigate(navigateTo);
    }
  };

  const filteredDestinations = searchQuery.trim().length > 0
    ? SEARCHABLE_DESTINATIONS.filter((dest) => {
        const q = searchQuery.toLowerCase().trim();
        return (
          dest.title.toLowerCase().includes(q) ||
          dest.desc.toLowerCase().includes(q) ||
          dest.keywords.some((k) => k.toLowerCase().includes(q))
        );
      })
    : [];

  const bannerListRef = useRef(null);

  // Hydrate user profile from cache immediately for zero-delay greeting
  useEffect(() => {
    const hydrateCachedProfile = async () => {
      try {
        const cached = await AsyncStorage.getItem('@mindcare_cached_profile');
        if (cached) {
          const parsed = JSON.parse(cached);
          const nameToUse = parsed.full_name || parsed.name;
          if (nameToUse) {
            setUserName(nameToUse.trim().split(' ')[0]);
          }
        }
      } catch (e) {
        // silent fallback
      }
    };
    hydrateCachedProfile();
  }, []);

  // Auto-slide Hero Wellness Banner Carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveBanner((prev) => {
        const nextIndex = (prev + 1) % HERO_BANNERS.length;
        bannerListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
        return nextIndex;
      });
    }, 4500);

    return () => clearInterval(timer);
  }, []);

  const onBannerScroll = (event) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const offset = event.nativeEvent.contentOffset.x;
    if (slideSize > 0) {
      const index = Math.round(offset / slideSize);
      if (index >= 0 && index < HERO_BANNERS.length) {
        setActiveBanner(index);
      }
    }
  };

  const fetchUserData = useCallback(async () => {
    try {
      const response = await getUserProfile();
      if (response && response.status === 200) {
        const uData = response.data;
        const fullName = uData.full_name || uData.name;
        const firstName = fullName ? fullName.trim().split(' ')[0] : 'User';
        setUserName(firstName);

        const resolvedId = uData.id || uData.user_id || '';
        if (resolvedId) {
          setUserId(resolvedId);
          checkGuideStatus(resolvedId);
        }

        // Keep local profile cache in sync
        await AsyncStorage.setItem(
          '@mindcare_cached_profile',
          JSON.stringify({
            id: resolvedId,
            name: fullName || '',
            full_name: fullName || '',
            email: uData.email || '',
          })
        );
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('User Profile: Guest or session expired.');
      } else {
        console.warn('User Profile fetch notice on Home:', error.message || error);
      }
    }
  }, [checkGuideStatus]);

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
        console.warn('Analytics fetch notice on Home:', error.message || error);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Refresh data automatically on screen focus & sync exam crunch mode & strictly scoped assessment & biometrics
  useFocusEffect(
    useCallback(() => {
      let uid = '';
      const syncCachedProfile = async () => {
        try {
          const cached = await AsyncStorage.getItem('@mindcare_cached_profile');
          if (cached) {
            const parsed = JSON.parse(cached);
            uid = parsed.id || parsed.user_id || '';
            if (uid) {
              setUserId(uid);
              checkGuideStatus(uid);
            }
            const nameToUse = parsed.full_name || parsed.name;
            if (nameToUse) {
              setUserName(nameToUse.trim().split(' ')[0]);
            }
          }
        } catch (e) {
          // ignore
        }
      };

      const syncCrunchMode = async () => {
        try {
          const val = await AsyncStorage.getItem('mindcare_exam_crunch_mode');
          setIsCrunchMode(val === 'true');
        } catch (e) {
          // ignore
        }
      };

      const loadCachedAssessment = async (targetUid) => {
        try {
          const idToUse = targetUid || uid;
          if (idToUse) {
            const cached = await AsyncStorage.getItem(`mindcare_latest_assessment_${idToUse}`);
            setLatestLocalAssessment(cached ? JSON.parse(cached) : null);
          } else {
            setLatestLocalAssessment(null);
          }
        } catch (e) {
          setLatestLocalAssessment(null);
        }
      };

      const syncBiometricsCache = async (targetUid) => {
        try {
          const idToUse = targetUid || uid;
          if (idToUse) {
            const scoped = await AsyncStorage.getItem(`@mindcare_latest_biometrics_${idToUse}`);
            setLatestBiometrics(scoped ? JSON.parse(scoped) : null);
          } else {
            setLatestBiometrics(null);
          }
        } catch (e) {
          setLatestBiometrics(null);
        }
      };

      syncCachedProfile().then(() => {
        syncCrunchMode();
        loadCachedAssessment(uid);
        syncBiometricsCache(uid);
        fetchUserData();
        fetchAnalyticsData();
      });
    }, [fetchUserData, fetchAnalyticsData, checkGuideStatus])
  );

  const toggleCrunchMode = async () => {
    const nextVal = !isCrunchMode;
    setIsCrunchMode(nextVal);
    try {
      await AsyncStorage.setItem('mindcare_exam_crunch_mode', nextVal ? 'true' : 'false');
    } catch (e) {
      console.warn('Error saving crunch mode state:', e);
    }
  };

  // Clinical assessments and daily mood check-ins compute weekly stress trend (Synchronized with AnalyticsScreen)
  const getDynamicTrend = () => {
    return computeWeeklyStressTrend(
      analytics?.history,
      analytics?.recent_mood_logs,
      latestBiometrics
    );
  };

  const getStressCategory = (score, level, analyticsData) => {
    const rawVal = score !== null && score !== undefined && !isNaN(Number(score))
      ? Number(score)
      : analyticsData?.avg_stress !== undefined && analyticsData?.avg_stress !== null && !isNaN(Number(analyticsData.avg_stress))
      ? Number(analyticsData.avg_stress)
      : null;

    if (rawVal === null || rawVal === 0) {
      if (!level) {
        return {
          tier: 'pending',
          label: 'Pending',
          title: 'Pending Evaluation',
          subText: 'Complete daily check-ins to personalize your clinical profile',
          accentColor: '#64748B',
          dotColor: '#94A3B8',
          bgColor: '#F1F5F9',
          borderColor: '#E2E8F0',
        };
      }
    }

    const formattedScore = rawVal !== null && !isNaN(rawVal)
      ? `${rawVal.toFixed(1)}/10`
      : 'Pending';

    // Standard clinical stress scale across MindCare:
    // 0.0 - 3.9: Calm (Teal #0D9488)
    // 4.0 - 6.4: Moderate (Amber #D97706)
    // 6.5 - 10.0: High Alert (Red #DC2626)
    if (rawVal !== null && !isNaN(rawVal)) {
      if (rawVal >= 6.5) {
        return {
          tier: 'high',
          label: 'High Alert',
          title: 'Current State: High Alert',
          subText: `Latest Assessment: ${formattedScore}`,
          accentColor: '#B91C1C',
          dotColor: '#DC2626',
          bgColor: '#FEE2E2',
          borderColor: '#FECACA',
        };
      }
      if (rawVal >= 4.0) {
        return {
          tier: 'moderate',
          label: 'Moderate',
          title: 'Current State: Manageable Balance',
          subText: `Latest Assessment: ${formattedScore}`,
          accentColor: '#B45309',
          dotColor: '#D97706',
          bgColor: '#FEF3C7',
          borderColor: '#FDE68A',
        };
      }
      return {
        tier: 'low',
        label: 'Calm',
        title: 'Current State: Optimal Balance',
        subText: `Latest Assessment: ${formattedScore}`,
        accentColor: '#0F766E',
        dotColor: '#0D9488',
        bgColor: '#CCFBF1',
        borderColor: '#99F6E4',
      };
    }

    // Level-based classification fallback if numeric score is absent
    if (typeof level === 'string' && level.trim().length > 0) {
      const s = level.toLowerCase().trim();
      if (s === 'high' || s.includes('severe') || s.includes('alert')) {
        return {
          tier: 'high',
          label: 'High Alert',
          title: 'Current State: High Alert',
          subText: `Latest Assessment: ${formattedScore}`,
          accentColor: '#B91C1C',
          dotColor: '#DC2626',
          bgColor: '#FEE2E2',
          borderColor: '#FECACA',
        };
      }
      if (s === 'moderate' || s.includes('manageable') || s.includes('mod') || s.includes('tension')) {
        return {
          tier: 'moderate',
          label: 'Moderate',
          title: 'Current State: Manageable Balance',
          subText: `Latest Assessment: ${formattedScore}`,
          accentColor: '#B45309',
          dotColor: '#D97706',
          bgColor: '#FEF3C7',
          borderColor: '#FDE68A',
        };
      }
      return {
        tier: 'low',
        label: 'Calm',
        title: 'Current State: Optimal Balance',
        subText: `Latest Assessment: ${formattedScore}`,
        accentColor: '#0F766E',
        dotColor: '#0D9488',
        bgColor: '#CCFBF1',
        borderColor: '#99F6E4',
      };
    }

    return {
      tier: 'pending',
      label: 'Pending',
      title: 'Pending Evaluation',
      subText: 'Complete daily check-ins to personalize your clinical profile',
      accentColor: '#64748B',
      dotColor: '#94A3B8',
      bgColor: '#F1F5F9',
      borderColor: '#E2E8F0',
    };
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserData();
    fetchAnalyticsData();
  };

  // Genuine completed clinical assessment record from backend analytics or local storage
  const assessmentsHistory = Array.isArray(analytics?.history) ? analytics.history : [];
  const totalAssessments = Number(
    analytics?.total_assessments || (assessmentsHistory.length > 0 ? assessmentsHistory.length : latestLocalAssessment ? 1 : 0)
  );
  const latestAssessmentScore =
    analytics?.latest_assessment_score !== undefined && analytics?.latest_assessment_score !== null
      ? Number(analytics.latest_assessment_score)
      : assessmentsHistory.length > 0 && assessmentsHistory[0]?.score !== undefined && assessmentsHistory[0]?.score !== null
      ? Number(assessmentsHistory[0].score)
      : latestLocalAssessment?.scaled_pss_score !== undefined && latestLocalAssessment?.scaled_pss_score !== null
      ? Number(latestLocalAssessment.scaled_pss_score)
      : latestLocalAssessment?.pss_score !== undefined && latestLocalAssessment?.pss_score !== null
      ? Number(latestLocalAssessment.pss_score)
      : null;

  const latestAssessmentLevel =
    analytics?.latest_assessment_level ||
    (assessmentsHistory.length > 0 && assessmentsHistory[0]?.level) ||
    latestLocalAssessment?.stress_level ||
    latestLocalAssessment?.predicted_stress ||
    null;

  // Only set hasCompletedAssessment = true when a genuine completed clinical assessment record with a valid score (> 0 or totalAssessments > 0) is present
  const hasCompletedAssessment = Boolean(
    (totalAssessments > 0 && latestAssessmentScore !== null && latestAssessmentScore > 0) ||
    (assessmentsHistory.length > 0 && latestAssessmentScore !== null && latestAssessmentScore > 0) ||
    (latestLocalAssessment !== null && latestAssessmentScore !== null && latestAssessmentScore > 0)
  );

  // Keep the banner strictly visible (!onboardingDismissed && !hasCompletedAssessment) until clinical assessment is completed
  const shouldShowOnboardingBanner = !onboardingDismissed && !hasCompletedAssessment;

  const stressCategory = getStressCategory(latestAssessmentScore, latestAssessmentLevel, analytics);

  // Numerical score for progress bar calculation (0 - 10)
  const currentScoreVal =
    latestAssessmentScore !== null && latestAssessmentScore !== undefined
      ? Number(latestAssessmentScore)
      : analytics?.avg_stress !== undefined &&
        analytics?.avg_stress !== null &&
        !isNaN(Number(analytics?.avg_stress))
      ? Number(analytics.avg_stress)
      : null;

  const scoreProgressPercent = currentScoreVal !== null
    ? Math.min(100, Math.max(8, (currentScoreVal / 10) * 100))
    : 16;

  const isScoreElevated =
    (currentScoreVal !== null && currentScoreVal >= 6.5) || stressCategory.tier === 'high';
  const isScoreModerate =
    (currentScoreVal !== null && currentScoreVal >= 4.0) || stressCategory.tier === 'moderate';
  const progressBarColor = isScoreElevated ? '#DC2626' : isScoreModerate ? '#D97706' : '#0D9488';

  // Sleep snapshot calculation from local cache, analytics or recent mood logs
  const rawSleep =
    latestBiometrics?.sleep_hours ??
    analytics?.sleep_hours ??
    analytics?.avg_sleep ??
    analytics?.recent_mood_logs?.[0]?.sleep_hours ??
    null;
  const sleepNum = rawSleep !== null && rawSleep !== undefined ? Number(rawSleep) : null;
  const hasSleepLog = sleepNum !== null && !isNaN(sleepNum) && sleepNum > 0;
  const displaySleep = hasSleepLog ? `${sleepNum.toFixed(1)}h` : (analytics || latestBiometrics ? '-- h' : '7.0h');
  const isRested = hasSleepLog && sleepNum >= 7.0;
  const sleepStatus = hasSleepLog
    ? (isRested ? 'Rested' : 'Needs Rest')
    : (analytics || latestBiometrics ? 'No Logs' : 'Rested');

  // Study pacing calculation: adapt dynamically based on latest assessment or mood check-in
  const latestStress = (() => {
    if (
      latestAssessmentScore !== null &&
      latestAssessmentScore !== undefined &&
      !isNaN(Number(latestAssessmentScore)) &&
      Number(latestAssessmentScore) > 0
    ) {
      return Number(latestAssessmentScore);
    }
    if (
      latestBiometrics?.stress_score !== undefined &&
      latestBiometrics?.stress_score !== null &&
      !isNaN(Number(latestBiometrics.stress_score)) &&
      Number(latestBiometrics.stress_score) > 0
    ) {
      return Number(latestBiometrics.stress_score);
    }
    if (
      latestBiometrics?.stress_level !== undefined &&
      latestBiometrics?.stress_level !== null &&
      !isNaN(Number(latestBiometrics.stress_level)) &&
      Number(latestBiometrics.stress_level) > 0
    ) {
      return Number(latestBiometrics.stress_level);
    }
    if (
      analytics?.avg_stress !== undefined &&
      analytics?.avg_stress !== null &&
      !isNaN(Number(analytics?.avg_stress)) &&
      Number(analytics.avg_stress) > 0
    ) {
      return Number(analytics.avg_stress);
    }
    if (analytics?.recent_mood_logs && analytics.recent_mood_logs.length > 0) {
      const firstLog = analytics.recent_mood_logs[0];
      const sVal = firstLog.stress_score ?? firstLog.stress_level;
      if (sVal !== undefined && sVal !== null && !isNaN(Number(sVal)) && Number(sVal) > 0) {
        return Number(sVal);
      }
    }
    if (latestBiometrics?.mood) {
      const moodMap = { Great: 2.0, Good: 3.5, Okay: 5.0, Bad: 7.5, Terrible: 9.0 };
      if (moodMap[latestBiometrics.mood]) return moodMap[latestBiometrics.mood];
    }
    if (latestAssessmentLevel && typeof latestAssessmentLevel === 'string') {
      const lvl = latestAssessmentLevel.toLowerCase();
      if (lvl.includes('high') || lvl.includes('alert') || lvl.includes('severe')) return 7.5;
      if (lvl.includes('mod') || lvl.includes('manageable')) return 5.0;
      if (lvl.includes('calm') || lvl.includes('low') || lvl.includes('optimal')) return 2.5;
    }
    return null;
  })();

  const pacingInfo = (() => {
    if (isCrunchMode) {
      return {
        label: '25m Crunch',
        status: 'Crunch',
        color: '#DC2626',
        bg: 'rgba(239, 68, 68, 0.10)',
        border: 'rgba(239, 68, 68, 0.22)',
      };
    }
    if (latestStress !== null) {
      if (latestStress >= 6.5) {
        return {
          label: '25m Focus',
          status: 'High Alert',
          color: '#DC2626',
          bg: 'rgba(239, 68, 68, 0.10)',
          border: 'rgba(239, 68, 68, 0.22)',
        };
      }
      if (latestStress >= 4.0) {
        return {
          label: '35m Flow',
          status: 'Moderate',
          color: '#B45309',
          bg: 'rgba(217, 119, 6, 0.10)',
          border: 'rgba(217, 119, 6, 0.22)',
        };
      }
      return {
        label: '45m Deep',
        status: 'Calm',
        color: '#0F766E',
        bg: 'rgba(13, 148, 136, 0.10)',
        border: 'rgba(13, 148, 136, 0.22)',
      };
    }
    // Brand-new user with no logs: 25m Base with neutral Standard badge
    return {
      label: '25m Base',
      status: 'Standard',
      color: '#64748B',
      bg: 'rgba(100, 116, 139, 0.10)',
      border: 'rgba(100, 116, 139, 0.20)',
    };
  })();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* 1. Bright & Soothing Light Gradient Background */}
      <LinearGradient
        colors={['#F0FDFA', '#E6F4F1', '#F8FAFC']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Very Subtle Soft Mint/Aqua Ambient Circles */}
      <View pointerEvents="none" style={styles.ambientOrbTop} />
      <View pointerEvents="none" style={styles.ambientOrbMiddle} />
      <View pointerEvents="none" style={styles.ambientOrbBottom} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0D9488" />
          }
        >
          {/* 1. Header Greeting & Clean Two-Row Layout */}
          <View style={styles.headerContainer}>
            {/* Top Row: Full-width Greeting on Left & Help Button on Right */}
            <View style={styles.headerTopRow}>
              <View style={styles.headerGreetingCol}>
                <Text style={styles.welcomeText} numberOfLines={1}>
                  Welcome, {userName}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.headerHelpBtn}
                onPress={() => setShowGuideModal(true)}
                activeOpacity={0.8}
                accessibilityLabel="Open Quick Guide"
              >
                <HelpCircle size={16} color="#0D9488" />
              </TouchableOpacity>
            </View>

            {/* Second Row: Subtitle on Left & Exam Mode Toggle on Right */}
            <View style={styles.headerSecondRow}>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                How are you feeling today?
              </Text>

              <TouchableOpacity
                style={[styles.crunchToggleBtn, isCrunchMode && styles.crunchToggleBtnActive]}
                onPress={toggleCrunchMode}
                activeOpacity={0.8}
                accessibilityLabel="Exam Mode Toggle"
              >
                <Ionicons
                  name="time-outline"
                  size={12.5}
                  color={isCrunchMode ? '#0F766E' : '#475569'}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.crunchToggleText, isCrunchMode && styles.crunchToggleTextActive]}>
                  {isCrunchMode ? 'Crunch ON' : 'Exam Mode'}
                </Text>
                <View style={[styles.switchTrack, isCrunchMode && styles.switchTrackActive]}>
                  <View style={[styles.switchThumb, isCrunchMode && styles.switchThumbActive]} />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Global Quick Search Bar */}
          <View style={styles.searchBarWrapper}>
            <View style={styles.searchBarContainer}>
              <Search size={17} color="#0D9488" style={{ marginRight: 10 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search tools, breathing, A+ track, journal..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="never"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={styles.searchClearBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={16} color="#64748B" />
                </TouchableOpacity>
              )}
            </View>

            {/* Quick-Jump Search Results Dropdown List */}
            {searchQuery.trim().length > 0 && (
              <View style={styles.searchResultsDropdown}>
                {filteredDestinations.length > 0 ? (
                  filteredDestinations.map((item, idx) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.searchResultItem,
                        idx < filteredDestinations.length - 1 && styles.searchResultItemBorder,
                      ]}
                      onPress={() => {
                        setSearchQuery('');
                        navigation.navigate(item.route);
                      }}
                      activeOpacity={0.75}
                    >
                      <View style={styles.searchResultIconBox}>
                        <Ionicons name={item.iconName} size={18} color="#0D9488" />
                      </View>
                      <View style={styles.searchResultTextBox}>
                        <Text style={styles.searchResultTitle}>{item.title}</Text>
                        <Text style={styles.searchResultDesc} numberOfLines={1}>
                          {item.desc}
                        </Text>
                      </View>
                      <ChevronRight size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.searchEmptyBox}>
                    <Text style={styles.searchEmptyText}>No matching tools found</Text>
                    <Text style={styles.searchEmptySub}>Try searching "breathing", "focus", or "chat"</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Discreet Light Mint Clinical Exam Crunch Mode Banner */}
          {isCrunchMode && (
            <View style={styles.crunchModeBanner}>
              <Ionicons name="time-outline" size={16} color="#0D9488" style={{ marginRight: 8 }} />
              <Text style={styles.crunchModeBannerText}>
                Exam Mode Active: Micro-breaks prioritized to reduce cognitive fatigue.
              </Text>
            </View>
          )}

          {/* 2. Hero Mindfulness Carousel Banner */}
          <View style={styles.carouselSection}>
            <FlatList
              ref={bannerListRef}
              data={HERO_BANNERS}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onBannerScroll}
              getItemLayout={(_, index) => ({
                length: BANNER_WIDTH,
                offset: BANNER_WIDTH * index,
                index,
              })}
              renderItem={({ item }) => (
                <View style={[styles.bannerSlide, { width: BANNER_WIDTH }]}>
                  <Image source={item.image} style={styles.bannerImage} resizeMode="cover" />
                  <LinearGradient
                    colors={['transparent', 'rgba(15, 23, 42, 0.72)']}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <View style={styles.bannerOverlay}>
                    <Text style={styles.bannerTag}>{item.tag}</Text>
                    <Text style={styles.bannerTitle}>{item.title}</Text>
                  </View>
                </View>
              )}
            />

            {/* Pagination Indicator Dots */}
            <View style={styles.carouselDotsRow}>
              {HERO_BANNERS.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.carouselDot,
                    activeBanner === idx ? styles.carouselDotActive : styles.carouselDotInactive,
                  ]}
                />
              ))}
            </View>
          </View>

          {/* High-visibility Dismissible Status Banner for unassessed users */}
          {shouldShowOnboardingBanner && (
            <View style={styles.promptBanner}>
              <View style={styles.promptBannerContent}>
                <View style={styles.promptBannerHeader}>
                  <Text style={styles.promptBannerTitle}>Clinical Onboarding</Text>
                  <TouchableOpacity
                    style={styles.promptBannerDismiss}
                    onPress={() => setOnboardingDismissed(true)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.promptBannerText}>
                  🌱 Complete your first clinical assessment to personalize your resilience plan.
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

          {/* 3. Quick Wellness Tools (2x2 Visual Card Grid) */}
          <View style={styles.quickAccessHeader}>
            <Text style={styles.gridHeader}>Quick Wellness Tools</Text>
            <Text style={styles.gridSubtitle}>Structured clinical activities</Text>
          </View>

          <View style={styles.grid}>
            {WELLNESS_TOOLS.map((tool, idx) => (
              <TouchableOpacity
                key={`wellness-tool-${idx}`}
                style={styles.qCard}
                onPress={() => navigation.navigate(tool.route)}
                activeOpacity={0.85}
              >
                {/* Edge-to-Edge 100% Background Tool Image (Zero Gaps) */}
                <Image
                  source={tool.image}
                  style={styles.qCardImage}
                  resizeMode="cover"
                />

                {/* Sleek Bottom Half Gradient Scrim for Contrast */}
                <LinearGradient
                  colors={['transparent', 'rgba(15, 23, 42, 0.82)']}
                  style={styles.qCardScrim}
                />

                {/* Bottom-Left Text Content */}
                <View style={styles.qTextWrapper}>
                  <Text style={styles.qTitle} numberOfLines={1}>
                    {tool.title}
                  </Text>
                  <Text style={styles.qDesc} numberOfLines={1}>
                    {tool.desc}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* 4. MindCare Support Sanctuary (Primary Teal AI Chat Card) */}
          <TouchableOpacity
            style={styles.agentCardShadow}
            onPress={() => navigation.navigate('Chat')}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={['#0D9488', '#14B8A6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.agentCardGradient}
            >
              <View style={styles.agentAvatarFrame}>
                <Image
                  source={require('../../assets/images/agent.jpg')}
                  style={styles.agentAvatarImage}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.agentTextContent}>
                <Text style={styles.agentTitle}>MindCare Support Sanctuary</Text>
                <Text style={styles.agentDesc}>
                  Confidential, empathetic clinical guidance 24/7
                </Text>
              </View>
              <View style={styles.agentActionIcon}>
                <MessageSquare size={17} color="#FFFFFF" />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* 5. Clinical & Weekly Insights Section (Grouped Together at the Bottom) */}
          <View style={styles.insightsHeader}>
            <Text style={styles.insightsSectionTitle}>Clinical & Weekly Insights</Text>
            <Text style={styles.insightsSectionSub}>Longitudinal wellness & stress indicators</Text>
          </View>

          {/* Luminous White Frosted Glass Mental Health Overview Card */}
          <View style={styles.statusCard}>
            <View style={styles.statusHeaderRow}>
              <Text style={styles.statusLabel}>MENTAL HEALTH OVERVIEW</Text>
              {/* Soft Mint Status Pill Badge */}
              <View
                style={[
                  styles.stressPill,
                  {
                    backgroundColor: stressCategory.bgColor,
                    borderColor: stressCategory.borderColor,
                  },
                ]}
              >
                <View
                  style={[styles.stressDot, { backgroundColor: stressCategory.dotColor }]}
                />
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
                    {latestAssessmentScore !== null && latestAssessmentScore !== undefined
                      ? `${Number(latestAssessmentScore).toFixed(1)}/10`
                      : analytics?.avg_stress !== undefined &&
                        analytics?.avg_stress !== null &&
                        !isNaN(Number(analytics?.avg_stress))
                      ? `${Number(analytics.avg_stress).toFixed(1)}/10`
                      : 'Pending'}
                  </Text>
                </>
              )}
            </Text>

            {/* Dynamic Score Progress Bar */}
            <View style={styles.scoreBarTrack}>
              <View
                style={[
                  styles.scoreBarFill,
                  {
                    width: `${scoreProgressPercent}%`,
                    backgroundColor: progressBarColor,
                  },
                ]}
              />
            </View>

            <Text style={styles.scoreScaleHint}>Scale: 0 (Calm) – 10 (High Tension)</Text>
          </View>

          {/* 2-Column Daily Biometric & Focus Snapshot Row (Pure Visual Status Widgets) */}
          <View style={styles.snapshotRow}>
            {/* Left Card: Sleep Balance */}
            <View style={styles.snapshotCard}>
              {/* Clean Rounded Thumbnail Image (height: 82) */}
              <Image
                source={require('../../assets/images/mood-great.jpg')}
                style={styles.snapshotThumbImg}
                resizeMode="cover"
              />

              <View style={styles.snapshotHeaderRow}>
                <Text style={styles.snapshotLabel} numberOfLines={1}>
                  SLEEP
                </Text>
                <View
                  style={[
                    styles.snapshotPill,
                    {
                      backgroundColor:
                        sleepStatus === 'Rested'
                          ? 'rgba(13, 148, 136, 0.12)'
                          : sleepStatus === 'Needs Rest'
                          ? 'rgba(217, 119, 6, 0.12)'
                          : 'rgba(100, 116, 139, 0.10)',
                      borderColor:
                        sleepStatus === 'Rested'
                          ? 'rgba(13, 148, 136, 0.25)'
                          : sleepStatus === 'Needs Rest'
                          ? 'rgba(217, 119, 6, 0.25)'
                          : 'rgba(100, 116, 139, 0.20)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.snapshotPillText,
                      {
                        color:
                          sleepStatus === 'Rested'
                            ? '#0F766E'
                            : sleepStatus === 'Needs Rest'
                            ? '#B45309'
                            : '#64748B',
                      },
                    ]}
                  >
                    {sleepStatus}
                  </Text>
                </View>
              </View>

              <Text style={styles.snapshotValue} numberOfLines={1}>
                {displaySleep}
              </Text>
            </View>

            {/* Right Card: Study Pacing */}
            <View style={styles.snapshotCard}>
              {/* Clean Rounded Thumbnail Image (height: 82) */}
              <Image
                source={require('../../assets/images/A-plus-banner1.jpg')}
                style={styles.snapshotThumbImg}
                resizeMode="cover"
              />

              <View style={styles.snapshotHeaderRow}>
                <Text style={styles.snapshotLabel} numberOfLines={1}>
                  STUDY PACING
                </Text>
                <View
                  style={[
                    styles.snapshotPill,
                    {
                      backgroundColor: pacingInfo.bg,
                      borderColor: pacingInfo.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.snapshotPillText,
                      { color: pacingInfo.color },
                    ]}
                  >
                    {pacingInfo.status}
                  </Text>
                </View>
              </View>

              <Text style={styles.snapshotValue} numberOfLines={1}>
                {pacingInfo.label}
              </Text>
            </View>
          </View>

          {/* White Frosted Glass Weekly Stress Card */}
          <View style={styles.graphCard}>
            <View style={styles.graphHeader}>
              <View style={styles.graphTitleContainer}>
                <Text style={styles.sectionTitle} numberOfLines={1}>
                  Weekly Stress
                </Text>
                <Text style={styles.sectionSubtitle} numberOfLines={1}>
                  Daily resilience patterns
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('Analytics')}
                style={styles.viewAllBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.viewAll}>View Insights</Text>
                <ChevronRight size={13} color="#0D9488" />
              </TouchableOpacity>
            </View>

            <View style={styles.barChartContainer}>
              {(() => {
                const trendData = getDynamicTrend();
                return trendData.map((item, index) => {
                  const fillHeight = item.hasStress
                    ? Math.max(10, Math.min(64, (item.stressScore / 10) * 64))
                    : 0;
                  const isHighAlert = item.hasStress && item.stressScore >= 6.5;
                  const isModerate = item.hasStress && item.stressScore >= 4.0;
                  const barColor = isHighAlert
                    ? '#DC2626'
                    : isModerate
                    ? '#D97706'
                    : item.hasStress
                    ? '#0D9488'
                    : 'transparent';
                  const shadowColor = isHighAlert
                    ? '#DC2626'
                    : isModerate
                    ? '#D97706'
                    : '#0D9488';

                  return (
                    <View key={item.day || index} style={styles.barWrapper}>
                      <View style={styles.barTrack}>
                        {/* Subtle Background Track Capsule (64px) */}
                        <View style={styles.barCapsuleBackground} />
                        {item.hasStress ? (
                          <View
                            style={[
                              styles.barInner,
                              {
                                height: fillHeight,
                                backgroundColor: barColor,
                                shadowColor: shadowColor,
                                shadowOpacity: 0.35,
                                shadowRadius: 6,
                                elevation: 2,
                              },
                            ]}
                          />
                        ) : null}
                      </View>
                      <Text style={[styles.barDayText, item.hasStress && styles.barDayTextActive]}>
                        {item.day}
                      </Text>
                    </View>
                  );
                });
              })()}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* First-Time User Quick Start Guide Modal */}
      <Modal
        visible={showGuideModal}
        transparent
        animationType="fade"
        onRequestClose={() => handleDismissGuide()}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.guideCard}>
            {/* Header */}
            <View style={styles.guideHeader}>
              <View style={styles.guideHeaderBadge}>
                <Text style={styles.guideBadgeText}>QUICK START GUIDE</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleDismissGuide()}
                style={styles.guideCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Close Guide"
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.guideTitle}>Welcome to MindCare</Text>
            <Text style={styles.guideSubtitle}>
              Your personalized mental resilience and academic pacing companion.
            </Text>

            {/* 3 Simple Steps */}
            <View style={styles.guideStepsList}>
              {/* Step 1 */}
              <View style={styles.guideStepRow}>
                <View style={styles.guideStepNumberBox}>
                  <Text style={styles.guideStepNumber}>1</Text>
                </View>
                <View style={styles.guideStepTextBox}>
                  <Text style={styles.guideStepTitle}>Check Your Baseline</Text>
                  <Text style={styles.guideStepDesc}>
                    Take a quick Assessment or log your daily Mood & Sleep so your wellness companion understands your current state.
                  </Text>
                </View>
              </View>

              {/* Step 2 */}
              <View style={styles.guideStepRow}>
                <View style={styles.guideStepNumberBox}>
                  <Text style={styles.guideStepNumber}>2</Text>
                </View>
                <View style={styles.guideStepTextBox}>
                  <Text style={styles.guideStepTitle}>Chat & Reflect</Text>
                  <Text style={styles.guideStepDesc}>
                    Talk 24/7 with your MindCare companion or save thoughts in your encrypted Reflective Journal.
                  </Text>
                </View>
              </View>

              {/* Step 3 */}
              <View style={styles.guideStepRow}>
                <View style={styles.guideStepNumberBox}>
                  <Text style={styles.guideStepNumber}>3</Text>
                </View>
                <View style={styles.guideStepTextBox}>
                  <Text style={styles.guideStepTitle}>Study & Decompress</Text>
                  <Text style={styles.guideStepDesc}>
                    Use A+ Study Track and Stress Relief (or toggle Exam Mode) to pace revision without burnout.
                  </Text>
                </View>
              </View>
            </View>

            {/* Single Primary Action Button */}
            <TouchableOpacity
              style={styles.guidePrimaryBtn}
              onPress={() => handleDismissGuide()}
              activeOpacity={0.88}
            >
              <Text style={styles.guidePrimaryBtnText}>Explore Dashboard</Text>
              <ChevronRight size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 115, // Generous padding so floating bottom tab bar never covers content
  },

  // Subtle Soft Mint/Aqua Ambient Circles
  ambientOrbTop: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(45, 212, 191, 0.24)',
  },
  ambientOrbMiddle: {
    position: 'absolute',
    top: 360,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(20, 184, 166, 0.20)',
  },
  ambientOrbBottom: {
    position: 'absolute',
    bottom: 100,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
  },

  // Header Container & Rows
  headerContainer: {
    marginBottom: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerGreetingCol: {
    flex: 1,
    marginRight: 10,
  },
  welcomeText: {
    fontSize: 25,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  headerSecondRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 13.5,
    color: '#475569',
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },

  // Global Quick Search Bar
  searchBarWrapper: {
    marginBottom: 14,
    zIndex: 10,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    paddingHorizontal: 14,
    height: 48,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0F172A',
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: 4,
    marginLeft: 6,
  },
  searchResultsDropdown: {
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 8,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  searchResultItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  searchResultIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  searchResultTextBox: {
    flex: 1,
    marginRight: 8,
  },
  searchResultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  searchResultDesc: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  searchEmptyBox: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchEmptyText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#475569',
  },
  searchEmptySub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },

  // Header Help Guide Circle
  headerHelpBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    borderWidth: 1.2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  // Crisp White Frosted Exam Mode Switch (Compact & Proportional)
  crunchToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1.2,
    borderColor: '#CBD5E1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 14,
    flexShrink: 0,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  crunchToggleBtnActive: {
    backgroundColor: '#CCFBF1',
    borderColor: '#99F6E4',
  },
  crunchToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginRight: 4,
  },
  crunchToggleTextActive: {
    color: '#0F766E',
  },
  switchTrack: {
    width: 26,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: '#CBD5E1',
    padding: 2,
    justifyContent: 'center',
    transform: [{ scale: 0.72 }],
    marginLeft: -4,
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

  // Light Mint Exam Mode Banner
  crunchModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1.2,
    borderColor: '#99F6E4',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 16,
  },
  crunchModeBannerText: {
    color: '#0F766E',
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1,
  },

  // Hero Wellness Banner Carousel
  carouselSection: {
    marginBottom: 18,
  },
  bannerSlide: {
    height: 155,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: '#F1F5F9',
    position: 'relative',
    justifyContent: 'flex-end',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  bannerOverlay: {
    padding: 16,
    zIndex: 2,
  },
  bannerTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2DD4BF',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  carouselDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  carouselDot: {
    height: 6,
    borderRadius: 3,
  },
  carouselDotActive: {
    width: 22,
    backgroundColor: '#0D9488',
  },
  carouselDotInactive: {
    width: 6,
    backgroundColor: '#CBD5E1',
  },

  // Clinical Onboarding Prompt Banner
  promptBanner: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    padding: 16,
    marginBottom: 18,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
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
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  promptBannerDismiss: {
    padding: 2,
  },
  promptBannerText: {
    fontSize: 13.5,
    color: '#166534',
    lineHeight: 19,
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

  // 3. Luminous White Frosted Glass Mental Health Overview Card
  statusCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    padding: 20,
    borderRadius: 24,
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusLabel: {
    color: '#64748B',
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1,
  },
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
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  statusValue: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: -0.3,
  },
  statusSub: {
    color: '#475569',
    fontSize: 13.5,
    marginTop: 6,
    lineHeight: 19,
    fontWeight: '500',
  },
  statusHighlight: {
    fontWeight: '700',
  },
  scoreBarTrack: {
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#E2E8F0',
    marginTop: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 3.5,
  },
  scoreScaleHint: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 6,
  },

  // 2-Column Daily Biometric & Focus Snapshot Row (Visual Status Widgets)
  snapshotRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  snapshotCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    padding: 12,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  snapshotThumbImg: {
    width: '100%',
    height: 82,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: '#E2E8F0',
  },
  snapshotHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  snapshotLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    flex: 1,
    flexShrink: 1,
  },
  snapshotPill: {
    paddingHorizontal: 6.5,
    paddingVertical: 2.5,
    borderRadius: 7,
    borderWidth: 1,
    flexShrink: 0,
  },
  snapshotPillText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  snapshotValue: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },

  // MindCare Support Sanctuary Card in Rich Vibrant Teal
  agentCardShadow: {
    marginBottom: 18,
    borderRadius: 22,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.30,
    shadowRadius: 14,
    elevation: 5,
  },
  agentCardGradient: {
    padding: 16,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  agentAvatarFrame: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  agentAvatarImage: {
    width: '100%',
    height: '100%',
  },
  agentTextContent: {
    flex: 1,
    paddingHorizontal: 12,
  },
  agentTitle: {
    color: '#FFFFFF',
    fontSize: 16.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  agentDesc: {
    color: '#E6FFFA',
    fontSize: 12.5,
    marginTop: 2,
    lineHeight: 17,
  },
  agentActionIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    padding: 10,
    borderRadius: 12,
  },

  // 4. White Frosted Glass Weekly Stress Overview Card
  graphCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    padding: 20,
    borderRadius: 24,
    marginBottom: 22,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  graphHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  graphTitleContainer: {
    flex: 1,
    paddingRight: 12,
  },
  sectionTitle: {
    fontWeight: '700',
    fontSize: 16,
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 148, 136, 0.10)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    flexShrink: 0,
    gap: 2,
  },
  viewAll: {
    color: '#0D9488',
    fontSize: 12.5,
    fontWeight: '700',
  },
  barChartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 110,
    paddingTop: 8,
    paddingBottom: 4,
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  barTrack: {
    height: 64,
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
    position: 'relative',
  },
  barCapsuleBackground: {
    position: 'absolute',
    bottom: 0,
    width: 14,
    height: 64,
    borderRadius: 7,
    backgroundColor: 'rgba(13, 148, 136, 0.08)',
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
  barDayTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },

  // 5. Quick Wellness Tools 2x2 Grid (No Top Icons, Edge-to-Edge)
  quickAccessHeader: {
    marginBottom: 12,
  },
  gridHeader: {
    fontSize: 16.5,
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
  },
  qCard: {
    width: '48%',
    height: 155,
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'flex-end',
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  qCardImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  qCardScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '58%',
  },
  qTextWrapper: {
    padding: 14,
    zIndex: 2,
  },
  qTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  qDesc: {
    fontSize: 12,
    color: '#E2E8F0',
    lineHeight: 16,
    fontWeight: '500',
  },

  // 6. Clinical & Weekly Insights Header
  insightsHeader: {
    marginTop: 6,
    marginBottom: 12,
  },
  insightsSectionTitle: {
    fontSize: 16.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  insightsSectionSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },

  // 7. Quick Start Guide Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  guideCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  guideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  guideHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  guideBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0F766E',
    letterSpacing: 0.6,
  },
  guideCloseBtn: {
    padding: 4,
  },
  guideTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  guideSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 16,
  },
  guideStepsList: {
    gap: 12,
    marginBottom: 20,
  },
  guideStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  guideStepNumberBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  guideStepNumber: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  guideStepTextBox: {
    flex: 1,
  },
  guideStepTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  guideStepDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
    marginTop: 2,
  },
  guidePrimaryBtn: {
    backgroundColor: '#0D9488',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    gap: 6,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  guidePrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
  guideSecondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    marginTop: 4,
  },
  guideSecondaryBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
});
