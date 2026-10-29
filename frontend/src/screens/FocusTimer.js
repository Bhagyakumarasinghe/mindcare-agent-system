import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Play, Pause, RotateCcw } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logActivity } from '../api/authService';

const FocusTimer = ({ navigation, route }) => {
  const initialMinutes = Number(route?.params?.initialMinutes) || 25;
  const INITIAL_TIME = initialMinutes * 60;
  const [secondsLeft, setSecondsLeft] = useState(INITIAL_TIME);
  const [isActive, setIsActive] = useState(false);
  const timeSpentRef = useRef(0); // Track actual focus time in seconds

  useEffect(() => {
    if (route?.params?.initialMinutes) {
      const mins = Number(route.params.initialMinutes);
      if (!isNaN(mins) && mins > 0) {
        setSecondsLeft(mins * 60);
        setIsActive(false);
      }
    }
  }, [route?.params?.initialMinutes]);

  // ---------------------------------------------------------
  // 🔗 BACKEND INTEGRATION: Log Focus Session
  // ---------------------------------------------------------
  const logFocusActivity = async (secondsSpent) => {
    // Avoid logging if focused session is under 10 seconds
    if (secondsSpent < 10) return;

    try {
      const userStr = await AsyncStorage.getItem('user');
      const parsedUser = userStr ? JSON.parse(userStr) : null;
      const userId = parsedUser?.id || 'demo_user';
      const durationMinutes = Math.max(1, Math.round(secondsSpent / 60));

      await logActivity({
        user_id: userId,
        activity_type: 'Study Timer',
        duration_minutes: durationMinutes,
        metadata: {
          seconds_spent: secondsSpent,
          configured_minutes: initialMinutes,
        },
      });
      console.log('✅ Focus activity logged to backend successfully');
    } catch (error) {
      console.error('❌ Error logging focus session:', error.message || error);
    }
  };

  // Timer Tick & Completion Logic
  useEffect(() => {
    let interval = null;
    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((time) => time - 1);
        timeSpentRef.current += 1; // Increment total spent time
      }, 1000);
    } else if (secondsLeft === 0) {
      setIsActive(false);
      clearInterval(interval);
      
      // Auto Log to Backend on completion
      logFocusActivity(timeSpentRef.current);
      
      Alert.alert(
        "Time's Up! 🎯", 
        "Great job staying focused. Take a short break!",
        [{ text: "OK", onPress: () => { timeSpentRef.current = 0; } }]
      );
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, secondsLeft]);

  // Handle Manual Back Navigation
  const handleGoBack = async () => {
    setIsActive(false);
    await logFocusActivity(timeSpentRef.current);
    navigation?.goBack();
  };

  // Reset Timer
  const handleReset = async () => {
    setIsActive(false);
    if (timeSpentRef.current > 0) {
      await logFocusActivity(timeSpentRef.current);
      timeSpentRef.current = 0;
    }
    setSecondsLeft(INITIAL_TIME);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#F0FDFA' }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
          <ArrowLeft color="#0F172A" size={24} />
        </TouchableOpacity>
        <Text style={styles.mainTitle}>Focus Session</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Timer Circle */}
      <View style={styles.timerCircle}>
        <Text style={styles.timerText}>{formatTime(secondsLeft)}</Text>
        <Text style={styles.subtitle}>
          {isActive ? "Stay Focused" : "Ready to Concentrate?"}
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity 
          style={styles.controlBtn} 
          onPress={() => setIsActive(!isActive)}
          activeOpacity={0.85}
        >
          {isActive ? (
            <Pause color="#FFF" size={28} />
          ) : (
            <Play color="#FFF" size={28} fill="#FFF" />
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.controlBtn, { backgroundColor: '#94A3B8' }]} 
          onPress={handleReset}
          activeOpacity={0.85}
        >
          <RotateCcw color="#FFF" size={24} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingVertical: 25, 
    paddingHorizontal: 20 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10
  },
  backBtn: { 
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    borderWidth: 1,
    borderColor: '#CCFBF1'
  },
  mainTitle: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: '#0F172A',
    letterSpacing: -0.3
  },
  timerCircle: { 
    width: 250, 
    height: 250, 
    borderRadius: 125, 
    borderWidth: 8, 
    borderColor: '#0D9488', 
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', 
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#0D9488',
    shadowOpacity: 0.18,
    shadowRadius: 14
  },
  timerText: { 
    fontSize: 50, 
    fontWeight: '800', 
    color: '#0D9488',
    letterSpacing: -1
  },
  subtitle: {
    fontSize: 14,
    color: '#0F766E',
    fontWeight: '600',
    marginTop: 8
  },
  controls: { 
    flexDirection: 'row', 
    gap: 20,
    marginBottom: 40 
  },
  controlBtn: { 
    backgroundColor: '#0D9488', 
    width: 64, 
    height: 64, 
    borderRadius: 32, 
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 3,
    shadowColor: '#0D9488',
    shadowOpacity: 0.25,
    shadowRadius: 8
  }
});

export default FocusTimer;