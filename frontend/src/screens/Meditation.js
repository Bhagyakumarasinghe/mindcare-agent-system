import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, Headphones } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Meditation = ({ navigation }) => {
  const TOTAL_DURATION = 5 * 60; // 5 Minutes (300 Seconds)
  const [isPlaying, setIsPlaying] = useState(false);
  const [secondsSpent, setSecondsSpent] = useState(0);
  const timeSpentRef = useRef(0);

  // ---------------------------------------------------------
  // 🔗 BACKEND INTEGRATION: Log Meditation Activity
  // ---------------------------------------------------------
  const logMeditationActivity = async (duration) => {
    if (duration < 10) return; // තත්පර 10කට වඩා අඩුවෙන් කළොත් Log නොකිරීමට

    try {
      const token = await AsyncStorage.getItem('userToken');
      const durationMinutes = Math.max(1, Math.round(duration / 60));

      const response = await fetch('http://10.152.23.156:8000/user/log-activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          activity_type: 'Quick Meditation',
          duration_minutes: durationMinutes,
          timestamp: new Date().toISOString()
        })
      });

      const data = await response.json();
      if (response.ok) {
        console.log('✅ Meditation logged to backend successfully:', data);
      } else {
        console.log('❌ Backend log failed:', data);
      }
    } catch (error) {
      console.error('❌ Network Error while logging meditation:', error);
    }
  };

  // Timer Tick Logic
  useEffect(() => {
    let interval = null;

    if (isPlaying && secondsSpent < TOTAL_DURATION) {
      interval = setInterval(() => {
        setSecondsSpent((prev) => {
          const next = prev + 1;
          timeSpentRef.current = next;
          return next;
        });
      }, 1000);
    } else if (secondsSpent >= TOTAL_DURATION) {
      setIsPlaying(false);
      clearInterval(interval);

      // Auto Log on Completion
      logMeditationActivity(timeSpentRef.current);

      Alert.alert(
        "Session Completed! 🧘✨", 
        "Great job taking time for your mental well-being.",
        [{ text: "OK", onPress: () => { setSecondsSpent(0); timeSpentRef.current = 0; } }]
      );
    } else {
      clearInterval(interval);
    }

    return () => clearInterval(interval);
  }, [isPlaying, secondsSpent]);

  // Handle Manual Back
  const handleGoBack = async () => {
    setIsPlaying(false);
    await logMeditationActivity(timeSpentRef.current);
    navigation?.goBack();
  };

  // Skip Forward (+15s) & Backward (-15s)
  const handleSkipForward = () => {
    setSecondsSpent((prev) => Math.min(TOTAL_DURATION, prev + 15));
  };

  const handleSkipBack = () => {
    setSecondsSpent((prev) => Math.max(0, prev - 15));
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Dynamic Progress Width Percentage
  const progressPercent = `${(secondsSpent / TOTAL_DURATION) * 100}%`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFFBEB' }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
          <ArrowLeft color="#1E293B" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Guided Meditation</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Artwork */}
      <View style={styles.artworkContainer}>
        <View style={styles.artWork}>
          <Headphones size={80} color="#F59E0B" />
        </View>
      </View>

      {/* Title */}
      <Text style={styles.medTitle}>Mindful Peace</Text>
      <Text style={styles.medAuthor}>5 Minute Guided Session</Text>

      {/* Dynamic Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: progressPercent }]} />
        </View>
        <View style={styles.timeInfo}>
          <Text style={styles.timeText}>{formatTime(secondsSpent)}</Text>
          <Text style={styles.timeText}>{formatTime(TOTAL_DURATION)}</Text>
        </View>
      </View>

      {/* Player Controls */}
      <View style={styles.playerControls}>
        <TouchableOpacity onPress={handleSkipBack}>
          <SkipBack size={32} color="#1E293B" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.mainPlayBtn} 
          onPress={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? (
            <Pause size={35} color="#FFF" fill="#FFF" />
          ) : (
            <Play size={35} color="#FFF" fill="#FFF" style={{ marginLeft: 4 }} />
          )}
        </TouchableOpacity>
        
        <TouchableOpacity onPress={handleSkipForward}>
          <SkipForward size={32} color="#1E293B" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    paddingHorizontal: 25, 
    paddingVertical: 20, 
    alignItems: 'center', 
    justifyContent: 'space-between' 
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
  headerTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#1E293B' 
  },
  artworkContainer: { 
    marginTop: 20, 
    marginBottom: 20 
  },
  artWork: { 
    width: 220, 
    height: 220, 
    backgroundColor: '#FEF3C7', 
    borderRadius: 40, 
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 4,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.15,
    shadowRadius: 10
  },
  medTitle: { 
    fontSize: 26, 
    fontWeight: 'bold', 
    color: '#1E293B' 
  },
  medAuthor: { 
    fontSize: 15, 
    color: '#B45309', 
    marginTop: 6 
  },
  progressContainer: { 
    width: '100%', 
    marginTop: 30 
  },
  progressBarBackground: { 
    height: 8, 
    backgroundColor: '#FDE68A', 
    borderRadius: 4, 
    width: '100%',
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4
  },
  timeInfo: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 8 
  },
  timeText: { 
    fontSize: 12, 
    fontWeight: '600',
    color: '#B45309' 
  },
  playerControls: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 40, 
    marginBottom: 30 
  },
  mainPlayBtn: { 
    backgroundColor: '#F59E0B', 
    width: 76, 
    height: 76, 
    borderRadius: 38, 
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 6,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.3,
    shadowRadius: 8
  }
});

export default Meditation;