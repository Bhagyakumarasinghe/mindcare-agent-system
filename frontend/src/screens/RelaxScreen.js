import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wind, Timer, BookOpen, Headphones, Play } from 'lucide-react-native';

export default function RelaxScreen() {
  const exercises = [
    { title: "Breathing Exercise", desc: "Calm your mind with guided breathing", icon: <Wind color="#22C55E" />, bg: '#F0FDF4' },
    { title: "Focus Timer", desc: "Pomodoro technique for productivity", icon: <Timer color="#4F75FF" />, bg: '#EEF2FF' },
    { title: "Journaling", desc: "Write down your thoughts and feelings", icon: <BookOpen color="#A855F7" />, bg: '#FAF5FF' },
    { title: "Quick Meditation", desc: "5-minute mindfulness session", icon: <Headphones color="#F59E0B" />, bg: '#FFFBEB' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Stress Relief</Text>
        <Text style={styles.subtitle}>Take a moment to relax and recharge</Text>

        {exercises.map((item, index) => (
          <TouchableOpacity key={index} style={styles.exerciseCard}>
            <View style={[styles.iconBox, { backgroundColor: item.bg }]}>
              {item.icon}
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDesc}>{item.desc}</Text>
            </View>
            <View style={styles.playCircle}>
              <Play size={14} color="#CBD5E1" fill="#CBD5E1" />
            </View>
          </TouchableOpacity>
        ))}

        {/* Daily Tip Card */}
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>💡 Daily Tip</Text>
          <Text style={styles.tipText}>
            Taking just 5 minutes for mindful breathing can significantly reduce stress and improve focus throughout your day.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 20, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: '800', color: '#1F2937' },
  subtitle: { fontSize: 14, color: '#64748B', marginBottom: 25 },
  exerciseCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 20, marginBottom: 15, elevation: 2 },
  iconBox: { width: 50, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1, marginLeft: 15 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  cardDesc: { fontSize: 12, color: '#64748B', marginTop: 2 },
  playCircle: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  tipCard: { marginTop: 10, padding: 20, borderRadius: 20, backgroundColor: '#6366F1' },
  tipTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', marginBottom: 8 },
  tipText: { fontSize: 14, color: '#E0E7FF', lineHeight: 20 }
});