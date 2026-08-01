import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Play, Pause, RotateCcw } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FocusTimer = ({ navigation }) => {
  const INITIAL_TIME = 25 * 60; // 25 Minutes
  const [secondsLeft, setSecondsLeft] = useState(INITIAL_TIME);
  const [isActive, setIsActive] = useState(false);
  const timeSpentRef = useRef(0); // Track actual focus time in seconds

  // ---------------------------------------------------------
  // 🔗 BACKEND INTEGRATION: Log Focus Session
  // ---------------------------------------------------------
  const logFocusActivity = async (secondsSpent) => {
    // තත්පර 10කට අඩුවෙන් Focus කළොත් Log නොකිරීමට
    if (secondsSpent < 10) return;

    try {
      const token = await AsyncStorage.getItem('userToken');
      const durationMinutes = Math.max(1, Math.round(secondsSpent / 60));

      const response = await fetch('http://10.152.23.156:8000/user/log-activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          activity_type: 'Focus Session',
          duration_minutes: durationMinutes,
          timestamp: new Date().toISOString()
        })
      });

      const data = await response.json();
      if (response.ok) {
        console.log('✅ Focus activity logged to backend successfully:', data);
      } else {
        console.log('❌ Backend log failed:', data);
      }
    } catch (error) {
      console.error('❌ Network Error while logging focus session:', error);
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
    <SafeAreaView style={[styles.container, { backgroundColor: '#EFF6FF' }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
          <ArrowLeft color="#1E293B" size={24} />
        </TouchableOpacity>
        <Text style={styles.mainTitle}>Focus Session</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Timer Circle */}
      <View style={styles.timerCircle}>
        <Text style={styles.timerText}>{formatTime(secondsLeft)}</Text>
        <Text style={styles.subtitle}>
          {isActive ? "Stay Focused!" : "Ready to Concentrate?"}
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity 
          style={styles.controlBtn} 
          onPress={() => setIsActive(!isActive)}
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
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5
  },
  mainTitle: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#1E293B' 
  },
  timerCircle: { 
    width: 240, 
    height: 240, 
    borderRadius: 120, 
    borderWidth: 8, 
    borderColor: '#3B82F6', 
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', 
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#3B82F6',
    shadowOpacity: 0.2,
    shadowRadius: 10
  },
  timerText: { 
    fontSize: 48, 
    fontWeight: 'bold', 
    color: '#1E293B' 
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8
  },
  controls: { 
    flexDirection: 'row', 
    gap: 20,
    marginBottom: 40 
  },
  controlBtn: { 
    backgroundColor: '#3B82F6', 
    width: 64, 
    height: 64, 
    borderRadius: 32, 
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 3 
  }
});

export default FocusTimer;