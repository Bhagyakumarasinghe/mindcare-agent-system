import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';

const BreathingExercise = ({ navigation }) => {
  const [status, setStatus] = useState('Inhale');
  const sizeAnim = new Animated.Value(1);

  useEffect(() => {
    const breathe = () => {
      setStatus('Inhale');
      Animated.timing(sizeAnim, { toValue: 1.5, duration: 4000, useNativeDriver: true }).start(() => {
        setStatus('Hold');
        setTimeout(() => {
          setStatus('Exhale');
          Animated.timing(sizeAnim, { toValue: 1, duration: 4000, useNativeDriver: true }).start(() => breathe());
        }, 2000);
      });
    };
    breathe();
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#F0FDF4' }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <ArrowLeft color="#1E293B" size={24} />
      </TouchableOpacity>
      
      <Text style={styles.mainTitle}>Guided Breathing</Text>
      
      <View style={styles.circleContainer}>
        <Animated.View style={[styles.breatheCircle, { transform: [{ scale: sizeAnim }] }]} />
        <Text style={styles.statusText}>{status}</Text>
      </View>
      
      <Text style={styles.instruction}>Focus on your breath. Relax your shoulders.</Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  backBtn: { position: 'absolute', top: 50, left: 20 },
  mainTitle: { fontSize: 24, fontWeight: 'bold', color: '#1E293B', marginBottom: 50 },
  circleContainer: { alignItems: 'center', justifyContent: 'center', height: 300, width: 300 },
  breatheCircle: { width: 150, height: 150, borderRadius: 75, backgroundColor: '#4ADE80', opacity: 0.5 },
  statusText: { position: 'absolute', fontSize: 24, fontWeight: 'bold', color: '#166534' },
  instruction: { fontSize: 16, color: '#64748B', textAlign: 'center', marginTop: 50 }
});

export default BreathingExercise;