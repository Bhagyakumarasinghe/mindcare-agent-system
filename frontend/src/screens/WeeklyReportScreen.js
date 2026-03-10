import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ArrowLeft, 
  Download, 
  AlertCircle, 
  TrendingDown 
} from 'lucide-react-native';

const WeeklyReportScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      {/* 1. Header Section */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft color="#1E293B" size={24} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportBtn}>
          <Download color="#4F75FF" size={20} />
          <Text style={styles.exportText}>Export</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.reportTitle}>Weekly Mental Health Report</Text>
          <Text style={styles.dateRange}>Feb 8 - Feb 15, 2026</Text>
        </View>

        {/* 2. Overview Section */}
        <View style={styles.whiteCard}>
          <Text style={styles.sectionHeader}>Overview</Text>
          <View style={styles.row}>
            <View style={[styles.statBox, { backgroundColor: '#F8FAFC' }]}>
              <Text style={styles.statLabel}>Avg. Stress Score</Text>
              <Text style={styles.statValue}>5.4</Text>
              <Text style={styles.statSub}>out of 10</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: '#F8FAFC' }]}>
              <Text style={styles.statLabel}>Avg. Sleep</Text>
              <Text style={styles.statValue}>6.5</Text>
              <Text style={styles.statSub}>hours</Text>
            </View>
          </View>
        </View>

        {/* 3. Most Common Trigger */}
        <View style={styles.whiteCard}>
          <View style={styles.triggerHeader}>
            <View style={styles.alertCircle}>
              <AlertCircle color="#EF4444" size={18} />
            </View>
            <Text style={styles.triggerTitle}>Most Common Trigger</Text>
          </View>
          <Text style={styles.triggerMain}>Academic Pressure</Text>
          <Text style={styles.triggerDesc}>Appeared in 42% of your entries this week</Text>
        </View>

        {/* 4. Weekly Change Card */}
        <View style={styles.changeCard}>
          <View style={styles.changeIconContainer}>
            <TrendingDown color="#FFF" size={24} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.changeLabel}>This Week's Change</Text>
            <Text style={styles.changeValue}>-12%</Text>
            <Text style={styles.changeDesc}>Great progress! Your stress levels decreased compared to last week.</Text>
          </View>
        </View>

        {/* 5. Personalized Recommendations */}
        <View style={styles.recommendationHeader}>
           <Text style={{fontSize: 18}}>💡</Text>
           <Text style={styles.sectionTitleLabel}>Personalized Recommendations</Text>
        </View>

        <View style={styles.recItem}>
          <View style={[styles.recIcon, {backgroundColor: '#FFF7ED'}]}><Text style={{fontSize: 20}}>😴</Text></View>
          <View style={styles.recContent}>
            <Text style={styles.recTitle}>Improve Sleep Schedule</Text>
            <Text style={styles.recDesc}>Try to maintain consistent sleep times. Aim for 7-8 hours per night.</Text>
          </View>
        </View>

        <View style={styles.recItem}>
          <View style={[styles.recIcon, {backgroundColor: '#F0FDF4'}]}><Text style={{fontSize: 20}}>🧘</Text></View>
          <View style={styles.recContent}>
            <Text style={styles.recTitle}>Practice Mindfulness</Text>
            <Text style={styles.recDesc}>Daily 5-minute meditation can help reduce stress by up to 25%.</Text>
          </View>
        </View>

        {/* 6. Activity Summary */}
        <View style={styles.whiteCard}>
          <Text style={styles.sectionHeader}>Activity Summary</Text>
          <View style={styles.activityRow}>
            <Text style={styles.activityLabel}>Mood entries logged</Text>
            <Text style={styles.activityValue}>28</Text>
          </View>
          <View style={styles.activityRow}>
            <Text style={styles.activityLabel}>Chat sessions</Text>
            <Text style={styles.activityValue}>5</Text>
          </View>
          <View style={[styles.activityRow, {borderBottomWidth: 0}]}>
            <Text style={styles.activityLabel}>Assessments completed</Text>
            <Text style={styles.activityValue}>2</Text>
          </View>
        </View>

        {/* 7. Next Steps */}
        <View style={styles.nextStepsCard}>
          <Text style={styles.nextStepsTitle}>Next Steps for Better Wellbeing</Text>
          <View style={styles.stepRow}>
            <Text style={styles.stepNum}>1.</Text>
            <Text style={styles.stepText}>Continue daily mood tracking to identify patterns</Text>
          </View>
          <View style={styles.stepRow}>
            <Text style={styles.stepNum}>2.</Text>
            <Text style={styles.stepText}>Practice breathing exercises before stressful events</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { marginLeft: 8, fontSize: 16, color: '#64748B' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, elevation: 1 },
  exportText: { color: '#4F75FF', fontWeight: 'bold', marginLeft: 5 },
  scrollContent: { padding: 20, paddingBottom: 40 }, // පතුලේ ඉඩ ප්‍රමාණය සකස් කළා
  titleSection: { marginBottom: 25 },
  reportTitle: { fontSize: 24, fontWeight: 'bold', color: '#1E293B', marginBottom: 5 },
  dateRange: { color: '#94A3B8', fontSize: 16 },
  
  whiteCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 24, marginBottom: 15, elevation: 1 },
  sectionHeader: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginBottom: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { width: '48%', padding: 15, borderRadius: 18, alignItems: 'center' },
  statLabel: { color: '#64748B', fontSize: 12, textAlign: 'center', marginBottom: 8 },
  statValue: { fontSize: 28, fontWeight: 'bold', color: '#1E293B' },
  statSub: { color: '#94A3B8', fontSize: 11 },

  triggerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  alertCircle: { padding: 8, backgroundColor: '#FEF2F2', borderRadius: 12 },
  triggerTitle: { color: '#1E293B', fontWeight: 'bold', marginLeft: 12, fontSize: 15 },
  triggerMain: { fontSize: 22, fontWeight: 'bold', color: '#F87171', marginBottom: 4 },
  triggerDesc: { color: '#94A3B8', fontSize: 13 },

  changeCard: { backgroundColor: '#62C47E', padding: 20, borderRadius: 24, flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  changeIconContainer: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 12, borderRadius: 18, marginRight: 15 },
  changeLabel: { color: '#FFF', fontSize: 14, opacity: 0.9 },
  changeValue: { color: '#FFF', fontSize: 32, fontWeight: 'bold' },
  changeDesc: { color: '#FFF', fontSize: 12, marginTop: 4, lineHeight: 18 },

  recommendationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  sectionTitleLabel: { fontSize: 17, fontWeight: 'bold', color: '#1E293B', marginLeft: 10 },
  recItem: { backgroundColor: '#FFF', padding: 15, borderRadius: 20, flexDirection: 'row', marginBottom: 12, elevation: 1 },
  recIcon: { width: 45, height: 45, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  recContent: { flex: 1, marginLeft: 15 },
  recTitle: { fontSize: 15, fontWeight: 'bold', color: '#1E293B' },
  recDesc: { fontSize: 12, color: '#64748B', marginTop: 2, lineHeight: 18 },

  activityRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  activityLabel: { color: '#64748B', fontSize: 14 },
  activityValue: { fontWeight: 'bold', color: '#1E293B', fontSize: 15 },

  nextStepsCard: { backgroundColor: '#EEF2FF', padding: 22, borderRadius: 24 },
  nextStepsTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginBottom: 15 },
  stepRow: { flexDirection: 'row', marginBottom: 12 },
  stepNum: { color: '#4F75FF', fontWeight: 'bold', marginRight: 10 },
  stepText: { flex: 1, color: '#475569', fontSize: 13, lineHeight: 20 },
});

export default WeeklyReportScreen;