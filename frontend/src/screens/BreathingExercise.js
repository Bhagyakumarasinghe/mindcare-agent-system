import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  TouchableOpacity, 
  ScrollView,
  Easing 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  RotateCcw, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  Sparkles 
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logActivity } from '../api/authService';

// 3 Evidence-Based Clinical Breathing Protocols
const BREATHING_PROTOCOLS = [
  {
    id: 'box',
    name: 'Box Breathing',
    timing: '4-4-4-4',
    badge: 'Exam & Viva Focus',
    description: 'Equal intervals of inhale, hold, exhale, and rest to regulate sympathetic nervous tone and sharpen working memory.',
    phases: [
      { name: 'Inhale', duration: 4, instruction: 'Breathe in slowly through your nose...' },
      { name: 'Hold', duration: 4, instruction: 'Hold breath calmly without straining...' },
      { name: 'Exhale', duration: 4, instruction: 'Smoothly release breath through your mouth...' },
      { name: 'Hold', duration: 4, instruction: 'Rest quietly before the next breath cycle...' },
    ],
    totalCycleSeconds: 16,
  },
  {
    id: '478',
    name: '4-7-8 Breath',
    timing: '4-7-8',
    badge: 'Deep Nervous Reset',
    description: 'Dr. Andrew Weil’s parasympathetic tranquilizer. A prolonged exhale dramatically slows racing heart rate and physical tension.',
    phases: [
      { name: 'Inhale', duration: 4, instruction: 'Inhale quietly through your nose...' },
      { name: 'Hold', duration: 7, instruction: 'Sustain breath calmly and comfortably...' },
      { name: 'Exhale', duration: 8, instruction: 'Slow, steady whoosh exhale through mouth...' },
    ],
    totalCycleSeconds: 19,
  },
  {
    id: 'calm_sigh',
    name: 'Calm Sigh',
    timing: '4-6',
    badge: 'Quick Tension Relief',
    description: 'Physiological sigh rhythm that rapidly dispels accumulated carbon dioxide and relieves immediate test anxiety.',
    phases: [
      { name: 'Inhale', duration: 4, instruction: 'Deep diaphragmatic inhale into your chest...' },
      { name: 'Exhale', duration: 6, instruction: 'Long, slow audible sigh releasing all tension...' },
    ],
    totalCycleSeconds: 10,
  },
];

const BreathingExercise = ({ navigation, route }) => {
  const isInstantMode = route?.params?.mode === 'instant_decompression';
  const targetDurationSeconds = isInstantMode ? ((route?.params?.durationMinutes || 2) * 60) : null;
  const initialProtocolId = route?.params?.protocolId || 'box';

  const [selectedProtocolId, setSelectedProtocolId] = useState(initialProtocolId);
  const [isActive, setIsActive] = useState(true);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  const activeProtocol = BREATHING_PROTOCOLS.find(p => p.id === selectedProtocolId) || BREATHING_PROTOCOLS[0];

  const sizeAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.35)).current;
  const timeSpentRef = useRef(0);
  timeSpentRef.current = sessionSeconds;

  // Derive Current Phase & Phase Countdown from Session Seconds
  const cycleElapsed = sessionSeconds % activeProtocol.totalCycleSeconds;
  const completedCycles = Math.floor(sessionSeconds / activeProtocol.totalCycleSeconds);

  let accumulated = 0;
  let currentPhase = activeProtocol.phases[0];
  let phaseSecondsLeft = currentPhase.duration;

  for (let i = 0; i < activeProtocol.phases.length; i++) {
    const p = activeProtocol.phases[i];
    if (cycleElapsed < accumulated + p.duration) {
      currentPhase = p;
      phaseSecondsLeft = (accumulated + p.duration) - cycleElapsed;
      break;
    }
    accumulated += p.duration;
  }

  // Animation handling matching phase changes
  useEffect(() => {
    if (!isActive || isCompleted) {
      sizeAnim.stopAnimation();
      opacityAnim.stopAnimation();
      return;
    }

    if (currentPhase.name === 'Inhale') {
      Animated.parallel([
        Animated.timing(sizeAnim, {
          toValue: 1.42,
          duration: currentPhase.duration * 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.85,
          duration: currentPhase.duration * 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (currentPhase.name === 'Exhale') {
      Animated.parallel([
        Animated.timing(sizeAnim, {
          toValue: 1.0,
          duration: currentPhase.duration * 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.35,
          duration: currentPhase.duration * 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [currentPhase.name, isActive, isCompleted]);

  // Session Seconds Tick
  useEffect(() => {
    let interval = null;
    if (isActive && !isCompleted) {
      interval = setInterval(() => {
        setSessionSeconds(prev => {
          const next = prev + 1;
          if (targetDurationSeconds && next >= targetDurationSeconds) {
            setIsActive(false);
            setIsCompleted(true);
            logActivityToBackend(targetDurationSeconds);
            return targetDurationSeconds;
          }
          return next;
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, isCompleted, targetDurationSeconds]);

  // Backend session logging
  const logActivityToBackend = async (secondsSpent) => {
    if (secondsSpent < 10) return;
    try {
      const userStr = await AsyncStorage.getItem('user');
      const parsedUser = userStr ? JSON.parse(userStr) : null;
      let userId = parsedUser?.id || parsedUser?.user_id;
      if (!userId) {
        const cached = await AsyncStorage.getItem('@mindcare_cached_profile');
        if (cached) {
          const cp = JSON.parse(cached);
          userId = cp?.id || cp?.user_id;
        }
      }
      userId = userId || 'demo_user';
      const durationMinutes = Math.max(1, Math.round(secondsSpent / 60));

      await logActivity({
        user_id: userId,
        activity_type: isInstantMode ? 'Instant Decompression Breathing' : 'Breathing Exercise',
        duration_minutes: durationMinutes,
        metadata: {
          protocol_name: activeProtocol.name,
          mode: isInstantMode ? 'instant_decompression' : 'standard',
          completed_cycles: completedCycles,
          seconds_spent: secondsSpent,
        },
      });
      console.log('✅ Breathing activity logged successfully to backend');
    } catch (error) {
      console.error('❌ Error logging breathing activity:', error?.message || error);
    }
  };

  const handleGoBack = async () => {
    setIsActive(false);
    if (!isCompleted) {
      await logActivityToBackend(timeSpentRef.current);
    }
    navigation?.goBack();
  };

  const handleReset = () => {
    setIsActive(false);
    setIsCompleted(false);
    setSessionSeconds(0);
    sizeAnim.setValue(1);
    opacityAnim.setValue(0.35);
  };

  const handleSelectProtocol = (protocolId) => {
    if (protocolId === selectedProtocolId) return;
    setSelectedProtocolId(protocolId);
    setSessionSeconds(0);
    sizeAnim.setValue(1);
    opacityAnim.setValue(0.35);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getPhaseInstruction = () => {
    if (isCompleted) {
      return 'Session complete • Calm autonomic tone restored';
    }
    if (currentPhase.name === 'Inhale') {
      return 'Breathe in slowly through your nose (4s)';
    }
    if (currentPhase.name === 'Exhale') {
      return 'Exhale slowly through your mouth (4s)';
    }
    return 'Hold gently (4s)';
  };

  return (
    <View style={styles.container}>
      {/* Ambient Translucent Mint-Teal and Soft Sky-Blue Circles (HomeScreen aesthetic) */}
      <View pointerEvents="none" style={styles.ambientOrbTop} />
      <View pointerEvents="none" style={styles.ambientOrbMiddle} />
      <View pointerEvents="none" style={styles.ambientOrbBottom} />

      <SafeAreaView style={styles.safeArea}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backBtn} activeOpacity={0.8}>
            <ArrowLeft color="#0D9488" size={20} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {isInstantMode ? 'Instant Decompression' : 'Breathing Exercise'}
            </Text>
            {isInstantMode ? (
              <View style={styles.preExamResetBadge}>
                <Clock size={11} color="#0D9488" style={{ marginRight: 4 }} />
                <Text style={styles.preExamResetBadgeText}>2-Minute Reset</Text>
              </View>
            ) : (
              <Text style={styles.headerSubtitle}>Autonomic Nervous Tone Regulation</Text>
            )}
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
        >
          {/* Protocol Selector Tabs or Instant Mode Pre-Exam Banner */}
          {isInstantMode ? (
            <View style={styles.instantModeBanner}>
              <View style={styles.instantModeBannerHeader}>
                <ShieldCheck size={14} color="#0D9488" style={{ marginRight: 6 }} />
                <Text style={styles.instantModeBannerTitle}>4-4-4-4 Box Breathing</Text>
                <View style={styles.instantModePill}>
                  <Text style={styles.instantModePillText}>2m Sprint</Text>
                </View>
              </View>
            </View>
          ) : (
            <>
              {/* Protocol Selector Tabs */}
              <View style={styles.protocolTabsContainer}>
                {BREATHING_PROTOCOLS.map((protocol) => {
                  const isSelected = protocol.id === selectedProtocolId;
                  return (
                    <TouchableOpacity
                      key={protocol.id}
                      style={[
                        styles.protocolTab,
                        isSelected && styles.protocolTabActive,
                      ]}
                      onPress={() => handleSelectProtocol(protocol.id)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.protocolTabName,
                          isSelected && styles.protocolTabNameActive,
                        ]}
                      >
                        {protocol.name}
                      </Text>
                      <Text
                        style={[
                          styles.protocolTabTiming,
                          isSelected && styles.protocolTabTimingActive,
                        ]}
                      >
                        {protocol.timing}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Active Protocol Pill Badge */}
              <View style={styles.badgeWrapper}>
                <View style={styles.activeBadge}>
                  <ShieldCheck size={13} color="#0D9488" style={{ marginRight: 5 }} />
                  <Text style={styles.activeBadgeText}>{activeProtocol.badge}</Text>
                </View>
              </View>
            </>
          )}

          {/* Breathing Circle Area */}
          <View style={styles.circleContainer}>
            <Animated.View
              style={[
                styles.outerPulseCircle,
                {
                  transform: [{ scale: isCompleted ? 1.0 : sizeAnim }],
                  opacity: isCompleted ? 0.35 : opacityAnim,
                },
              ]}
            />
            <View style={[styles.innerCenterCircle, isCompleted && styles.innerCenterCircleDone]}>
              {isCompleted ? (
                <>
                  <CheckCircle2 size={38} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.completedCircleText}>Centered</Text>
                </>
              ) : (
                <>
                  <Text style={styles.phaseNameText}>{currentPhase.name}</Text>
                  <Text style={styles.countdownNumberText}>{phaseSecondsLeft}s</Text>
                </>
              )}
            </View>
          </View>

          {/* Session Metrics Row */}
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>
                {isInstantMode ? 'TIME REMAINING' : 'ACTIVE TIME'}
              </Text>
              <Text style={styles.metricValue}>
                {isInstantMode 
                  ? formatTime(Math.max(0, (targetDurationSeconds || 120) - sessionSeconds))
                  : formatTime(sessionSeconds)}
              </Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>CYCLES COMPLETED</Text>
              <Text style={styles.metricValue}>#{completedCycles + (isCompleted ? 0 : 1)}</Text>
            </View>
          </View>

          {/* Completion State or Playback Controls */}
          {isCompleted ? (
            <View style={styles.completionContainer}>
              <View style={styles.completionHeaderRow}>
                <View style={styles.completionIconBadge}>
                  <Sparkles size={16} color="#0D9488" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.completionTitle}>Autonomic Tone Regulated 🧘</Text>
                  <Text style={styles.completionSubtitle}>
                    2-minute pre-exam decompression finished. Autonomic arousal lowered and mental focus restored.
                  </Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.returnToStressReliefBtn} 
                onPress={handleGoBack}
                activeOpacity={0.85}
              >
                <ArrowLeft size={16} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 8 }} />
                <Text style={styles.returnToStressReliefBtnText}>Return to Stress Relief</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.repeatResetBtn} 
                onPress={handleReset}
                activeOpacity={0.8}
              >
                <RotateCcw size={14} color="#0D9488" strokeWidth={2.2} style={{ marginRight: 6 }} />
                <Text style={styles.repeatResetBtnText}>Repeat 2-Min Reset</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.controlsRow}>
              <TouchableOpacity 
                style={styles.secondaryControlBtn} 
                onPress={handleReset} 
                activeOpacity={0.8}
              >
                <RotateCcw color="#0F766E" size={20} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.primaryControlBtn} 
                onPress={() => setIsActive(!isActive)}
                activeOpacity={0.85}
              >
                {isActive ? (
                  <Pause color="#FFFFFF" size={28} fill="#FFFFFF" />
                ) : (
                  <Play color="#FFFFFF" size={28} fill="#FFFFFF" style={{ marginLeft: 3 }} />
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Single-Line Bottom Cue Card (in instant mode) / Standard Guidance Card */}
          {isInstantMode ? (
            <View style={styles.singleLineCueCard}>
              <Text style={styles.singleLineCueText}>{getPhaseInstruction()}</Text>
            </View>
          ) : (
            <View style={styles.guidanceCard}>
              <View style={styles.guidanceHeaderRow}>
                <Text style={styles.guidanceCardTitle}>Pacing Guidance</Text>
              </View>
              <Text style={styles.guidanceInstruction}>
                {isCompleted ? 'Take a moment to notice your calm breathing and relaxed muscle tone.' : currentPhase.instruction}
              </Text>
              <Text style={styles.guidanceDescription}>{activeProtocol.description}</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF5F4',
  },
  safeArea: {
    flex: 1,
  },

  // Ambient Translucent Circles
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

  // Header Bar
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  preExamResetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 10,
    marginTop: 3,
  },
  preExamResetBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D9488',
    letterSpacing: 0.2,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    alignItems: 'center',
  },

  // Protocol Tabs
  protocolTabsContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
    marginBottom: 12,
  },
  protocolTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  protocolTabActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
    shadowColor: '#0D9488',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  protocolTabName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  protocolTabNameActive: {
    color: '#FFFFFF',
  },
  protocolTabTiming: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  protocolTabTimingActive: {
    color: '#CCFBF1',
  },

  // Active Badge
  badgeWrapper: {
    marginBottom: 8,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(240, 253, 250, 0.95)',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D9488',
    letterSpacing: 0.3,
  },

  // Circle Container
  circleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 250,
    width: 250,
    marginVertical: 10,
  },
  outerPulseCircle: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(45, 212, 191, 0.28)',
  },
  innerCenterCircle: {
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  phaseNameText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  countdownNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#CCFBF1',
    marginTop: 4,
  },

  // Metrics Row
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginBottom: 20,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  metricItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  metricLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0D9488',
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 26,
    backgroundColor: '#E2E8F0',
  },

  // Controls Row
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 20,
  },
  secondaryControlBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryControlBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },

  // Frosted Glass Guidance Card
  guidanceCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    padding: 18,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  guidanceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  guidanceIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  guidanceCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  guidanceInstruction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D9488',
    marginBottom: 6,
    lineHeight: 20,
  },
  guidanceDescription: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
  },

  // Instant Mode Banner
  instantModeBanner: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  instantModeBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  instantModeBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  instantModePill: {
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  instantModePillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0D9488',
  },

  // Single-Line Bottom Cue Card
  singleLineCueCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  singleLineCueText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0D9488',
    textAlign: 'center',
    letterSpacing: 0.1,
  },

  // Circle Completion
  innerCenterCircleDone: {
    backgroundColor: '#059669',
  },
  completedCircleText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
    letterSpacing: 0.3,
  },

  // Completion State Card
  completionContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    padding: 18,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  completionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    width: '100%',
  },
  completionIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  completionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  completionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16.5,
    marginTop: 2,
  },
  returnToStressReliefBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D9488',
    paddingVertical: 13,
    borderRadius: 16,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 10,
  },
  returnToStressReliefBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  repeatResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  repeatResetBtnText: {
    color: '#0D9488',
    fontSize: 12.5,
    fontWeight: '700',
  },
});

export default BreathingExercise;
