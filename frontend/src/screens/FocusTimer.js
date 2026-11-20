import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput,
  ScrollView, 
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Play, Pause, RotateCcw, Target, Clock, Plus } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logActivity } from '../api/authService';

// Focus Duration Presets
const FOCUS_PRESETS = [
  { id: '15m', label: '15m Quick', minutes: 15 },
  { id: '25m', label: '25m Pomodoro', minutes: 25 },
  { id: '45m', label: '45m Deep Study', minutes: 45 },
];

// Default Study Goal Intentions
const DEFAULT_STUDY_GOALS = [
  'Coding / Thesis',
  'Exam Revision',
  'Assignment',
  'Research / Reading',
];

const STORAGE_KEY_CUSTOM_GOALS = '@mindcare_custom_focus_goals';

const FocusTimer = ({ navigation, route }) => {
  const initialMins = Number(route?.params?.initialMinutes) || 25;
  const [selectedMinutes, setSelectedMinutes] = useState(initialMins);
  const [secondsLeft, setSecondsLeft] = useState(initialMins * 60);
  const [isActive, setIsActive] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState('Coding / Thesis');
  const [customGoal, setCustomGoal] = useState('');
  const [savedCustomGoals, setSavedCustomGoals] = useState([]);

  const timeSpentRef = useRef(0);

  // Load persisted custom goal chips from AsyncStorage on mount
  useEffect(() => {
    const loadSavedGoals = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY_CUSTOM_GOALS);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSavedCustomGoals(parsed);
          }
        }
      } catch (e) {
        console.log('Error loading custom goals:', e);
      }
    };
    loadSavedGoals();
  }, []);

  // Sync route param changes
  useEffect(() => {
    if (route?.params?.initialMinutes) {
      const mins = Number(route.params.initialMinutes);
      if (!isNaN(mins) && mins > 0) {
        setSelectedMinutes(mins);
        setSecondsLeft(mins * 60);
        setIsActive(false);
        timeSpentRef.current = 0;
      }
    }
  }, [route?.params?.initialMinutes]);

  // Live active goal title: typed custom goal immediately overrides preset chip
  const activeGoal = customGoal.trim() || selectedGoal;

  // Add custom goal to persistent list and select it
  const handleAddCustomGoal = async () => {
    const trimmed = customGoal.trim();
    if (!trimmed) return;

    const allExisting = [...DEFAULT_STUDY_GOALS, ...savedCustomGoals];
    const exists = allExisting.some((g) => g.toLowerCase() === trimmed.toLowerCase());

    if (!exists) {
      const updated = [...savedCustomGoals, trimmed];
      setSavedCustomGoals(updated);
      try {
        await AsyncStorage.setItem(STORAGE_KEY_CUSTOM_GOALS, JSON.stringify(updated));
      } catch (e) {
        console.log('Error saving custom goal to storage:', e);
      }
    }

    setSelectedGoal(trimmed);
    setCustomGoal('');
  };

  // Select a preset or saved custom chip (clears customGoal so the tapped chip is active)
  const handleSelectGoal = (goal) => {
    setSelectedGoal(goal);
    setCustomGoal('');
  };

  // Long-press to remove a user-added custom goal
  const handleRemoveCustomGoal = (goalToRemove) => {
    Alert.alert(
      'Remove Custom Goal',
      `Remove "${goalToRemove}" from your saved goal chips?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updated = savedCustomGoals.filter((g) => g !== goalToRemove);
            setSavedCustomGoals(updated);
            try {
              await AsyncStorage.setItem(STORAGE_KEY_CUSTOM_GOALS, JSON.stringify(updated));
            } catch (e) {
              console.log('Error removing custom goal from storage:', e);
            }
            if (selectedGoal === goalToRemove) {
              setSelectedGoal(DEFAULT_STUDY_GOALS[0]);
            }
          },
        },
      ]
    );
  };

  // Backend Activity Logging
  const logFocusActivity = async (secondsSpent) => {
    if (secondsSpent < 10) return;
    try {
      const userStr = await AsyncStorage.getItem('user');
      const parsedUser = userStr ? JSON.parse(userStr) : null;
      const userId = parsedUser?.id || 'demo_user';
      const durationMinutes = Math.max(1, Math.round(secondsSpent / 60));

      const activeGoalTitle = customGoal.trim() || selectedGoal;

      await logActivity({
        user_id: userId,
        activity_type: 'Study Timer',
        duration_minutes: durationMinutes,
        metadata: {
          study_goal: activeGoalTitle,
          seconds_spent: secondsSpent,
          configured_minutes: selectedMinutes,
        },
      });
      console.log('✅ Focus activity logged to backend successfully');
    } catch (error) {
      console.error('❌ Error logging focus session:', error?.message || error);
    }
  };

  // Timer Tick
  useEffect(() => {
    let interval = null;
    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((time) => time - 1);
        timeSpentRef.current += 1;
      }, 1000);
    } else if (secondsLeft === 0) {
      setIsActive(false);
      clearInterval(interval);
      
      logFocusActivity(timeSpentRef.current);
      
      const completedGoal = customGoal.trim() || selectedGoal;
      Alert.alert(
        "Focus Session Complete! 🎯", 
        `Outstanding work! You completed your ${selectedMinutes}-minute session on ${completedGoal}. Take an active 5-minute cognitive reset.`,
        [{ 
          text: "Done", 
          onPress: () => { 
            timeSpentRef.current = 0;
            setSecondsLeft(selectedMinutes * 60);
          } 
        }]
      );
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, secondsLeft, customGoal, selectedGoal, selectedMinutes]);

  const handleGoBack = async () => {
    setIsActive(false);
    await logFocusActivity(timeSpentRef.current);
    navigation?.goBack();
  };

  const handleReset = async () => {
    setIsActive(false);
    if (timeSpentRef.current > 0) {
      await logFocusActivity(timeSpentRef.current);
      timeSpentRef.current = 0;
    }
    setSecondsLeft(selectedMinutes * 60);
  };

  const handleSelectPreset = (minutes) => {
    setIsActive(false);
    setSelectedMinutes(minutes);
    setSecondsLeft(minutes * 60);
    timeSpentRef.current = 0;
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Circular progress calculations
  const totalSeconds = selectedMinutes * 60;
  const elapsed = totalSeconds - secondsLeft;
  const progressRatio = totalSeconds > 0 ? Math.min(1, elapsed / totalSeconds) : 0;
  const circleRadius = 88;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (circumference * progressRatio);

  return (
    <View style={styles.container}>
      {/* Ambient Translucent Mint-Teal and Soft Sky-Blue Circles (HomeScreen aesthetic) */}
      <View pointerEvents="none" style={styles.ambientOrbTop} />
      <View pointerEvents="none" style={styles.ambientOrbMiddle} />
      <View pointerEvents="none" style={styles.ambientOrbBottom} />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backBtn} activeOpacity={0.8}>
            <ArrowLeft color="#0D9488" size={20} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Focus Session</Text>
            <Text style={styles.headerSubtitle}>Cognitive Pacing & Sustained Attention</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
        >
          {/* Duration Presets Row */}
          <View style={styles.presetRow}>
            {FOCUS_PRESETS.map((preset) => {
              const isSelected = selectedMinutes === preset.minutes;
              return (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.presetPill,
                    isSelected && styles.presetPillActive,
                  ]}
                  onPress={() => handleSelectPreset(preset.minutes)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.presetPillText,
                      isSelected && styles.presetPillTextActive,
                    ]}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Circular Timer Ring */}
          <View style={styles.timerWrapper}>
            <Svg width={230} height={230} viewBox="0 0 230 230">
              <Circle
                cx="115"
                cy="115"
                r={circleRadius}
                stroke="#E2E8F0"
                strokeWidth={strokeWidth}
                fill="none"
              />
              <Circle
                cx="115"
                cy="115"
                r={circleRadius}
                stroke="#0D9488"
                strokeWidth={strokeWidth}
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
                transform="rotate(-90 115 115)"
              />
            </Svg>

            <View style={styles.timerInnerContent}>
              <View style={styles.activeGoalBadge}>
                <Text style={styles.activeGoalBadgeText} numberOfLines={1}>
                  {activeGoal}
                </Text>
              </View>
              <Text style={styles.timerText}>{formatTime(secondsLeft)}</Text>
              <Text style={styles.sessionStatusText}>
                {isActive ? "Deep Focus Mode" : "Ready to Concentrate"}
              </Text>
            </View>
          </View>

          {/* Controls Row */}
          <View style={styles.controlsRow}>
            <TouchableOpacity 
              style={styles.secondaryControlBtn} 
              onPress={handleReset}
              activeOpacity={0.8}
            >
              <RotateCcw color="#0F766E" size={20} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.primaryPlayBtn} 
              onPress={() => setIsActive(!isActive)}
              activeOpacity={0.85}
            >
              {isActive ? (
                <Pause color="#FFFFFF" size={30} fill="#FFFFFF" />
              ) : (
                <Play color="#FFFFFF" size={30} fill="#FFFFFF" style={{ marginLeft: 3 }} />
              )}
            </TouchableOpacity>
          </View>

          {/* Study Goal Intention Selector (Frosted White Glass Card) */}
          <View style={styles.frostedCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardIconBox}>
                <Target size={16} color="#0D9488" />
              </View>
              <Text style={styles.cardTitle}>Study Goal / Intention</Text>
            </View>

            {/* Chips Row: Default + Saved Custom Chips */}
            <View style={styles.goalChipsContainer}>
              {[...DEFAULT_STUDY_GOALS, ...savedCustomGoals].map((goal) => {
                const isCustom = savedCustomGoals.includes(goal);
                const isSelected = !customGoal.trim() && selectedGoal === goal;
                return (
                  <TouchableOpacity
                    key={goal}
                    style={[
                      styles.goalChip,
                      isSelected && styles.goalChipActive,
                      isCustom && styles.customGoalChip,
                    ]}
                    onPress={() => handleSelectGoal(goal)}
                    onLongPress={isCustom ? () => handleRemoveCustomGoal(goal) : undefined}
                    delayLongPress={400}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.goalChipText,
                        isSelected && styles.goalChipTextActive,
                      ]}
                    >
                      {goal}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Goal Input Row with + Add Button */}
            <View style={styles.customGoalInputRow}>
              <TextInput
                style={styles.customGoalInput}
                placeholder="Or type a custom goal..."
                placeholderTextColor="#94A3B8"
                value={customGoal}
                onChangeText={setCustomGoal}
                onSubmitEditing={handleAddCustomGoal}
                returnKeyType="done"
                maxLength={60}
              />
              <TouchableOpacity
                style={[
                  styles.addGoalBtn,
                  !customGoal.trim() && styles.addGoalBtnDisabled,
                ]}
                onPress={handleAddCustomGoal}
                disabled={!customGoal.trim()}
                activeOpacity={0.8}
              >
                <Plus size={14} color="#FFFFFF" style={{ marginRight: 3 }} />
                <Text style={styles.addGoalBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Clinical Cognitive Guidance Card */}
          <View style={styles.guidanceCard}>
            <View style={styles.guidanceHeaderRow}>
              <Text style={styles.guidanceTitle}>Cognitive Stamina Insight</Text>
            </View>
            <Text style={styles.guidanceText}>
              Sustained 25-minute intervals synchronize with the brain's ultradian rhythm, preventing dopamine depletion and sustaining deep working memory.
            </Text>
          </View>
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

  // Ambient Circles
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

  // Header
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

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    alignItems: 'center',
  },

  // Presets
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  presetPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  presetPillActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
    shadowColor: '#0D9488',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  presetPillText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
  },
  presetPillTextActive: {
    color: '#FFFFFF',
  },

  // Timer Wrapper
  timerWrapper: {
    width: 230,
    height: 230,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  timerInnerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  activeGoalBadge: {
    backgroundColor: 'rgba(240, 253, 250, 0.95)',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 6,
    maxWidth: 160,
  },
  activeGoalBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D9488',
    textAlign: 'center',
  },
  timerText: {
    fontSize: 38,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  sessionStatusText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },

  // Controls Row
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    marginVertical: 16,
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
  primaryPlayBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },

  // Frosted White Glass Card
  frostedCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  goalChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  goalChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  goalChipActive: {
    backgroundColor: '#CCFBF1',
    borderColor: '#0D9488',
  },
  goalChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  goalChipTextActive: {
    color: '#0D9488',
    fontWeight: '700',
  },
  customGoalChip: {
    borderColor: '#99F6E4',
  },
  customGoalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  customGoalInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1E293B',
  },
  addGoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D9488',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  addGoalBtnDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.6,
    elevation: 0,
  },
  addGoalBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // Guidance Card
  guidanceCard: {
    width: '100%',
    backgroundColor: 'rgba(240, 253, 250, 0.85)',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#99F6E4',
    padding: 14,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  guidanceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  guidanceTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0D9488',
  },
  guidanceText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
});

export default FocusTimer;
