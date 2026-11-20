import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Image,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Clock, 
  Lightbulb, 
  ChevronRight,
  RefreshCw,
} from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserProfile, getAcademicPacing, getDailyTip } from '../api/authService';

const BASE_URL = 'http://10.234.214.156:8000';

// 5 Bundled High-Resolution Calming Stress Banner Photographs with Dynamic Thematic Copy
const BANNER_SLIDES = [
  {
    image: require('../../assets/images/stress-banner-1.jpg'),
    tag: 'NERVOUS SYSTEM REGULATION',
    title: 'Pause, breathe, and reset your nervous system',
  },
  {
    image: require('../../assets/images/stress-banner-2.jpg'),
    tag: 'COGNITIVE CLARITY',
    title: 'Structure your study blocks for calm, deep focus',
  },
  {
    image: require('../../assets/images/stress-banner-3.jpg'),
    tag: 'MINDFUL SANCTUARY',
    title: 'Quiet mental noise with guided audio stillness',
  },
  {
    image: require('../../assets/images/stress-banner-4.jpg'),
    tag: 'EMOTIONAL GROUNDING',
    title: 'Release academic pressure through gentle reflection',
  },
  {
    image: require('../../assets/images/stress-banner-5.jpg'),
    tag: 'EXAM & VIVA RESILIENCE',
    title: 'Build steady confidence one mindful step at a time',
  },
];

const RelaxScreen = ({ navigation }) => {
  const [dailyTip, setDailyTip] = useState('Taking just 5 minutes for mindful breathing can significantly reduce sympathetic nervous arousal.');
  const [loadingTip, setLoadingTip] = useState(false);
  const [activeUserId, setActiveUserId] = useState('demo_user');

  // Hero Banner Auto-Slide State (4000ms cycle)
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);

  // Academic Cognitive Pacing State ("A+ Track")
  const [pacingData, setPacingData] = useState({
    focus_minutes: 35,
    break_minutes: 8,
    status_label: 'Cognitive Reset',
    guidance_tip: 'Moderate cognitive tension detected. Adopt a 35m focus rhythm with 8m active resets to preserve sustained attention.'
  });
  const [loadingPacing, setLoadingPacing] = useState(false);
  const [isCrunchMode, setIsCrunchMode] = useState(false);

  // Hero Banner Auto-slide cycle every 4000ms
  useEffect(() => {
    const bannerTimer = setInterval(() => {
      setActiveBannerIndex((prev) => (prev + 1) % BANNER_SLIDES.length);
    }, 4000);
    return () => clearInterval(bannerTimer);
  }, []);

  const activeSlide = BANNER_SLIDES[activeBannerIndex] || BANNER_SLIDES[0];

  // Dynamic Data Fetching for Academic Pacing on Screen Focus
  const fetchAcademicPacing = useCallback(async () => {
    try {
      setLoadingPacing(true);
      let targetUser = activeUserId || 'demo_user';
      try {
        const userRes = await getUserProfile();
        if (userRes?.data?.id) {
          targetUser = userRes.data.id;
          setActiveUserId(userRes.data.id);
        }
      } catch (err) {
        // Fallback to active user identifier
      }

      const res = await getAcademicPacing(targetUser);
      if (res?.data && res.data.focus_minutes) {
        setPacingData(res.data);
      }
    } catch (error) {
      console.log('Error fetching academic pacing, keeping active baseline:', error);
    } finally {
      setLoadingPacing(false);
    }
  }, [activeUserId]);

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
      fetchAcademicPacing();
    }, [fetchAcademicPacing])
  );

  useEffect(() => {
    // 1. Immediately hydrate cached daily tip from AsyncStorage for instant render
    const hydrateCachedTip = async () => {
      try {
        const cached = await AsyncStorage.getItem('@mindcare_cached_daily_tip');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.tip) {
            setDailyTip(parsed.tip);
          }
        }
      } catch (e) {
        // ignore
      }
    };
    hydrateCachedTip();
    fetchUserDataAndTip();
  }, []);

  const fetchUserDataAndTip = async (forcedUserId = null) => {
    setLoadingTip(true);
    let resolvedUserId = forcedUserId || activeUserId;

    // 1. Resolve user ID from cached profile if not already set
    if (!resolvedUserId || resolvedUserId === 'demo_user') {
      try {
        const cachedProf = await AsyncStorage.getItem('@mindcare_cached_profile');
        if (cachedProf) {
          const parsed = JSON.parse(cachedProf);
          if (parsed?.id || parsed?.user_id) {
            resolvedUserId = parsed.id || parsed.user_id;
            setActiveUserId(resolvedUserId);
          }
        }
      } catch (e) {
        // ignore
      }
    }

    // 2. Fallback to getUserProfile() if still unresolved
    if (!resolvedUserId || resolvedUserId === 'demo_user') {
      try {
        const userRes = await getUserProfile();
        if (userRes?.data?.id) {
          resolvedUserId = userRes.data.id;
          setActiveUserId(resolvedUserId);
        }
      } catch (e) {
        console.log('Using default user identifier for tips');
      }
    }

    // 3. Fetch immediate micro-action tip from backend (passing user_id)
    try {
      const tipRes = await getDailyTip(resolvedUserId && resolvedUserId !== 'demo_user' ? resolvedUserId : null);
      if (tipRes?.data?.tip) {
        setDailyTip(tipRes.data.tip);
        await AsyncStorage.setItem(
          '@mindcare_cached_daily_tip',
          JSON.stringify({
            tip: tipRes.data.tip,
            personalized: Boolean(tipRes.data.personalized),
            timestamp: Date.now(),
          })
        );
      }
    } catch (error) {
      // Direct fetch fallback if axios interceptor encountered network issues
      try {
        const queryParam = resolvedUserId && resolvedUserId !== 'demo_user' ? `?user_id=${encodeURIComponent(resolvedUserId)}` : '';
        const response = await fetch(`${BASE_URL}/user/daily-tip${queryParam}`);
        const data = await response.json();
        if (data && data.tip) {
          setDailyTip(data.tip);
          await AsyncStorage.setItem(
            '@mindcare_cached_daily_tip',
            JSON.stringify({
              tip: data.tip,
              personalized: Boolean(data.personalized),
              timestamp: Date.now(),
            })
          );
        }
      } catch (fallbackError) {
        console.log('Error fetching daily tip, keeping current tip:', fallbackError);
      }
    } finally {
      setLoadingTip(false);
    }
  };

  // Protocols List (Prioritizes 2-minute Instant Decompression Breathing when Exam Crunch Mode is active)
  const instantDecompressionOption = {
    id: 'crunch-box-breathing',
    title: 'Instant Decompression',
    desc: '2-minute rapid autonomic box breathing reset for pre-exam states',
    image: require('../../assets/images/instant-breathing.jpg'),
    action: () => navigation.navigate('Breathing', {
      mode: 'instant_decompression',
      durationMinutes: 2,
      title: 'Instant Decompression',
    }),
  };

  const baseOptions = [
    { 
      id: '1', 
      title: 'Breathing Exercise', 
      desc: 'Calm autonomic arousal with guided breathwork', 
      image: require('../../assets/images/breathing-exercise.jpg'),
      route: 'BreathingExercise'
    },
    { 
      id: '2', 
      title: 'Focus Timer', 
      desc: 'Structured Pomodoro intervals for cognitive pacing', 
      image: require('../../assets/images/focus-timer.jpg'),
      route: 'FocusTimer'
    },
    { 
      id: '3', 
      title: 'Guided Meditation', 
      desc: '5-minute audio mindfulness decompression sanctuary', 
      image: require('../../assets/images/mediation.jpg'),
      route: 'MeditationScreen'
    },
    {
      id: '4',
      title: 'Reflective Journaling',
      desc: 'Ground your thoughts and process emotional patterns',
      image: require('../../assets/images/journaling.jpg'),
      route: 'JournalScreen'
    },
    {
      id: '5',
      title: 'A+ Track: Academic Resilience',
      desc: 'Stress-adapted study pacing & exam readiness',
      image: require('../../assets/images/A+-track.jpg'),
      route: 'AplusTrackScreen'
    }
  ];

  const options = isCrunchMode ? [instantDecompressionOption, ...baseOptions] : baseOptions;

  return (
    <View style={styles.container}>
      {/* Ambient Translucent Mint-Teal and Soft Sky-Blue Circles (Identical to HomeScreen.js) */}
      <View pointerEvents="none" style={styles.ambientOrbTop} />
      <View pointerEvents="none" style={styles.ambientOrbMiddle} />
      <View pointerEvents="none" style={styles.ambientOrbBottom} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Top Header (Compact & Tightened) */}
          <View style={styles.header}>
            <Text style={styles.title}>Mindful Calm & Coping</Text>
            <Text style={styles.subtitle}>
              Evidence-based relaxation tools to restore mental balance
            </Text>
          </View>

          {/* Hero Banner: Full-Bleed 185px Auto-Slide with Dynamic Thematic Copy */}
          <View style={styles.heroBannerCard}>
            <ImageBackground 
              source={activeSlide.image}
              style={styles.heroBannerBackground}
              imageStyle={styles.heroBannerImage}
              resizeMode="cover"
            >
              <View style={styles.heroBannerScrim}>
                <View style={styles.heroBannerBottomRow}>
                  <View style={styles.heroBannerTextCol}>
                    <View style={styles.heroBadge}>
                      <Text style={styles.heroBadgeText}>{activeSlide.tag}</Text>
                    </View>
                    <Text style={styles.heroMotivationalText}>
                      {activeSlide.title}
                    </Text>
                  </View>

                  {/* Subtle Auto-Slide Pagination Dots */}
                  <View style={styles.paginationDotsWrap}>
                    {BANNER_SLIDES.map((_, idx) => (
                      <View 
                        key={idx} 
                        style={[
                          styles.paginationDot, 
                          idx === activeBannerIndex && styles.paginationDotActive
                        ]} 
                      />
                    ))}
                  </View>
                </View>
              </View>
            </ImageBackground>
          </View>

          {/* Discreet Clinical Exam Crunch Mode Banner */}
          {isCrunchMode && (
            <View style={styles.crunchModeBanner}>
              <Clock size={15} color="#0D9488" style={{ marginRight: 8 }} />
              <Text style={styles.crunchModeBannerText}>
                Exam Mode Active: Micro-breaks prioritized to reduce cognitive fatigue.
              </Text>
            </View>
          )}

          {/* Relaxation Protocols List */}
          <View style={styles.listContainer}>
            {options.map((item) => (
              <TouchableOpacity 
                key={item.id} 
                style={styles.card}
                onPress={() => {
                  if (item.action) {
                    item.action();
                  } else if (item.route) {
                    navigation.navigate(item.route);
                  }
                }}
                activeOpacity={0.82}
              >
                <Image 
                  source={item.image} 
                  style={styles.cardThumbnail} 
                  resizeMode="cover"
                />
                <View style={styles.textContent}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {item.desc}
                  </Text>
                </View>

                <View style={styles.chevronBtnWrap}>
                  <ChevronRight size={18} color="#0D9488" strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Clinical Daily Tip Card */}
          <View style={styles.tipCard}>
            <View style={styles.tipHeader}>
              <View style={styles.tipHeaderLeft}>
                <View style={styles.tipIconCircle}>
                  <Lightbulb size={16} color="#0D9488" />
                </View>
                <Text style={styles.tipTitle}>Clinical Daily Tip</Text>
                <View style={styles.microActionBadge}>
                  <Text style={styles.microActionBadgeText}>Today's Micro-Action</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.tipRefreshBtn}
                onPress={() => fetchUserDataAndTip()}
                disabled={loadingTip}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
                accessibilityLabel="Generate New Micro-Action Tip"
              >
                {loadingTip ? (
                  <ActivityIndicator size="small" color="#0D9488" />
                ) : (
                  <RefreshCw size={14} color="#0D9488" />
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.tipText}>{dailyTip}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#EDF5F4' 
  },
  safeArea: { 
    flex: 1 
  },
  scrollContent: { 
    paddingHorizontal: 20, 
    paddingTop: 12, 
    paddingBottom: 110 
  },

  // Ambient Translucent Mint-Teal & Soft Sky-Blue Circles (Matching HomeScreen.js)
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

  // Header (Compact & Tightened)
  header: { 
    marginTop: 0,
    marginBottom: 14,
  },
  title: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  subtitle: { 
    fontSize: 13, 
    color: '#64748B', 
    marginTop: 4, 
    lineHeight: 19 
  },

  // Hero Banner: Full-Bleed 185px Auto-Slide Card
  heroBannerCard: {
    width: '100%',
    height: 185,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    marginBottom: 16,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 3,
  },
  heroBannerBackground: {
    width: '100%',
    height: 185,
    justifyContent: 'flex-end',
  },
  heroBannerImage: {
    borderRadius: 22,
  },
  heroBannerScrim: {
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: '100%',
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  heroBannerBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  heroBannerTextCol: {
    flex: 1,
    paddingRight: 10,
  },
  heroBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    marginBottom: 6,
  },
  heroBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#CCFBF1',
    letterSpacing: 1.2,
  },
  heroMotivationalText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 19,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  paginationDotsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 2,
  },
  paginationDot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    marginHorizontal: 2.5,
  },
  paginationDotActive: {
    width: 14,
    height: 5.5,
    borderRadius: 3,
    backgroundColor: '#2DD4BF',
  },

  // Crunch Mode Banner
  crunchModeBanner: {
    backgroundColor: 'rgba(240, 253, 250, 0.92)',
    borderWidth: 1.5,
    borderColor: '#99F6E4',
    borderRadius: 18,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  crunchModeBannerText: {
    fontSize: 12.5,
    color: '#0D9488',
    fontWeight: '600',
    flex: 1,
    lineHeight: 17,
  },

  // Relaxation Protocols List & Frosted White Glass Cards
  listContainer: { 
    marginBottom: 16 
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    padding: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 18,
    marginRight: 14,
  },
  textContent: { 
    flex: 1,
    marginRight: 10,
  },
  cardTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#0F172A', 
    marginBottom: 3 
  },
  cardDesc: { 
    fontSize: 12.5, 
    color: '#64748B', 
    lineHeight: 17 
  },
  chevronBtnWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(13, 148, 136, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Frosted White Glass Daily Tip Card
  tipCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    padding: 16,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 24,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tipHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  tipIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  microActionBadge: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  microActionBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0D9488',
    letterSpacing: 0.2,
  },
  tipRefreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  tipText: { 
    fontSize: 13, 
    color: '#475569', 
    lineHeight: 20 
  },
});

export default RelaxScreen;
