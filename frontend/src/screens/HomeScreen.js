import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native'; // මෙය අලුතින් එක් කළා
import { getUserProfile } from '../api/authService';

export default function HomeScreen({ navigation }) {
  const [userName, setUserName] = useState('User');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const weeklyTrend = [
    { day: "Mon", val: 40 }, { day: "Tue", val: 65 }, { day: "Wed", val: 50 },
    { day: "Thu", val: 80 }, { day: "Fri", val: 95 }, { day: "Sat", val: 60 }, { day: "Sun", val: 45 }
  ];

  /**
   * useFocusEffect භාවිතා කිරීමෙන් වෙනත් Screen එකක සිට 
   * මෙම Screen එකට පැමිණෙන සෑම විටම fetchUserData() ක්‍රියාත්මක වේ.
   */
  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [])
  );

  const fetchUserData = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        const response = await getUserProfile(token);
        if (response.status === 200) {
          const fullName = response.data.name; 
          // සම්පූර්ණ නමෙන් මුල් නම පමණක් වෙන් කර ගැනීම
          const firstName = fullName ? fullName.split(' ')[0] : 'User';
          setUserName(firstName); 
        }
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserData();
  };

  const handleNavigation = (screenName) => {
    navigation.navigate(screenName);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
      >
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Hi, {userName} 👋</Text>
          <Text style={styles.subText}>How are you feeling today?</Text>
        </View>

        {/* Mental Health Status Card */}
        <View style={styles.statusCard}>
          <View>
            <Text style={styles.statusLabel}>Mental Health Status</Text>
            <Text style={styles.statusValue}>Moderate</Text>
          </View>
          <View style={styles.warningIconBg}>
            <Text style={{fontSize: 20}}>⚠️</Text>
          </View>
        </View>

        {/* AI Agent Chat Card */}
        <TouchableOpacity style={styles.agentCard} onPress={() => handleNavigation('Chat')}>
          <View style={styles.agentIconBg}>
            <Text style={{fontSize: 24}}>🤖</Text>
          </View>
          <View style={styles.agentTextContent}>
            <Text style={styles.agentTitle}>Start Agent Chat</Text>
            <Text style={styles.agentDesc}>AI-powered mental health support available 24/7</Text>
          </View>
          <Text style={styles.chatBubbleIcon}>💬</Text>
        </TouchableOpacity>

        {/* Stress Graph Card */}
        <View style={styles.graphCard}>
          <View style={styles.graphHeader}>
            <Text style={styles.sectionTitle}>Weekly Stress Overview</Text>
            <TouchableOpacity onPress={() => handleNavigation('Analytics')}>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.barChartContainer}>
            {weeklyTrend.map((item, index) => (
              <View key={index} style={styles.barWrapper}>
                <View style={[
                  styles.barInner, 
                  { height: item.val, backgroundColor: item.val > 75 ? '#818CF8' : '#C7D2FE' }
                ]} />
                <Text style={styles.barDayText}>{item.day}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Access Grid */}
        <Text style={styles.gridHeader}>Quick Access</Text>
        <View style={styles.grid}>
          <QuickAccessCard icon="🌿" title="Mood Tracking" desc="Log your emotions" color="#F0FDF4" onPress={() => handleNavigation('MoodTracking')} />
          <QuickAccessCard icon="🌬️" title="Stress Relief" desc="Breathing & relaxation" color="#F0F9FF" onPress={() => handleNavigation('Relax')} />
          <QuickAccessCard icon="📊" title="Analytics" desc="View reports" color="#F5F3FF" onPress={() => handleNavigation('Analytics')} />
          <QuickAccessCard icon="❓" title="Assessment" desc="Take a quick test" color="#FFFBEB" onPress={() => handleNavigation('Assessment')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const QuickAccessCard = ({ icon, title, desc, color, onPress }) => (
  <TouchableOpacity style={[styles.qCard, { backgroundColor: color }]} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.qIconBg}><Text style={{fontSize: 20}}>{icon}</Text></View>
    <Text style={styles.qTitle}>{title}</Text>
    <Text style={styles.qDesc}>{desc}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 25, paddingBottom: 100 },
  header: { marginBottom: 25 },
  welcomeText: { fontSize: 28, fontWeight: 'bold', color: '#1F2937' },
  subText: { fontSize: 16, color: '#6B7280', marginTop: 4 },
  statusCard: { backgroundColor: '#4ADE80', padding: 20, borderRadius: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, elevation: 2 },
  statusLabel: { color: '#FFF', fontSize: 14, opacity: 0.9 },
  statusValue: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginTop: 5 },
  warningIconBg: { backgroundColor: 'rgba(255, 255, 255, 0.3)', padding: 10, borderRadius: 15 },
  agentCard: { backgroundColor: '#818CF8', padding: 20, borderRadius: 24, flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  agentIconBg: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 12, borderRadius: 15, marginRight: 15 },
  agentTextContent: { flex: 1 },
  agentTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  agentDesc: { color: '#E0E7FF', fontSize: 13, marginTop: 4 },
  chatBubbleIcon: { color: '#FFF', fontSize: 20, opacity: 0.8 },
  graphCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 25, elevation: 1, marginBottom: 25 },
  graphHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#1F2937' },
  viewAll: { color: '#6366F1', fontSize: 14, fontWeight: 'bold' },
  barChartContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 110, marginTop: 10 },
  barWrapper: { alignItems: 'center' },
  barInner: { width: 12, borderRadius: 6 },
  barDayText: { fontSize: 10, color: '#94A3B8', marginTop: 8, fontWeight: '600' },
  gridHeader: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', marginBottom: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  qCard: { width: '48%', padding: 20, borderRadius: 20, marginBottom: 15 },
  qIconBg: { marginBottom: 12 },
  qTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  qDesc: { fontSize: 11, color: '#6B7280', marginTop: 4 }
});