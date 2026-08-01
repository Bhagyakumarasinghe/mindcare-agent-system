import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ArrowLeft, 
  Download, 
  AlertCircle, 
  TrendingDown,
  TrendingUp 
} from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getUserAnalytics } from '../api/authService';

const WeeklyReportScreen = ({ navigation }) => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWeeklyReport();
  }, []);

  const fetchWeeklyReport = async () => {
    try {
      setLoading(true);
      const response = await getUserAnalytics();
      
      // DEBUG: Backend එකෙන් එන ඇත්තම දත්ත ව්‍යුහය බලාගැනීමට
      console.log("MindCare Backend API Response Data:", JSON.stringify(response?.data));

      if (response?.data?.data) {
        setReportData(response.data.data);
      } else if (response?.data) {
        setReportData(response.data);
      }
    } catch (error) {
      console.error("Error fetching weekly report:", error);
      Alert.alert("Error", "වාර්තා දත්ත ලබා ගැනීමට නොහැකි විය.");
    } finally {
      setLoading(false);
    }
  };

  // UI සහ PDF සඳහා පොදු ගතික විචල්‍යයන් Backend Keys සමඟ නිවැරදිව ගැලපීම
  const avgStress = reportData?.avg_stress ?? reportData?.average_stress ?? reportData?.mean_stress ?? 0;
  const avgSleep = reportData?.avg_sleep ?? reportData?.average_sleep ?? reportData?.sleep_hours ?? 0;
  const totalAssessments = reportData?.total_assessments ?? reportData?.assessments_count ?? 0;
  const moodLogs = reportData?.recent_mood_logs ?? reportData?.mood_logs ?? reportData?.logs ?? [];
  const userName = reportData?.user_name || reportData?.patient_name || "Kayo";
  const commonTrigger = reportData?.common_trigger || reportData?.primary_trigger || "N/A";
  const triggerPercentage = reportData?.trigger_percentage || (reportData?.trigger_rate ? `${reportData.trigger_rate}%` : "0%");
  const chatSessions = reportData?.chat_sessions ?? reportData?.ai_interactions ?? 0;
  
  const getFormattedDateRange = () => {
    if (reportData?.start_date && reportData?.end_date) {
      const start = reportData.start_date.split('T')[0];
      const end = reportData.end_date.split('T')[0];
      return `${start} - ${end}`;
    }
    return reportData?.date_range || new Date().toISOString().split('T')[0]; 
  };
  
  const dateRangeText = getFormattedDateRange();
  const progressText = reportData?.monthly_progress || reportData?.weekly_change || "0%";
  const isDecrease = progressText.includes('-') || (!progressText.includes('+') && parseFloat(progressText) <= 0);

  const dynamicRecommendations = reportData?.recommendations || [
    { title: "Maintain Routine", desc: "Log your mood daily to help the AI model generate more accurate trends.", icon: "📊" }
  ];

  // වෘත්තීය සායනික මට්ටමේ (Clinical-grade) PDF එකක් ජනනය කිරීමේ ශ්‍රිතය
  const handleExport = async () => {
    try {
      // Data Mapping සමඟ undefined/10 සහ දිගු ISO Dates නිවැරදි කිරීම
      const tableRows = moodLogs.length > 0 
        ? moodLogs.map(log => {
            const rawDate = log.date || log.created_at || log.timestamp || log.date_stamp;
            const formattedDate = rawDate ? rawDate.split('T')[0] : 'N/A';
            
            // Backend එකෙන් ලොග් එකේ ස්කෝ එක එන්න පුළුවන් සියලුම Keys පරීක්ෂාව (Table Bug එක විසඳීමට)
            const rawScore = log.stress_level ?? 
                             log.stress_score ?? 
                             log.mood_score ?? 
                             log.score ?? 
                             log.value ?? 
                             log.rating ?? 
                             log.stressRating ?? 
                             log.stress;
                             
            const finalScore = rawScore !== undefined && rawScore !== null ? rawScore : '-'; 
            const currentNote = log.note || log.notes || log.description || log.text || 'Recorded via MindCare Agent';
            
            return `
              <tr>
                <td>${formattedDate}</td>
                <td><strong style="color: #1E293B;">${finalScore}/10</strong></td>
                <td>${currentNote}</td>
              </tr>
            `;
          }).join('')
        : `
            <tr>
              <td colspan="3" style="text-align: center; color: #64748B;">No behavioral logs recorded for this active cycle.</td>
            </tr>
          `;

      // AI Recommendations ලැයිස්තුව HTML එකට පරිවර්තනය කිරීම
      const recsHtml = dynamicRecommendations.map(rec => `
        <div class="rec-card">
          <span class="rec-icon">${rec.icon || '💡'}</span>
          <div class="rec-body">
            <div class="rec-title">${rec.title}</div>
            <div class="rec-desc">${rec.desc}</div>
          </div>
        </div>
      `).join('');

      // PDF Engine එකට ගැලපෙන print-safe CSS මඟින් යාවත්කාලීන කළ HTML
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page {
                size: A4;
                margin: 15mm 12mm;
            }
            body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 0; margin: 0; color: #1E293B; background-color: #F8FAFC; line-height: 1.5; }
            
            /* Header Section */
            .header-container { text-align: center; margin-bottom: 25px; border-bottom: 3px solid #4F75FF; padding-bottom: 15px; }
            .main-title { color: #4F75FF; font-size: 24pt; font-weight: bold; margin-bottom: 4px; }
            .subtitle { color: #64748B; font-size: 10pt; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold; }
            
            /* Patient Profile Summary Card Layout */
            .info-card { background-color: #ffffff; border: 1px solid #E2E8F0; border-radius: 14px; padding: 20px; margin-bottom: 25px; display: table; width: 100%; box-sizing: border-box; }
            .info-col { display: table-cell; width: 33.33%; font-size: 11pt; color: #475569; vertical-align: middle; }
            .info-label { font-weight: bold; color: #64748B; text-transform: uppercase; font-size: 8pt; display: block; margin-bottom: 3px; letter-spacing: 0.5px; }
            .info-value { font-size: 13pt; font-weight: bold; color: #1E293B; }
            .highlight-score { color: #4F75FF; font-size: 16pt; font-weight: bold; }

            /* Section Labels */
            .section-title { font-size: 11pt; font-weight: bold; color: #0F172A; margin-top: 25px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.8px; display: block; border-bottom: 1px solid #E2E8F0; padding-bottom: 5px; }
            
            /* Print-safe Table layouts for Grid Elements */
            .grid { display: table; width: 100%; table-layout: fixed; margin-bottom: 15px; box-sizing: border-box; }
            .grid-col { display: table-cell; width: 50%; padding-right: 10px; box-sizing: border-box; }
            .grid-col:last-child { padding-right: 0; padding-left: 10px; }
            
            .metric-box { background: #ffffff; border: 1px solid #E2E8F0; border-radius: 12px; padding: 15px; min-height: 85px; box-sizing: border-box; }
            .metric-title { font-size: 9pt; font-weight: bold; color: #64748B; margin-bottom: 6px; text-transform: uppercase; }
            .metric-main { font-size: 16pt; font-weight: bold; }
            .metric-sub { font-size: 9pt; color: #94A3B8; margin-top: 2px; }
            
            /* Condition Trend Banner Alignment */
            .trend-alert { padding: 15px; border-radius: 12px; color: white; background-color: ${isDecrease ? '#22C55E' : '#EF4444'}; min-height: 85px; box-sizing: border-box; }
            .trend-title { font-size: 9pt; font-weight: bold; opacity: 0.9; text-transform: uppercase; }
            .trend-value { font-size: 18pt; font-weight: bold; margin: 2px 0; }
            .trend-desc { font-size: 9pt; opacity: 0.95; line-height: 1.4; }

            /* Data Tables Layout */
            table { width: 100%; border-collapse: collapse; margin-top: 5px; background: #ffffff; border-radius: 8px; overflow: hidden; }
            th { background-color: #1E293B; color: white; text-align: left; padding: 10px 12px; font-size: 10pt; text-transform: uppercase; }
            td { padding: 11px 12px; border-bottom: 1px solid #E2E8F0; font-size: 10pt; color: #334155; }
            tr:nth-child(even) { background-color: #F8FAFC; }

            /* Intervention Cards Stretch */
            .rec-card { background: #ffffff; border-left: 4px solid #4F75FF; border-top: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; border-bottom: 1px solid #E2E8F0; padding: 12px 15px; margin-bottom: 8px; border-radius: 0 8px 8px 0; display: table; width: 100%; box-sizing: border-box; }
            .rec-icon { display: table-cell; width: 30px; font-size: 14pt; vertical-align: top; }
            .rec-body { display: table-cell; vertical-align: top; padding-left: 5px; }
            .rec-title { font-weight: bold; font-size: 11pt; color: #1E293B; }
            .rec-desc { font-size: 10pt; color: #64748B; margin-top: 2px; }

            .footer { text-align: center; margin-top: 40px; font-size: 9pt; color: #94A3B8; border-top: 1px dashed #E2E8F0; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div class="main-title">MindCare Health Summary</div>
            <div class="subtitle">Professional Behavioral Analytics Report</div>
          </div>

          <!-- Clinical Profile Header -->
          <div class="info-card">
            <div class="info-col">
              <span class="info-label">Patient / Client</span>
              <span class="info-value">${userName}</span>
            </div>
            <div class="info-col">
              <span class="info-label">Diagnostic Period</span>
              <span class="info-value">${dateRangeText}</span>
            </div>
            <div class="info-col">
              <span class="info-label">Mean Stress Index</span>
              <span class="info-value highlight-score">${avgStress}/10</span>
            </div>
          </div>

          <!-- Section 1: Diagnostics -->
          <div class="section-title">Behavioral Diagnostics & Metrics</div>
          <div class="grid">
            <div class="grid-col">
              <div class="metric-box">
                <div class="metric-title">Primary Stress Vector (Trigger)</div>
                <div class="metric-main" style="color: #EF4444;">${commonTrigger}</div>
                <div class="metric-sub">Identified in ${triggerPercentage} of monitored entries this cycle.</div>
              </div>
            </div>
            <div class="grid-col">
              <div class="metric-box">
                <div class="metric-title">Sleep Architecture</div>
                <div class="metric-main" style="color: #0284C7;">${avgSleep} Hours</div>
                <div class="metric-sub">Average logged rest interval duration per 24 hours.</div>
              </div>
            </div>
          </div>

          <!-- Section 2: Trends and Summary -->
          <div class="grid" style="margin-top: 10px;">
            <div class="grid-col">
              <div class="trend-alert">
                <div class="trend-title">Variance From Baseline</div>
                <div class="trend-value">${progressText}</div>
                <div class="trend-desc">
                  ${isDecrease 
                    ? "Clinical parameters signify positive adaptation. Stress progression velocity has lessened compared to the baseline tracking." 
                    : "Clinical Notice: Elevated stress density detected. Implementation of designated cognitive regulation plans is advised."}
                </div>
              </div>
            </div>
            <div class="grid-col">
              <div class="metric-box">
                <div class="metric-title">Clinical Operational Data</div>
                <div style="font-size: 10pt; color: #475569; margin-top: 4px; line-height: 1.5;">
                  • Active Mood Logs: <strong>${moodLogs.length} entries</strong><br/>
                  • Finished Screenings: <strong>${totalAssessments} sessions</strong><br/>
                  • Logic Agent Interactions: <strong>${chatSessions} sessions</strong>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 3: Longitudinal History Table -->
          <div class="section-title">Longitudinal Observation Logs</div>
          <table>
            <thead>
              <tr>
                <th style="width: 25%">Date Stamp</th>
                <th style="width: 20%">Stress Rating</th>
                <th style="width: 55%">Clinical / Contextual Notes</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <!-- Section 4: Therapeutic Recommendations -->
          <div class="section-title">Personalized Therapeutic Protocols (AI Insights)</div>
          ${recsHtml}

          <!-- Section 5: Strategic Next Steps -->
          <div class="section-title">Recommended Next Strategic Protocol</div>
          <div style="font-size: 10pt; color: #475569; background: #EEF2FF; padding: 15px; border-radius: 12px; border: 1px solid #C7D2FE;">
            <div style="margin-bottom: 5px;"><strong>1. Proactive Tracking Loop:</strong> Continue everyday emotional metric collection to enhance logic engine resolution.</div>
            <div><strong>2. Preventive Autonomic Reset:</strong> Apply tactical breathing protocols immediately preceding high-workload intervals.</div>
          </div>

          <div class="footer">
            Automated Professional Health Record Summary • Generated securely via MindCare Advanced Behavioral Logic Engine (2026)
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'MindCare_Clinical_Report' });
      } else {
        Alert.alert("Error", "මෙම උපාංගය මත File Sharing පහසුකම ක්‍රියාත්මක නොවේ.");
      }

    } catch (error) {
      console.error("PDF generation error:", error);
      Alert.alert("Error", "PDF වාර්තාව සකස් කිරීමට නොහැකි විය.");
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#4F75FF" />
        <Text style={{ marginTop: 10, color: '#64748B' }}>වාර්තාව සකස් වෙමින් පවතී...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Action Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft color="#1E293B" size={24} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
          <Download color="#4F75FF" size={20} />
          <Text style={styles.exportText}>Export PDF</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.reportTitle}>Weekly Mental Health Report</Text>
          <Text style={styles.dateRange}>{dateRangeText}</Text>
        </View>

        {/* Overview Box */}
        <View style={styles.whiteCard}>
          <Text style={styles.sectionHeader}>Overview</Text>
          <View style={styles.row}>
            <View style={[styles.statBox, { backgroundColor: '#F8FAFC' }]}>
              <Text style={styles.statLabel}>Avg. Stress Score</Text>
              <Text style={styles.statValue}>{avgStress}</Text>
              <Text style={styles.statSub}>out of 10</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: '#F8FAFC' }]}>
              <Text style={styles.statLabel}>Avg. Sleep</Text>
              <Text style={styles.statValue}>{avgSleep}</Text>
              <Text style={styles.statSub}>hours</Text>
            </View>
          </View>
        </View>

        {/* Stress Trigger Component */}
        <View style={styles.whiteCard}>
          <View style={styles.triggerHeader}>
            <View style={styles.alertCircle}>
              <AlertCircle color="#EF4444" size={18} />
            </View>
            <Text style={styles.triggerTitle}>Most Common Trigger</Text>
          </View>
          <Text style={styles.triggerMain}>{commonTrigger}</Text>
          <Text style={styles.triggerDesc}>Appeared in {triggerPercentage} of your entries this week</Text>
        </View>

        {/* Trend Indicator Component */}
        <View style={[styles.changeCard, { backgroundColor: isDecrease ? '#62C47E' : '#F87171' }]}>
          <View style={styles.changeIconContainer}>
            {isDecrease ? <TrendingDown color="#FFF" size={24} /> : <TrendingUp color="#FFF" size={24} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.changeLabel}>This Week's Change</Text>
            <Text style={styles.changeValue}>{progressText}</Text>
            <Text style={styles.changeDesc}>
              {isDecrease 
                ? "Great progress! Your stress levels decreased compared to last week." 
                : "Caution! Your stress levels increased compared to last week."}
            </Text>
          </View>
        </View>

        {/* AI Recommendations Header */}
        <View style={styles.recommendationHeader}>
           <Text style={{fontSize: 18}}>💡</Text>
           <Text style={styles.sectionTitleLabel}>Personalized Recommendations</Text>
        </View>

        {/* List mapping */}
        {dynamicRecommendations.map((item, index) => (
          <View key={index} style={styles.recItem}>
            <View style={[styles.recIcon, {backgroundColor: '#F1F5F9'}]}>
              <Text style={{fontSize: 20}}>{item.icon || "💡"}</Text>
            </View>
            <View style={styles.recContent}>
              <Text style={styles.recTitle}>{item.title}</Text>
              <Text style={styles.recDesc}>{item.desc}</Text>
            </View>
          </View>
        ))}

        {/* Operational Statistics Component */}
        <View style={styles.whiteCard}>
          <Text style={styles.sectionHeader}>Activity Summary</Text>
          <View style={styles.activityRow}>
            <Text style={styles.activityLabel}>Mood entries logged</Text>
            <Text style={styles.activityValue}>{moodLogs.length}</Text>
          </View>
          <View style={styles.activityRow}>
            <Text style={styles.activityLabel}>Chat sessions</Text>
            <Text style={styles.activityValue}>{chatSessions}</Text>
          </View>
          <View style={[styles.activityRow, {borderBottomWidth: 0}]}>
            <Text style={styles.activityLabel}>Assessments completed</Text>
            <Text style={styles.activityValue}>{totalAssessments}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// UI Element Stylings
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { marginLeft: 8, fontSize: 16, color: '#64748B' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, elevation: 1 },
  exportText: { color: '#4F75FF', fontWeight: 'bold', marginLeft: 5 },
  scrollContent: { padding: 20, paddingBottom: 40 },
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
  changeCard: { padding: 20, borderRadius: 24, flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  changeIconContainer: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 12, borderRadius: 18, marginRight: 15 },
  changeLabel: { color: '#FFF', fontSize: 14, opacity: 0.9 },
  changeValue: { color: '#FFF', fontSize: 32, fontWeight: 'bold' },
  changeDesc: { color: '#FFF', fontSize: 12, marginTop: 4, lineHeight: 18 },
  recommendationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  sectionTitleLabel: { fontSize: 17, fontWeight: 'bold', color: '#1E293B', marginLeft: 10 },
  recItem: { backgroundColor: '#FFF', padding: 15, borderRadius: 20, flexDirection: 'row', marginBottom: 12, elevation: 1 },
  recContent: { flex: 1, marginLeft: 15 },
  recTitle: { fontSize: 15, fontWeight: 'bold', color: '#1E293B' },
  recDesc: { fontSize: 12, color: '#64748B', marginTop: 2, lineHeight: 18 },
  recIcon: { width: 45, height: 45, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  activityRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  activityLabel: { color: '#64748B', fontSize: 14 },
  activityValue: { fontWeight: 'bold', color: '#1E293B', fontSize: 15 }
});

export default WeeklyReportScreen;