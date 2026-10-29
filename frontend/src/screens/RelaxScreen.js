import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  Alert,
  Modal,
  Animated,
  Easing
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Wind, 
  Clock, 
  BookOpen, 
  Headphones, 
  PlayCircle, 
  PauseCircle,
  Play, 
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
  Edit3,
  Lightbulb, 
  CheckCircle2, 
  Heart,
  Brain,
  ShieldCheck,
  Award,
  ChevronRight,
  GraduationCap
} from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSafeAudioPlayer } from '../utils/safeAudio';
import { analyzeAndRecordJournal, getUserProfile, getAcademicPacing } from '../api/authService';

const BASE_URL = 'http://10.234.214.156:8000'; 
const TOTAL_MEDITATION_SECONDS = 5 * 60; // 5 Minutes (300 Seconds)
const TOTAL_BOX_BREATHING_SECONDS = 120; // 2 Minutes (120 Seconds)

const RelaxScreen = ({ navigation }) => {
  const [dailyTip, setDailyTip] = useState('Taking just 5 minutes for mindful breathing can significantly reduce sympathetic nervous arousal.');
  const [loadingTip, setLoadingTip] = useState(false);
  const [activeUserId, setActiveUserId] = useState('demo_user');

  // Academic Cognitive Pacing State ("A+ Track")
  const [pacingData, setPacingData] = useState({
    focus_minutes: 35,
    break_minutes: 8,
    status_label: 'Cognitive Reset',
    guidance_tip: 'Moderate cognitive tension detected. Adopt a 35m focus rhythm with 8m active resets to preserve sustained attention.'
  });
  const [loadingPacing, setLoadingPacing] = useState(false);
  const [isCrunchMode, setIsCrunchMode] = useState(false);

  // Dedicated 2-Minute Pre-Exam Box Breathing State
  const [isBoxBreathingModalVisible, setIsBoxBreathingModalVisible] = useState(false);
  const [boxSecondsLeft, setBoxSecondsLeft] = useState(TOTAL_BOX_BREATHING_SECONDS);
  const [isBoxActive, setIsBoxActive] = useState(false);

  // Box Breathing Pulse Animation Refs (4s Inhale, 4s Hold, 4s Exhale, 4s Hold)
  const boxPulseAnim = useRef(new Animated.Value(1)).current;
  const boxPulseOpacity = useRef(new Animated.Value(0.4)).current;
  const boxLoopRef = useRef(null);

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
    fetchUserDataAndTip();
  }, []);

  // Box Breathing Animation Cycle (16s full cycle: 4s Inhale, 4s Hold, 4s Exhale, 4s Hold)
  const startBoxBreathingCycle = () => {
    boxPulseAnim.setValue(1);
    boxPulseOpacity.setValue(0.4);
    boxLoopRef.current = Animated.loop(
      Animated.sequence([
        // 1. Inhale (4s) - expands smoothly
        Animated.parallel([
          Animated.timing(boxPulseAnim, {
            toValue: 1.38,
            duration: 4000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(boxPulseOpacity, {
            toValue: 0.85,
            duration: 4000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        // 2. Hold (4s) - sustains expansion
        Animated.delay(4000),
        // 3. Exhale (4s) - contracts smoothly
        Animated.parallel([
          Animated.timing(boxPulseAnim, {
            toValue: 1.0,
            duration: 4000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(boxPulseOpacity, {
            toValue: 0.4,
            duration: 4000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        // 4. Hold (4s) - rests at baseline
        Animated.delay(4000),
      ])
    );
    boxLoopRef.current.start();
  };

  const stopBoxBreathingCycle = () => {
    if (boxLoopRef.current) {
      boxLoopRef.current.stop();
      boxLoopRef.current = null;
    }
    boxPulseAnim.setValue(1);
    boxPulseOpacity.setValue(0.4);
  };

  // Box Breathing countdown tick (120s)
  useEffect(() => {
    let interval = null;
    if (isBoxBreathingModalVisible && isBoxActive) {
      interval = setInterval(() => {
        setBoxSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleCompleteBoxBreathing();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isBoxBreathingModalVisible, isBoxActive]);

  const handleOpenBoxBreathing = () => {
    setBoxSecondsLeft(TOTAL_BOX_BREATHING_SECONDS);
    setIsBoxActive(true);
    setIsBoxBreathingModalVisible(true);
    startBoxBreathingCycle();
  };

  const handleCloseBoxBreathing = () => {
    stopBoxBreathingCycle();
    setIsBoxActive(false);
    setBoxSecondsLeft(TOTAL_BOX_BREATHING_SECONDS);
    setIsBoxBreathingModalVisible(false);
  };

  const handleCompleteBoxBreathing = () => {
    stopBoxBreathingCycle();
    setIsBoxActive(false);
    Alert.alert(
      "Grounding Complete 🧘",
      "2 minutes of clinical box breathing finished. Your autonomic tone is regulated and mental clarity is restored for academic focus.",
      [{ text: "Done", onPress: handleCloseBoxBreathing }]
    );
  };

  const fetchUserDataAndTip = async () => {
    setLoadingTip(true);
    try {
      const userRes = await getUserProfile();
      if (userRes?.data?.id) {
        setActiveUserId(userRes.data.id);
      }
    } catch (e) {
      console.log('Using default user identifier for tips');
    }

    try {
      const response = await fetch(`${BASE_URL}/user/daily-tip`);
      const data = await response.json();
      if (data && data.tip) {
        setDailyTip(data.tip);
      }
    } catch (error) {
      console.log('Error fetching daily tip, using default clinical tip:', error);
    } finally {
      setLoadingTip(false);
    }
  };

  const formatTime = (seconds) => {
    const clamped = Math.max(0, seconds);
    const m = Math.floor(clamped / 60);
    const s = clamped % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Protocols List (Prioritizes 2-minute Instant Decompression Breathing when Exam Crunch Mode is active)
  const instantDecompressionOption = {
    id: 'crunch-box-breathing',
    title: 'Instant Decompression Breathing',
    desc: '2-minute rapid autonomic box breathing reset for pre-exam states',
    icon: <Wind size={24} color="#0D9488" />,
    bgColor: '#CCFBF1',
    isModalAction: true,
    action: handleOpenBoxBreathing
  };

  const baseOptions = [
    { 
      id: '1', 
      title: 'Breathing Exercise', 
      desc: 'Calm autonomic arousal with guided breathwork', 
      icon: <Wind size={24} color="#0D9488" />, 
      bgColor: '#F0FDFA',
      route: 'BreathingExercise'
    },
    { 
      id: '2', 
      title: 'Focus Timer', 
      desc: 'Structured Pomodoro intervals for cognitive pacing', 
      icon: <Clock size={24} color="#0D9488" />, 
      bgColor: '#F0FDFA',
      route: 'FocusTimer'
    },
    { 
      id: '3', 
      title: 'Guided Meditation', 
      desc: '5-minute audio mindfulness decompression sanctuary', 
      icon: <Headphones size={24} color="#0D9488" />, 
      bgColor: '#F0FDFA',
      route: 'MeditationScreen'
    },
    {
      id: '4',
      title: 'Reflective Journaling',
      desc: 'Ground your thoughts and process emotional patterns',
      icon: <BookOpen size={24} color="#0D9488" />,
      bgColor: '#F0FDFA',
      route: 'JournalScreen'
    },
    {
      id: '5',
      title: 'A+ Track: Academic Resilience',
      desc: 'Stress-adapted study pacing & exam readiness',
      icon: <GraduationCap size={24} color="#0D9488" />,
      bgColor: '#F0FDFA',
      route: 'AplusTrackScreen'
    }
  ];

  const options = isCrunchMode ? [instantDecompressionOption, ...baseOptions] : baseOptions;

  // Derive Box Breathing Phase & Instruction (16-second cycle: 4s Inhale, 4s Hold, 4s Exhale, 4s Hold)
  const elapsedBox = TOTAL_BOX_BREATHING_SECONDS - boxSecondsLeft;
  const cycleSec = elapsedBox % 16;
  let boxPhaseName = 'Inhale';
  let boxPhaseInstruction = 'Breathe in slowly through the nose';
  let boxPhaseCountdown = 4 - (cycleSec % 4);

  if (cycleSec < 4) {
    boxPhaseName = 'Inhale';
    boxPhaseInstruction = 'Breathe in slowly through the nose (4s)';
  } else if (cycleSec < 8) {
    boxPhaseName = 'Hold';
    boxPhaseInstruction = 'Sustain breath calmly without strain (4s)';
  } else if (cycleSec < 12) {
    boxPhaseName = 'Exhale';
    boxPhaseInstruction = 'Slowly empty lungs through the mouth (4s)';
  } else {
    boxPhaseName = 'Hold';
    boxPhaseInstruction = 'Rest quietly before the next cycle (4s)';
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Stress Relief & Coping</Text>
          <Text style={styles.subtitle}>Evidence-based relaxation protocols to regulate your nervous system</Text>
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
              activeOpacity={0.8}
            >
              <View style={[styles.iconBg, { backgroundColor: item.bgColor }]}>
                {item.icon}
              </View>
              <View style={styles.textContent}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {item.desc}
                </Text>
              </View>

              <View style={styles.playBtnWrap}>
                <ChevronRight size={22} color="#0D9488" />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Clinical Daily Tip Card */}
        <View style={styles.tipCard}>
          <View style={styles.tipHeader}>
            <View style={styles.tipIconCircle}>
              <Lightbulb size={16} color="#0D9488" />
            </View>
            <Text style={styles.tipTitle}>Clinical Daily Tip</Text>
          </View>
          {loadingTip ? (
            <ActivityIndicator color="#0D9488" size="small" style={{ alignSelf: 'flex-start', marginTop: 8 }} />
          ) : (
            <Text style={styles.tipText}>{dailyTip}</Text>
          )}
        </View>
      </ScrollView>

      {/* Dedicated 2-Minute Pre-Exam Box Breathing Modal */}
      <Modal
        visible={isBoxBreathingModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseBoxBreathing}
      >
        <View style={styles.boxModalOverlay}>
          <View style={styles.boxModalContainer}>
            {/* Modal Header */}
            <View style={styles.boxModalHeader}>
              <View>
                <Text style={styles.boxModalTitle}>Pre-Exam Grounding</Text>
                <Text style={styles.boxModalSubtitle}>2-Minute Box Breathing Protocol</Text>
              </View>
              <TouchableOpacity 
                onPress={handleCloseBoxBreathing}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Visual Pulse Circle */}
            <View style={styles.boxPulseArea}>
              <Animated.View 
                style={[
                  styles.boxPulseRing, 
                  {
                    transform: [{ scale: boxPulseAnim }],
                    opacity: boxPulseOpacity,
                  }
                ]} 
              />
              <View style={styles.boxCenterCircle}>
                <Text style={styles.boxPhaseText}>{boxPhaseName}</Text>
                <Text style={styles.boxPhaseCount}>{boxPhaseCountdown}s</Text>
              </View>
            </View>

            {/* Phase Guidance & Minimalist Timer Countdown */}
            <View style={styles.boxInstructionWrap}>
              <Text style={styles.boxPhaseInstruction}>{boxPhaseInstruction}</Text>
              <View style={styles.boxCountdownRow}>
                <Clock size={15} color="#0D9488" />
                <Text style={styles.boxCountdownText}>
                  {formatTime(boxSecondsLeft)} remaining
                </Text>
              </View>
            </View>

            {/* Synchronized Modal Actions: Finish Session & Close */}
            <View style={styles.boxActionsRow}>
              <TouchableOpacity 
                style={styles.boxFinishBtn}
                onPress={handleCompleteBoxBreathing}
                activeOpacity={0.85}
              >
                <Text style={styles.boxFinishBtnText}>Finish Session</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.boxCloseBtn}
                onPress={handleCloseBoxBreathing}
                activeOpacity={0.85}
              >
                <Text style={styles.boxCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 22, paddingBottom: 100 },
  header: { marginBottom: 24 },
  title: { fontSize: 25, fontWeight: '800', color: '#1E293B' },
  subtitle: { fontSize: 14, color: '#64748B', marginTop: 6, lineHeight: 20 },
  listContainer: { gap: 14 },
  card: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFFFFF', 
    padding: 16, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    elevation: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6
  },
  cardActive: {
    borderColor: '#0D9488',
    backgroundColor: '#F0FDFA',
  },
  iconBg: { 
    width: 48, 
    height: 48, 
    borderRadius: 14, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#CCFBF1'
  },
  textContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  cardDesc: { fontSize: 13, color: '#64748B', marginTop: 3, lineHeight: 18 },
  cardDescActive: { color: '#0D9488', fontWeight: '600' },
  playBtnWrap: {
    padding: 6
  },
  journalModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  journalModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 36,
    maxHeight: '85%',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
  },
  journalModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  journalModalTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  journalModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F766E',
  },
  journalModalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  journalModalGuidance: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 14,
  },
  journalIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E6F4F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#CCFBF1'
  },
  journalInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 14,
    fontSize: 15,
    color: '#1E293B',
    minHeight: 120,
    textAlignVertical: 'top',
    lineHeight: 22
  },
  journalSubmitBtn: {
    backgroundColor: '#0D9488',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 14,
    gap: 8,
    elevation: 2
  },
  journalSubmitBtnDisabled: {
    backgroundColor: '#94A3B8'
  },
  journalSubmitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700'
  },
  reflectionCard: {
    backgroundColor: '#F0FDFA',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#CCFBF1',
    padding: 16,
    marginTop: 16
  },
  reflectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6
  },
  reflectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F766E'
  },
  reflectionBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10
  },
  reflectionEmotionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F4F1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4
  },
  reflectionEmotionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F766E'
  },
  reflectionTriggerBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CCFBF1'
  },
  reflectionTriggerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0D9488'
  },
  reflectionSentimentBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  reflectionSentimentText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B'
  },
  reflectionBody: {
    fontSize: 14,
    color: '#134E4A',
    lineHeight: 21,
    fontStyle: 'italic',
    marginBottom: 12
  },
  resetReflectionBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4
  },
  resetReflectionText: {
    color: '#0D9488',
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline'
  },
  viewFullJournalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    gap: 8,
    marginTop: 18,
  },
  viewFullJournalText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D9488',
  },
  tipCard: { 
    backgroundColor: '#F0FDFA', 
    padding: 20, 
    borderRadius: 22, 
    marginTop: 22,
    borderWidth: 1.5,
    borderColor: '#CCFBF1'
  },
  tipHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  tipIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#CCFBF1'
  },
  tipTitle: { color: '#0F766E', fontWeight: '800', fontSize: 14, letterSpacing: 0.4 },
  tipText: { color: '#134E4A', fontSize: 14, lineHeight: 22, fontWeight: '500' },

  // Modal Player Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 36,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F766E',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseArea: {
    width: 170,
    height: 170,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  pulseOuterRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#CCFBF1',
  },
  pulseMiddleRing: {
    position: 'absolute',
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: '#E6F4F1',
  },
  pulseCoreCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#0D9488',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  timerDisplayWrap: {
    alignItems: 'center',
    marginTop: 10,
  },
  timerCountdownText: {
    fontSize: 42,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 1.5,
  },
  timerStatusSub: {
    fontSize: 13,
    color: '#0D9488',
    fontWeight: '600',
    marginTop: 2,
  },
  modalProgressBarWrap: {
    width: '100%',
    marginTop: 20,
  },
  modalProgressBarTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  modalProgressBarFill: {
    height: '100%',
    backgroundColor: '#0D9488',
    borderRadius: 3,
  },
  modalProgressTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  modalProgressTimeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  audioBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    marginTop: 14,
  },
  audioBadgeText: {
    fontSize: 12,
    color: '#0F766E',
    fontWeight: '600',
  },
  modalControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    marginTop: 22,
    width: '100%',
  },
  modalSecondaryBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalPlayPauseBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#0D9488',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalStopBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: '#F8FAFC',
  },
  modalStopBtnText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
  },

  // A+ Track: Academic Resilience Styles
  academicTrackCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#CCFBF1',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  academicHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  academicTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  academicIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  academicCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F766E',
    letterSpacing: -0.2,
  },
  academicCardSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  academicStatusBadge: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  academicStatusBadgeText: {
    color: '#0D9488',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pacingRhythmBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    borderLeftColor: '#0D9488',
    padding: 14,
    marginBottom: 14,
  },
  pacingRhythmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  pacingRhythmLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D9488',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  pacingRhythmMain: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  pacingGuidanceText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  pacingIntervalsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  pacingIntervalPill: {
    flex: 1,
    backgroundColor: '#F0FDFA',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    alignItems: 'center',
  },
  pacingIntervalBreak: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  intervalNum: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0D9488',
  },
  intervalNumBreak: {
    color: '#475569',
  },
  intervalLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  preExamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0D9488',
    paddingVertical: 14,
    borderRadius: 14,
    elevation: 3,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  preExamBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Box Breathing Modal Styles
  boxModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  boxModalContainer: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  boxModalHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  boxModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  boxModalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  boxPulseArea: {
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12,
  },
  boxPulseRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#CCFBF1',
    borderWidth: 2,
    borderColor: '#0D9488',
  },
  boxCenterCircle: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: '#0D9488',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  boxPhaseText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  boxPhaseCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CCFBF1',
    marginTop: 4,
  },
  boxInstructionWrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  boxPhaseInstruction: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
    marginBottom: 10,
  },
  boxCountdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  boxCountdownText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F766E',
  },
  boxActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  boxFinishBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFinishBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  boxCloseBtn: {
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxCloseBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  viewRoadToAplusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    gap: 8,
    marginTop: 10,
  },
  viewRoadToAplusText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0D9488',
  },
  // Exam Crunch Mode Banner
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
});

export default RelaxScreen;