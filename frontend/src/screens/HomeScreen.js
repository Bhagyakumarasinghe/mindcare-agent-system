import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getUserProfile, getUserAnalytics } from '../api/authService';

export default function HomeScreen({ navigation }) {
  const [userName, setUserName] = useState('User');
  const [analytics, setAnalytics] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Screen එක focus වන සෑම විටම දත්ත අලුත් කරයි
  useFocusEffect(
    useCallback(() => {
      fetchUserData();
      fetchAnalyticsData();
    }, [])
  );

  const fetchUserData = async () => {
    try {
      const response = await getUserProfile(); 
      if (response && response.status === 200) {
        const fullName = response.data.name; 
        const firstName = fullName ? fullName.split(' ')[0] : 'User';
        setUserName(firstName); 
      }
    } catch (error) {
      // Quietly log status without throwing unhandled UI errors
      if (error.response && error.response.status === 401) {
        console.log("ℹ️ User Profile: Guest or session expired.");
      } else {
        console.error("Error fetching user profile on Home:", error.message || error);
      }
    }
  };

  const fetchAnalyticsData = async () => {
    try {
      const response = await getUserAnalytics();
      if (response && response.data && response.data.data) {
        setAnalytics(response.data.data);
      }
    } catch (error) {
      // Handle 401 silently to prevent Red Box error popup on app home
      if (error.response && error.response.status === 401) {
        console.log("ℹ️ Analytics: User unauthenticated. Showing default view.");
        setAnalytics(null);
      } else {
        console.error("Error fetching analytics on Home:", error.message || error);
      }
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * History (Assessments) සහ recent_mood_logs දෙකම එකතු කර 
   * සතියේ දවස් වල සාමාන්‍ය ආතති අගය (Average Stress Level) ගණනය කිරීම.
   */
  const getDynamicTrend = () => {
    const weeklyMap = [
      { day: "Mon", val: 0, count: 0 }, { day: "Tue", val: 0, count: 0 },
      { day: "Wed", val: 0, count: 0 }, { day: "Thu", val: 0, count: 0 },
      { day: "Fri", val: 0, count: 0 }, { day: "Sat", val: 0, count: 0 },
      { day: "Sun", val: 0, count: 0 }
    ];

    // 1. Assessment History එකතු කිරීම
    if (analytics?.history && analytics.history.length > 0) {
      analytics.history.forEach(entry => {
        if (entry.date && entry.score !== undefined) {
          const cleanDate = entry.date.split('.')[0].replace('Z', '');
          const dateObj = new Date(cleanDate);
          
          if (!isNaN(dateObj.getTime())) {
            let dayIdx = dateObj.getDay(); 
            let adjustedIdx = dayIdx === 0 ? 6 : dayIdx - 1; 

            const safeScore = entry.score > 10 ? 10 : entry.score;
            weeklyMap[adjustedIdx].val += safeScore;
            weeklyMap[adjustedIdx].count += 1;
          }
        }
      });
    }

    // 2. Daily Mood Logs වල Stress අගයන් එකතු කිරීම
    if (analytics?.recent_mood_logs && analytics.recent_mood_logs.length > 0) {
      analytics.recent_mood_logs.forEach(entry => {
        if (entry.date && entry.stress !== undefined) {
          const cleanDate = entry.date.split('.')[0].replace('Z', '');
          const dateObj = new Date(cleanDate);
          
          if (!isNaN(dateObj.getTime())) {
            let dayIdx = dateObj.getDay(); 
            let adjustedIdx = dayIdx === 0 ? 6 : dayIdx - 1; 

            const safeStress = entry.stress > 10 ? 10 : entry.stress;
            weeklyMap[adjustedIdx].val += safeStress;
            weeklyMap[adjustedIdx].count += 1;
          }
        }
      });
    }

    // දත්ත කිසිවක් නොමැති නම් default අවම උසක් (8px) ලබා දීම
    const hasData = weeklyMap.some(item => item.count > 0);
    if (!hasData) {
      return weeklyMap.map(d => ({ day: d.day, val: 8 })); 
    }

    return weeklyMap.map(item => {
      const avgScoreForDay = item.count > 0 ? (item.val / item.count) : 0;
      return {
        day: item.day,
        // Chart එකේ උස 140px සීමාවට ගැලපෙන සේ අගය සකස් කිරීම
        val: avgScoreForDay > 0 ? avgScoreForDay * 13 : 8 
      };
    });
  };

  const getStatusLabel = (avgScore) => {
    if (avgScore === undefined || avgScore === null) return "No Data";
    if (avgScore > 7) return "High Stress";
    if (avgScore > 4) return "Moderate";
    return "Good";
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserData();
    fetchAnalyticsData();
  };

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
        <View style={[
          styles.statusCard, 
          { backgroundColor: !analytics ? '#94A3B8' : (analytics?.avg_stress > 7 ? '#F87171' : (analytics?.avg_stress > 4 ? '#FB923C' : '#4ADE80')) }
        ]}>
          <View>
            <Text style={styles.statusLabel}>Mental Health Status</Text>
            <Text style={styles.statusValue}>{getStatusLabel(analytics?.avg_stress)}</Text>
          </View>
          <View style={styles.warningIconBg}>
            <Text style={{fontSize: 20}}>{!analytics ? '📊' : (analytics?.avg_stress > 4 ? '⚠️' : '✅')}</Text>
          </View>
        </View>

        {/* AI Agent Chat Card */}
        <TouchableOpacity style={styles.agentCard} onPress={() => navigation.navigate('Chat')}>
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
            <TouchableOpacity onPress={() => navigation.navigate('Analytics')}>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.barChartContainer}>
            {getDynamicTrend().map((item, index) => (
              <View key={index} style={styles.barWrapper}>
                <View style={[
                  styles.barInner, 
                  { 
                    height: item.val, 
                    backgroundColor: item.val > 91 ? '#818CF8' : '#C7D2FE',
                    opacity: item.val <= 8 ? 0.3 : 1 
                  }
                ]} />
                <Text style={styles.barDayText}>{item.day}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Access Grid */}
        <Text style={styles.gridHeader}>Quick Access</Text>
        <View style={styles.grid}>
          <QuickAccessCard icon="🌿" title="Mood Tracking" desc="Log your emotions" color="#F0FDF4" onPress={() => navigation.navigate('MoodTracking')} />
          <QuickAccessCard icon="🌬️" title="Stress Relief" desc="Breathing & relaxation" color="#F0F9FF" onPress={() => navigation.navigate('Relax')} />
          <QuickAccessCard icon="📊" title="Analytics" desc="View reports" color="#F5F3FF" onPress={() => navigation.navigate('Analytics')} />
          <QuickAccessCard icon="❓" title="Assessment" desc="Take a quick test" color="#FFFBEB" onPress={() => navigation.navigate('Assessment')} />
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
  scrollContent: { padding: 25, paddingBottom: 100 },
  header: { marginBottom: 25 },
  welcomeText: { fontSize: 28, fontWeight: 'bold', color: '#1F2937' },
  subText: { fontSize: 16, color: '#6B7280', marginTop: 4 },
  statusCard: { padding: 20, borderRadius: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, elevation: 2 },
  statusLabel: { color: '#FFF', fontSize: 14, opacity: 0.9 },
  statusValue: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginTop: 5 },
  warningIconBg: { backgroundColor: 'rgba(255, 255, 255, 0.3)', padding: 10, borderRadius: 15 },
  agentCard: { backgroundColor: '#818CF8', padding: 20, borderRadius: 24, flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  agentIconBg: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 12, borderRadius: 15, marginRight: 15 },
  agentTextContent: { flex: 1 },
  agentTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  agentDesc: { color: '#E0E7FF', fontSize: 13, marginTop: 4 },
  chatBubbleIcon: { color: '#FFF', fontSize: 20, opacity: 0.8 },
  graphCard: { 
    backgroundColor: '#FFF', 
    padding: 20, 
    borderRadius: 25, 
    elevation: 1, 
    marginBottom: 25,
    minHeight: 230 
  },
  graphHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#1F2937' },
  viewAll: { color: '#6366F1', fontSize: 14, fontWeight: 'bold' },
  barChartContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    alignItems: 'flex-end', 
    height: 140, 
    marginTop: 10 
  },
  barWrapper: { alignItems: 'center' },
  barInner: { width: 14, borderRadius: 7 }, 
  barDayText: { fontSize: 10, color: '#94A3B8', marginTop: 8, fontWeight: '600' },
  gridHeader: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', marginBottom: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  qCard: { width: '48%', padding: 20, borderRadius: 20, marginBottom: 15 },
  qIconBg: { marginBottom: 12 },
  qTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  qDesc: { fontSize: 11, color: '#6B7280', marginTop: 4 }
});