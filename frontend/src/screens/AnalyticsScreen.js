import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, FileText } from 'lucide-react-native'; // Icon එක සඳහා මෙය අවශ්‍ය වේ

const AnalyticsScreen = ({ navigation }) => {
  const weeklyTrend = [
    { day: "Mon", val: 40 }, { day: "Tue", val: 60 }, { day: "Wed", val: 50 },
    { day: "Thu", val: 70 }, { day: "Fri", val: 85 }, { day: "Sat", val: 55 }, { day: "Sun", val: 45 }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Analytics</Text>
          <Text style={styles.headerSubtitle}>Your mental health insights</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.card}>
            <View style={styles.iconCircle}><Text style={{fontSize: 18}}>📉</Text></View>
            <Text style={styles.cardLabel}>Avg. Stress</Text>
            <Text style={styles.cardValue}>5.4/10</Text>
            <Text style={styles.cardSubText}>↓ 12% this week</Text>
          </View>
          <View style={styles.card}>
            <View style={[styles.iconCircle, {backgroundColor: '#EEF2FF'}]}><Text style={{fontSize: 18}}>📅</Text></View>
            <Text style={styles.cardLabel}>Tracking Days</Text>
            <Text style={styles.cardValue}>28</Text>
            <Text style={[styles.cardSubText, {color: '#6366F1'}]}>Great streak!</Text>
          </View>
        </View>

        {/* Weekly Stress Trend Chart */}
        <View style={styles.whiteCard}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20}}>
            <Text style={styles.cardTitle}>Weekly Stress Trend</Text>
          </View>
          
          <View style={styles.chartContainer}>
            {weeklyTrend.map((item, index) => (
              <View key={index} style={styles.chartBarWrapper}>
                <View style={[styles.chartBar, { height: item.val, backgroundColor: item.val > 70 ? '#818CF8' : '#C7D2FE' }]} />
                <Text style={styles.chartDayText}>{item.day}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* View Weekly Report Card (අලුතින් එක් කළ කොටස) */}
        <TouchableOpacity 
          style={styles.reportRedirectCard} 
          onPress={() => navigation.navigate('WeeklyReport')}
        >
          <View style={styles.reportIconCircle}>
             <FileText color="#6366F1" size={20} />
          </View>
          <View style={{ flex: 1, marginLeft: 15 }}>
            <Text style={styles.reportRedirectTitle}>View Weekly Report</Text>
            <Text style={styles.reportRedirectSub}>Get detailed insights and recommendations</Text>
          </View>
          <ChevronRight color="#CBD5E1" size={20} />
        </TouchableOpacity>

        {/* Insight Card */}
        <View style={styles.insightCard}>
          <View style={styles.insightIconCircle}><Text style={{fontSize: 18}}>💡</Text></View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.insightTitle}>Sleep vs Stress Insight</Text>
            <Text style={styles.insightDescription}>
              Your data shows that getting 7+ hours of sleep correlates with 35% lower stress levels.
            </Text>
          </View>
        </View>

        {/* Progress Card */}
        <View style={styles.progressCard}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
              <View>
                <Text style={styles.progressLabel}>This Month's Progress</Text>
                <Text style={styles.progressValue}>-18%</Text>
              </View>
              <View style={styles.progressIcon}><Text style={{fontSize: 20}}>📉</Text></View>
          </View>
          <Text style={styles.progressDescription}>
            Great job! Your stress levels have decreased this month.
          </Text>
        </View>

        {/* Top Stress Factors */}
        <View style={styles.whiteCard}>
          <Text style={styles.cardTitle}>Top Stress Factors</Text>
          {[
            {label: 'Academic', val: '85%', color: '#C7D2FE'},
            {label: 'Social', val: '45%', color: '#E0E7FF'},
            {label: 'Workload', val: '60%', color: '#D1FAE5'}
          ].map((item, index) => (
            <View key={index} style={{marginTop: 15}}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5}}>
                <Text style={styles.factorLabel}>{item.label}</Text>
                <Text style={{fontSize: 12, color: '#94A3B8'}}>{item.val}</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, {width: item.val, backgroundColor: item.color}]} />
              </View>
            </View>
          ))}
        </View>

        {/* Pattern Detected Card */}
        <View style={[styles.whiteCard, {borderLeftWidth: 4, borderLeftColor: '#F87171'}]}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={{fontSize: 18}}>⚠️</Text>
            <Text style={[styles.cardTitle, {marginLeft: 8}]}>Pattern Detected</Text>
          </View>
          <Text style={styles.patternText}>
            Your stress levels tend to spike on Thursdays and Fridays. Consider scheduling relaxation activities.
          </Text>
          <TouchableOpacity style={{marginTop: 10}} onPress={() => navigation.navigate('Relax')}>
             <Text style={{color: '#6366F1', fontWeight: '600', fontSize: 13}}>Try Relaxation Exercises →</Text>
          </TouchableOpacity>
        </View>

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
  cardSubText: { fontSize: 10, color: '#22C55E', fontWeight: '700' },
  whiteCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 25, marginBottom: 15, elevation: 1 },
  cardTitle: { fontWeight: 'bold', fontSize: 16, color: '#1E293B' },
  chartContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 120, marginTop: 10 },
  chartBarWrapper: { alignItems: 'center' },
  chartBar: { width: 14, borderRadius: 7 },
  chartDayText: { fontSize: 10, color: '#94A3B8', marginTop: 8, fontWeight: 'bold' },
  insightCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 20, flexDirection: 'row', marginBottom: 15, elevation: 1 },
  insightIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center' },
  insightTitle: { fontWeight: 'bold', fontSize: 15 },
  insightDescription: { fontSize: 12, color: '#64748B', marginTop: 4 },
  progressCard: { backgroundColor: '#4ADE80', padding: 20, borderRadius: 25, marginBottom: 15 },
  progressLabel: { color: '#FFF', fontSize: 14 },
  progressValue: { color: '#FFF', fontSize: 32, fontWeight: 'bold' },
  progressIcon: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 12 },
  progressDescription: { color: '#FFF', fontSize: 12, marginTop: 10, opacity: 0.9 },
  factorLabel: { fontSize: 13, fontWeight: '600', color: '#475569' },
  progressBarBg: { height: 12, backgroundColor: '#F1F5F9', borderRadius: 6, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 6 },
  patternText: { fontSize: 13, color: '#64748B', marginTop: 10, lineHeight: 18 },
  
  // View Weekly Report Card Styles
  reportRedirectCard: { 
    backgroundColor: '#FFF', 
    padding: 18, 
    borderRadius: 25, 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 15, 
    elevation: 1 
  },
  reportIconCircle: { 
    width: 45, 
    height: 45, 
    borderRadius: 15, 
    backgroundColor: '#EEF2FF', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  reportRedirectTitle: { fontWeight: 'bold', fontSize: 16, color: '#1E293B' },
  reportRedirectSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
});

export default AnalyticsScreen;