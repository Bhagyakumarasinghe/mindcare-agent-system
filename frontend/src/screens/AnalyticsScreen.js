import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronRight, FileText } from 'lucide-react-native';
import { getUserAnalytics } from '../api/authService';

const AnalyticsScreen = ({ navigation }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Screen එකට පැමිණෙන සෑම අවස්ථාවකදීම දත්ත අලුත් කිරීම.
   */
  useFocusEffect(
    useCallback(() => {
      fetchAnalyticsData();
    }, [])
  );

  const fetchAnalyticsData = async () => {
    try {
      const response = await getUserAnalytics();
      if (response.data && response.data.data) {
        setAnalytics(response.data.data);
      }
    } catch (error) {
      console.error("Analytics Fetch Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalyticsData();
  };

  /**
   * History (Assessments) සහ recentMoods (Mood logs) යන දෙකම එකතු කර 
   * සතියේ දවස් වලට ගැලපෙන සේ map කිරීම.
   */
  const mapHistoryToWeeklyTrend = (history, recentMoods) => {
    const weeklyMap = [
      { day: "Mon", val: 0, count: 0 }, { day: "Tue", val: 0, count: 0 },
      { day: "Wed", val: 0, count: 0 }, { day: "Thu", val: 0, count: 0 },
      { day: "Fri", val: 0, count: 0 }, { day: "Sat", val: 0, count: 0 },
      { day: "Sun", val: 0, count: 0 }
    ];

    // 1. Assessment History එකතු කිරීම
    if (history && history.length > 0) {
      history.forEach(entry => {
        if (entry.date && entry.score !== undefined) {
          const cleanDate = entry.date.split('.')[0].replace('Z', '');
          const dateObj = new Date(cleanDate);
          
          if (!isNaN(dateObj.getTime())) {
            let dayIndex = dateObj.getDay(); 
            let adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1; 

            const safeScore = entry.score > 10 ? 10 : entry.score;
            weeklyMap[adjustedIndex].val += safeScore;
            weeklyMap[adjustedIndex].count += 1;
          }
        }
      });
    }

    // 2. Daily Mood Logs වල Stress අගයන් එකතු කිරීම
    if (recentMoods && recentMoods.length > 0) {
      recentMoods.forEach(entry => {
        if (entry.date && entry.stress !== undefined) {
          const cleanDate = entry.date.split('.')[0].replace('Z', '');
          const dateObj = new Date(cleanDate);
          
          if (!isNaN(dateObj.getTime())) {
            let dayIndex = dateObj.getDay(); 
            let adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1; 

            const safeStress = entry.stress > 10 ? 10 : entry.stress;
            weeklyMap[adjustedIndex].val += safeStress;
            weeklyMap[adjustedIndex].count += 1;
          }
        }
      });
    }

    // දත්ත කිසිවක් නොමැති නම් default අගයක් පෙන්වීම
    const hasData = weeklyMap.some(item => item.count > 0);
    if (!hasData) {
      return weeklyMap.map(d => ({ day: d.day, val: 10 })); 
    }

    return weeklyMap.map(item => {
      const avgScoreForDay = item.count > 0 ? (item.val / item.count) : 0;
      return {
        day: item.day,
        // Chart එකේ උපරිම උස 120px වන සේ සකස් කිරීම
        val: avgScoreForDay > 0 ? avgScoreForDay * 12 : 10 
      };
    });
  };

  const dynamicWeeklyTrend = mapHistoryToWeeklyTrend(analytics?.history, analytics?.recent_mood_logs);

  const getMoodEmoji = (mood) => {
    const lowerMood = mood?.toLowerCase() || '';
    if (lowerMood.includes('happy') || lowerMood.includes('good') || lowerMood.includes('සතුටු')) return '😊';
    if (lowerMood.includes('sad') || lowerMood.includes('දුක')) return '😢';
    if (lowerMood.includes('angry') || lowerMood.includes('තරහ')) return '😠';
    if (lowerMood.includes('stressed') || lowerMood.includes('ආතතිය')) return '😰';
    return '😐'; 
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
      >
        
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Analytics</Text>
          <Text style={styles.headerSubtitle}>Your mental health insights</Text>
        </View>

        {/* Stats Summary Cards */}
        <View style={styles.statsRow}>
          <View style={styles.card}>
            <View style={styles.iconCircle}><Text style={{fontSize: 18}}>📉</Text></View>
            <Text style={styles.cardLabel}>Avg. Stress</Text>
            <Text style={styles.cardValue}>{analytics?.avg_stress || '0'}/10</Text>
            <Text style={[styles.cardSubText, { color: analytics?.avg_stress > 7 ? '#F87171' : '#22C55E' }]}>
              {analytics?.avg_stress > 7 ? 'High' : 'Normal'}
            </Text>
          </View>
          <View style={styles.card}>
            <View style={[styles.iconCircle, {backgroundColor: '#EEF2FF'}]}><Text style={{fontSize: 18}}>📅</Text></View>
            <Text style={styles.cardLabel}>Total Checks</Text>
            <Text style={styles.cardValue}>{analytics?.total_assessments || '0'}</Text>
            <Text style={[styles.cardSubText, {color: '#6366F1'}]}>Assessment history</Text>
          </View>
        </View>

        {/* Weekly Stress Trend Chart */}
        <View style={styles.whiteCard}>
          <Text style={styles.cardTitle}>Weekly Stress Trend</Text>
          <View style={styles.chartContainer}>
            {dynamicWeeklyTrend.map((item, index) => (
              <View key={index} style={styles.chartBarWrapper}>
                <View style={[
                  styles.chartBar, 
                  { 
                    height: item.val, 
                    backgroundColor: item.val > 84 ? '#818CF8' : '#C7D2FE', 
                    opacity: item.val <= 10 ? 0.3 : 1
                  }
                ]} />
                <Text style={styles.chartDayText}>{item.day}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent Mood Logs Section */}
        <View style={styles.moodSectionContainer}>
          <Text style={styles.sectionTitle}>Recent Mood History</Text>
          {analytics?.recent_mood_logs && analytics.recent_mood_logs.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moodScrollContainer}>
              {analytics.recent_mood_logs.map((log, idx) => (
                <View key={idx} style={styles.moodCard}>
                  <View style={styles.moodHeaderRow}>
                    <Text style={styles.moodEmoji}>{getMoodEmoji(log.mood)}</Text>
                    <View style={[styles.moodStressTag, { backgroundColor: log.stress > 7 ? '#FEE2E2' : '#DCFCE7' }]}>
                      <Text style={[styles.moodStressTagText, { color: log.stress > 7 ? '#EF4444' : '#22C55E' }]}>
                        Stress: {log.stress}/10
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.moodNameText} numberOfLines={1}>{log.mood}</Text>
                  <Text style={styles.moodDateText}>
                    {log.date ? new Date(log.date.split('.')[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyMoodCard}>
              <Text style={styles.emptyMoodText}>මෑතකදී ඇතුළත් කළ Mood logs කිසිවක් නොමැත.</Text>
            </View>
          )}
        </View>

        {/* Insight Card */}
        <View style={styles.insightCard}>
          <View style={styles.insightIconCircle}><Text style={{fontSize: 18}}>💡</Text></View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.insightTitle}>MindCare Insight</Text>
            <Text style={styles.insightDescription}>
              {analytics?.summary || "ප්‍රමාණවත් දත්ත පද්ධතිය තුළ නොමැත."}
            </Text>
          </View>
        </View>

        {/* Progress Card */}
        <View style={[styles.progressCard, { backgroundColor: analytics?.avg_stress > 7 ? '#F87171' : '#4ADE80' }]}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
              <View>
                <Text style={styles.progressLabel}>Status</Text>
                <Text style={styles.progressValue}>{analytics?.avg_stress > 7 ? 'Needs Care' : 'Doing Well'}</Text>
              </View>
              <View style={styles.progressIcon}><Text style={{fontSize: 20}}>📊</Text></View>
          </View>
          <Text style={styles.progressDescription}>
            Stress levels are tracked relative to your recent AI check-ins. Improvement: {analytics?.monthly_progress || '0%'}
          </Text>
        </View>

        {/* Report Link */}
        <TouchableOpacity style={styles.reportRedirectCard} onPress={() => navigation.navigate('WeeklyReport')}>
          <View style={styles.reportIconCircle}><FileText color="#6366F1" size={20} /></View>
          <View style={{ flex: 1, marginLeft: 15 }}>
            <Text style={styles.reportRedirectTitle}>View Full Report</Text>
            <Text style={styles.reportRedirectSub}>Detailed AI analysis of your mental state</Text>
          </View>
          <ChevronRight color="#CBD5E1" size={20} />
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContainer: { padding: 20, paddingBottom: 100 },
  header: { marginBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#1E293B' },
  headerSubtitle: { fontSize: 14, color: '#64748B' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  card: { backgroundColor: '#FFF', padding: 15, borderRadius: 20, width: '48%', elevation: 2 },
  iconCircle: { width: 35, height: 35, borderRadius: 10, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  cardLabel: { fontSize: 12, color: '#94A3B8', fontWeight: 'bold' },
  cardValue: { fontSize: 22, fontWeight: 'bold', color: '#1E293B' },
  cardSubText: { fontSize: 10, fontWeight: '700' },
  whiteCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 25, marginBottom: 15, elevation: 1 },
  cardTitle: { fontWeight: 'bold', fontSize: 16, color: '#1E293B' },
  chartContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 120, marginTop: 10 },
  chartBarWrapper: { alignItems: 'center' },
  chartBar: { width: 14, borderRadius: 7 },
  chartDayText: { fontSize: 10, color: '#94A3B8', marginTop: 8, fontWeight: 'bold' },
  
  moodSectionContainer: { marginBottom: 20 },
  sectionTitle: { fontWeight: 'bold', fontSize: 16, color: '#1E293B', marginBottom: 10 },
  moodScrollContainer: { paddingRight: 20 },
  moodCard: { backgroundColor: '#FFF', width: 140, padding: 12, borderRadius: 20, marginRight: 12, elevation: 1, borderWidth: 1, borderColor: '#F1F5F9' },
  moodHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  moodEmoji: { fontSize: 22 },
  moodStressTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  moodStressTagText: { fontSize: 9, fontWeight: 'bold' },
  moodNameText: { fontSize: 14, fontWeight: 'bold', color: '#334155' },
  moodDateText: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  emptyMoodCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1' },
  emptyMoodText: { fontSize: 12, color: '#64748B' },

  insightCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 20, flexDirection: 'row', marginBottom: 15, elevation: 1 },
  insightIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center' },
  insightTitle: { fontWeight: 'bold', fontSize: 15 },
  insightDescription: { fontSize: 12, color: '#64748B', marginTop: 4 },
  progressCard: { padding: 20, borderRadius: 25, marginBottom: 15 },
  progressLabel: { color: '#FFF', fontSize: 14 },
  progressValue: { color: '#FFF', fontSize: 32, fontWeight: 'bold' },
  progressIcon: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 12 },
  progressDescription: { color: '#FFF', fontSize: 12, marginTop: 10, opacity: 0.9 },
  reportRedirectCard: { backgroundColor: '#FFF', padding: 18, borderRadius: 25, flexDirection: 'row', alignItems: 'center', marginBottom: 15, elevation: 1 },
  reportIconCircle: { width: 45, height: 45, borderRadius: 15, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  reportRedirectTitle: { fontWeight: 'bold', fontSize: 16, color: '#1E293B' },
  reportRedirectSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
});

export default AnalyticsScreen;