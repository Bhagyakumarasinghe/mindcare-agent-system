import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wind, Clock, BookOpen, Headphones, PlayCircle, Lightbulb } from 'lucide-react-native';

const RelaxScreen = ({ navigation }) => {

  const options = [
    { 
      id: '1', 
      title: 'Breathing Exercise', 
      desc: 'Calm your mind with guided breathing', 
      icon: <Wind size={24} color="#4ADE80" />, 
      bgColor: '#F0FDF4',
      route: 'BreathingExercise' // Navigator එකේ නමට සමාන විය යුතුයි
    },
    { 
      id: '2', 
      title: 'Focus Timer', 
      desc: 'Pomodoro technique for productivity', 
      icon: <Clock size={24} color="#60A5FA" />, 
      bgColor: '#EFF6FF',
      route: 'FocusTimer'
    },
    { 
      id: '3', 
      title: 'Journaling', 
      desc: 'Write down your thoughts and feelings', 
      icon: <BookOpen size={24} color="#C084FC" />, 
      bgColor: '#F5F3FF',
      route: 'Journaling'
    },
    { 
      id: '4', 
      title: 'Quick Meditation', 
      desc: '5-minute mindfulness session', 
      icon: <Headphones size={24} color="#FBBF24" />, 
      bgColor: '#FFFBEB',
      route: 'Meditation'
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Stress Relief</Text>
          <Text style={styles.subtitle}>Take a moment to relax and recharge</Text>
        </View>

        <View style={styles.listContainer}>
          {options.map((item) => (
            <TouchableOpacity 
              key={item.id} 
              style={styles.card}
              onPress={() => navigation.navigate(item.route)} // මෙතනින් තමයි අදාළ screen එකට යන්නේ
            >
              <View style={[styles.iconBg, { backgroundColor: item.bgColor }]}>
                {item.icon}
              </View>
              <View style={styles.textContent}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDesc}>{item.desc}</Text>
              </View>
              <PlayCircle size={28} color="#E2E8F0" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.tipCard}>
          <View style={styles.tipHeader}>
            <Lightbulb size={18} color="#FBBF24" fill="#FBBF24" />
            <Text style={styles.tipTitle}>Daily Tip</Text>
          </View>
          <Text style={styles.tipText}>
            Taking just 5 minutes for mindful breathing can significantly reduce stress and improve focus throughout your day.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Styles කලින් දුන් විදිහටම භාවිතා කරන්න...
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 25, paddingBottom: 100 },
  header: { marginBottom: 25 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1E293B' },
  subtitle: { fontSize: 15, color: '#64748B', marginTop: 5 },
  listContainer: { gap: 15 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9', elevation: 2 },
  iconBg: { width: 50, height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  textContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  cardDesc: { fontSize: 12, color: '#64748B', marginTop: 2 },
  tipCard: { backgroundColor: '#A5B4FC', padding: 20, borderRadius: 24, marginTop: 30 },
  tipHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  tipTitle: { color: '#FFFFFF', fontWeight: 'bold', marginLeft: 8 },
  tipText: { color: '#FFFFFF', fontSize: 14, lineHeight: 22, opacity: 0.9 }
});

export default RelaxScreen;