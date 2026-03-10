import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Play, Pause, RotateCcw } from 'lucide-react-native';

const FocusTimer = ({ navigation }) => {
  const [timeLeft, setTimeLeft] = useState(1500); // 25 Minutes
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const resetTimer = () => {
    setTimeLeft(1500);
    setIsActive(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#EFF6FF' }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <ArrowLeft color="#1E293B" size={24} />
      </TouchableOpacity>

      <Text style={styles.mainTitle}>Focus Session</Text>

      <View style={styles.timerCircle}>
        <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.ctrlBtn} onPress={() => setIsActive(!isActive)}>
          {isActive ? <Pause color="#FFF" size={30} fill="#FFF" /> : <Play color="#FFF" size={30} fill="#FFF" />}
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.resetBtn} onPress={resetTimer}>
          <RotateCcw color="#60A5FA" size={24} />
          <Text style={styles.resetText}>Reset</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  backBtn: { position: 'absolute', top: 50, left: 20 },
  mainTitle: { fontSize: 24, fontWeight: 'bold', color: '#1E293B', marginBottom: 40 },
  timerCircle: { width: 250, height: 250, borderRadius: 125, borderWidth: 8, borderColor: '#60A5FA', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  timerText: { fontSize: 60, fontWeight: 'bold', color: '#1E293B' },
  controls: { marginTop: 50, alignItems: 'center' },
  ctrlBtn: { backgroundColor: '#60A5FA', width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 25 },
  resetText: { marginLeft: 8, color: '#60A5FA', fontWeight: 'bold' }
});

export default FocusTimer;