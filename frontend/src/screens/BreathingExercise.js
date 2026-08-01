import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Play, Pause } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BreathingExercise = ({ navigation }) => {
  const [status, setStatus] = useState('Inhale');
  const [isActive, setIsActive] = useState(true);
  const [sessionTime, setSessionTime] = useState(0); // seconds

  const sizeAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.4)).current;
  const isMounted = useRef(true);

  // ---------------------------------------------------------
  // 🔗 BACKEND INTEGRATION: Log Activity Function
  // ---------------------------------------------------------
  const logActivityToBackend = async (secondsSpent) => {
    // තත්පර 10කට වඩා අඩුවෙන් කළොත් backend එකට save නොකර සිටීමට
    if (secondsSpent < 10) return; 

    try {
      const token = await AsyncStorage.getItem('userToken'); // Auth Token එක
      const durationMinutes = Math.max(1, Math.round(secondsSpent / 60)); // Minutes වලට හරවා ගැනීම

      const response = await fetch('http://10.152.23.156:8000/user/log-activity', { // Emulator සඳහා 10.0.2.2 (Real Device නම් IP එක)
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          activity_type: 'Breathing Exercise',
          duration_minutes: durationMinutes,
          timestamp: new Date().toISOString()
        })
      });

      const data = await response.json();
      if (response.ok) {
        console.log('✅ Activity logged to backend successfully:', data);
      } else {
        console.log('❌ Backend log failed:', data);
      }
    } catch (error) {
      console.error('❌ Network Error while logging activity:', error);
    }
  };

  // User Back එබූ විට activity එක save කර සාර්ථකව පිටවීම
  const handleGoBack = async () => {
    setIsActive(false);
    await logActivityToBackend(sessionTime);
    navigation?.goBack();
  };

  // Timer Counter
  useEffect(() => {
    let interval = null;
    if (isActive) {
      interval = setInterval(() => {
        setSessionTime((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  // Breathing Loop Animation
  useEffect(() => {
    isMounted.current = true;

    const breathe = () => {
      if (!isMounted.current || !isActive) return;

      setStatus('Inhale');
      Animated.parallel([
        Animated.timing(sizeAnim, { toValue: 1.6, duration: 4000, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0.8, duration: 4000, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (!finished || !isMounted.current) return;

        setStatus('Hold');
        setTimeout(() => {
          if (!isMounted.current) return;

          setStatus('Exhale');
          Animated.parallel([
            Animated.timing(sizeAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
            Animated.timing(opacityAnim, { toValue: 0.4, duration: 4000, useNativeDriver: true }),
          ]).start(({ finished }) => {
            if (finished && isMounted.current) {
              breathe();
            }
          });
        }, 2000);
      });
    };

    if (isActive) {
      breathe();
    }

    return () => {
      isMounted.current = false;
    };
  }, [isActive]);

  const toggleSession = () => {
    setIsActive(!isActive);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Navigation */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
          <ArrowLeft color="#1E293B" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Breathing Exercise</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Timer & Subtitle */}
      <View style={styles.titleContainer}>
        <Text style={styles.timerText}>{formatTime(sessionTime)}</Text>
        <Text style={styles.instruction}>
          {status === 'Inhale' && 'Deeply breathe in through your nose...'}
          {status === 'Hold' && 'Hold your breath gently...'}
          {status === 'Exhale' && 'Slowly release through your mouth...'}
        </Text>
      </View>

      {/* Visual Animation Circle */}
      <View style={styles.circleContainer}>
        <Animated.View
          style={[
            styles.outerCircle,
            {
              transform: [{ scale: sizeAnim }],
              opacity: opacityAnim,
            },
          ]}
        />
        <View style={styles.innerCircle}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>

      {/* Controller Buttons */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity style={styles.controlBtn} onPress={toggleSession}>
          {isActive ? <Pause color="#10B981" size={28} /> : <Play color="#10B981" size={28} />}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  backBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  titleContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  timerText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0D9488',
    marginBottom: 8,
  },
  instruction: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  circleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 300,
    width: 300,
  },
  outerCircle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#99F6E4',
  },
  innerCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#0D9488',
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  statusText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  controlBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default BreathingExercise;