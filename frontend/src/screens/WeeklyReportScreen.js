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
  TrendingUp,
  Activity,
  Moon,
  Clock,
  ShieldCheck,
  CheckCircle2,
  BookOpen,
  Heart
} from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserAnalytics, getWeeklyReport, getUserProfile } from '../api/authService';
import { generateClinicalHTMLReport, exportClinicalPDF, isAcademicTrigger } from '../utils/clinicalReportPdf';

let cachedWeeklyReportData = null;

const WeeklyReportScreen = ({ navigation, route }) => {
  const routeParams = route?.params || null;
  const initialReport = routeParams?.cachedReport || cachedWeeklyReportData || null;
  const [reportData, setReportData] = useState(initialReport);
  const [latestAssessment, setLatestAssessment] = useState(routeParams);
  const [loading, setLoading] = useState(!initialReport);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadAllReportData();
  }, [route?.params]);

  const loadAllReportData = async () => {
    try {
      if (!initialReport && !reportData) {
        setLoading(true);
      }

      // 1. Resolve active user ID
      let activeUserId = 'demo_user';
      try {
        const cachedProf = await AsyncStorage.getItem('@mindcare_cached_profile');
        if (cachedProf) {
          const parsedProf = JSON.parse(cachedProf);
          if (parsedProf.id) activeUserId = String(parsedProf.id);
        }
        const profRes = await getUserProfile();
        if (profRes?.data?.id || profRes?.data?._id || profRes?.data?.user_id) {
          activeUserId = String(profRes.data.id || profRes.data._id || profRes.data.user_id);
        }
      } catch (profErr) {
        // demo_user fallback
      }

      // 2. Prioritize params passed from AssessmentScreen navigation
      if (routeParams && (routeParams.predicted_stress || routeParams.assessment_id)) {
        setLatestAssessment(routeParams);
      } else if (activeUserId && activeUserId !== 'demo_user') {
        // Fetch cached ML assessment for this active user
        const cached = await AsyncStorage.getItem(`mindcare_latest_assessment_${activeUserId}`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            setLatestAssessment(parsed);
          } catch (e) {
            console.log("Cached assessment parsing error");
          }
        }
      }

      // 3. Fetch longitudinal weekly report directly from Neo4j
      try {
        const weeklyRes = await getWeeklyReport(activeUserId);
        const wData = weeklyRes?.data?.data || weeklyRes?.data;
        if (wData && wData.status === 'success') {
          cachedWeeklyReportData = wData;
          setReportData(wData);
          return;
        }
      } catch (wErr) {
        console.log("Weekly report fetch fallback to user analytics:", wErr.message || wErr);
      }

      // Fallback to general user analytics
      const response = await getUserAnalytics();
      if (response?.data?.data) {
        cachedWeeklyReportData = response.data.data;
        setReportData(response.data.data);
      } else if (response?.data) {
        cachedWeeklyReportData = response.data;
        setReportData(response.data);
      }
    } catch (error) {
      console.log("Asynchronous report update notice:", error.message || error);
    } finally {
      setLoading(false);
    }
  };

  // Metrics resolution
  const avgStress = reportData?.avg_stress ?? latestAssessment?.pss_score ?? latestAssessment?.predicted_stress_score ?? 5.5;
  const avgSleep = reportData?.avg_sleep ?? latestAssessment?.sleep_hours ?? 7.0;
  const moodLogs = reportData?.recent_mood_logs ?? reportData?.mood_logs ?? [];
  const userName = reportData?.user_name || "Student";
  
  // Resolve primary stress vector with graceful fallback for null/empty/"None"
  const rawStressVector = reportData?.primary_stress_vector || reportData?.common_trigger;
  const isInvalidStressVector = !rawStressVector || 
    String(rawStressVector).trim() === '' || 
    String(rawStressVector).trim().toLowerCase() === 'none' ||
    String(rawStressVector).trim().toLowerCase() === 'null' ||
    String(rawStressVector).trim().toLowerCase() === 'undefined';
  const commonTrigger = isInvalidStressVector ? "General Academic Studies" : String(rawStressVector).trim();
  const triggerPercentage = reportData?.trigger_percentage || "45%";
  
  const getFormattedDateRange = () => {
    if (reportData?.start_date && reportData?.end_date) {
      const start = reportData.start_date.split('T')[0];
      const end = reportData.end_date.split('T')[0];
      return `${start} - ${end}`;
    }
    const today = new Date();
    const prior = new Date();
    prior.setDate(today.getDate() - 7);
    return `${prior.toISOString().split('T')[0]} - ${today.toISOString().split('T')[0]}`;
  };
  
  const dateRangeText = getFormattedDateRange();
  const isBaseline = reportData?.is_baseline ?? (reportData?.variance === 0 || reportData?.variance === undefined);
  const varianceNum = reportData?.variance ?? 0;
  const isDecrease = isBaseline || varianceNum <= 0;

  const sanitizeRecText = (text) => {
    if (!text || typeof text !== 'string') return text || '';
    return text
      .replace(/\bStructure your None sessions\b/gi, "Structure your General Academic Studies sessions")
      .replace(/\bNone sessions\b/gi, "General Academic Studies sessions")
      .replace(/\bdemanding None tasks\b/gi, "demanding academic tasks")
      .replace(/\bdemanding None work\b/gi, "demanding academic work")
      .replace(/\bdemanding None\b/gi, "demanding academic")
      .replace(/\bsteady None study\b/gi, "steady academic study")
      .replace(/\bsteady None\b/gi, "steady academic")
      .replace(/\byour None sessions\b/gi, "your study sessions")
      .replace(/\bNone\b/g, "General Academic Studies");
  };

  // Dynamic Personalized Clinical Recommendations Resolution
  const getResolvedRecommendations = () => {
    // 1. Prioritize backend dynamic recommendations computed from user's latest logged parameters
    const rawRecs = reportData?.recommendations || reportData?.ai_recommendations;
    if (rawRecs && Array.isArray(rawRecs) && rawRecs.length > 0) {
      return rawRecs.map(rec => {
        if (typeof rec === 'string') return { title: "Clinical Insight", desc: sanitizeRecText(rec), icon: "Activity" };
        const iconName = rec.icon === "Brain" ? "Clock" : (rec.icon || "Activity");
        return {
          title: rec.title || "Clinical Protocol",
          desc: sanitizeRecText(rec.desc || rec.description || "Follow designated behavioral plan."),
          icon: iconName
        };
      });
    }

    // 2. Prioritize Gemini recommendations generated during latest ML assessment
    if (latestAssessment?.recommendations && Array.isArray(latestAssessment.recommendations) && latestAssessment.recommendations.length > 0) {
      return latestAssessment.recommendations.map(rec => ({
        title: rec.title || "Clinical Protocol",
        desc: rec.desc || rec.description || "Follow clinical coping guidance.",
        icon: rec.icon === "Brain" ? "Clock" : (rec.icon || "Activity")
      }));
    }

    // 3. Dynamic Clinical Fallbacks constructed from user's real parameters
    const numericStress = Number(avgStress) || 5;
    const latestSleep = reportData?.avg_sleep ?? latestAssessment?.sleep_hours ?? 7.0;
    const workloadFactor = commonTrigger || "academic";
    const isAcademic = isAcademicTrigger(workloadFactor);

    const sleepRec = {
      title: "Circadian Rhythm Stability",
      desc: `Based on your logged ${latestSleep}h sleep, aim to stabilize your circadian rhythm by maintaining consistent sleep/wake times.`,
      icon: "Moon"
    };

    let cognitiveRec;
    let autonomicRec;

    const cognitivePacingDesc = isAcademic
      ? "Structure your study sessions with 45m focus / 10m reset intervals to maintain sustained working memory stamina."
      : "Break financial or personal tasks into small, scheduled 20-minute planning check-ins to reduce mental overwhelm.";

    if (numericStress >= 7 || latestAssessment?.predicted_stress === "High") {
      cognitiveRec = {
        title: "Cognitive Task Chunking",
        desc: isAcademic
          ? "Break demanding study tasks into 25m focus / 5m reset intervals to prevent cognitive fatigue."
          : "Break financial or personal tasks into small, scheduled 20-minute planning check-ins to reduce mental overwhelm.",
        icon: "Clock"
      };
      autonomicRec = {
        title: "4-7-8 Autonomic Reset",
        desc: "Practice rhythmic diaphragmatic breathing for 5 minutes twice daily to reduce sympathetic hyperarousal.",
        icon: "Activity"
      };
    } else if (numericStress >= 4 || latestAssessment?.predicted_stress === "Moderate") {
      cognitiveRec = {
        title: "Cognitive Pacing",
        desc: cognitivePacingDesc,
        icon: "Clock"
      };
      autonomicRec = {
        title: "Resonant Coherence Breathing",
        desc: "Engage in 5.5-second box breathing cycles before study sessions to stabilize heart rate variability.",
        icon: "Activity"
      };
    } else {
      cognitiveRec = {
        title: "Balanced Study Cadence",
        desc: isAcademic
          ? "Maintain your steady study cadence with scheduled 15m pauses to preserve focus stamina."
          : "Break financial or personal tasks into small, scheduled 20-minute planning check-ins to reduce mental overwhelm.",
        icon: "Clock"
      };
      autonomicRec = {
        title: "Mindful Presence Anchor",
        desc: "Practice brief 3-minute physiological sighing pauses throughout the day to sustain autonomic equilibrium.",
        icon: "Activity"
      };
    }

    return [sleepRec, cognitiveRec, autonomicRec];
  };

  const dynamicRecommendations = getResolvedRecommendations();

  // Render Lucide Icon Helper (Clock/Timer outline for pacing, NEVER Brain)
  const renderLucideIcon = (iconName, size = 22, color = "#0D9488") => {
    switch (iconName) {
      case "Moon":
        return <Moon size={size} color={color} />;
      case "Clock":
      case "Brain":
        return <Clock size={size} color={color} />;
      case "BookOpen":
        return <BookOpen size={size} color={color} />;
      case "ShieldCheck":
        return <ShieldCheck size={size} color={color} />;
      default:
        return <Activity size={size} color={color} />;
    }
  };

  // Reliable Clinical PDF Export Pipeline
  const handleExportPDF = async () => {
    if (isExporting) return;
    try {
      const combinedData = {
        ...reportData,
        user_name: reportData?.user_name || latestAssessment?.user_name || userName || 'Student',
        patient_id: latestAssessment?.assessment_id || reportData?.patient_id || 'MC-10492',
        avg_stress: avgStress,
        avg_sleep: avgSleep,
        study_hours: reportData?.study_hours || latestAssessment?.study_hours || 5.5,
        common_trigger: commonTrigger,
        trigger_percentage: triggerPercentage,
        variance: varianceNum,
        is_baseline: isBaseline,
        start_date: reportData?.start_date,
        end_date: reportData?.end_date,
        recent_mood_logs: moodLogs,
        recommendations: dynamicRecommendations,
        activity_summary: reportData?.activity_summary || {
          mood_count: moodLogs.length,
          support_count: 0,
          assessment_count: 0,
          relaxation_count: 0,
        }
      };

      await exportClinicalPDF(combinedData, setIsExporting);
    } catch (error) {
      console.warn('Export pipeline notice:', error?.message || error);
    }
  };

  const handleExportPdf = handleExportPDF;
  const handleExport = handleExportPDF;
  if (loading && !reportData) {
    return (
      <View style={[styles.container, styles.loadingCenter]}>
        <ActivityIndicator size="large" color="#0D9488" />
        <Text style={styles.loadingStatusText}>Compiling behavioral analytics report...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Navigation */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft color="#0D9488" size={22} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.exportBtn} 
          onPress={handleExportPDF}
          disabled={isExporting}
          activeOpacity={0.8}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color="#0D9488" style={{ marginRight: 6 }} />
          ) : (
            <Download color="#0D9488" size={18} />
          )}
          <Text style={styles.exportText}>{isExporting ? 'Generating...' : 'Export PDF'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.reportTitle}>Weekly Mental Health Report</Text>
          <Text style={styles.dateRange}>{dateRangeText}</Text>
        </View>

        {/* Overview Stats */}
        <View style={styles.whiteCard}>
          <Text style={styles.sectionHeader}>Biometric & Behavioral Overview</Text>
          <View style={styles.row}>
            <View style={[styles.statBox, { backgroundColor: '#F8FAFC' }]}>
              <Text style={styles.statLabel}>Avg. Stress Score</Text>
              <Text style={styles.statValue}>{avgStress}</Text>
              <Text style={styles.statSub}>scale of 10</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: '#F8FAFC' }]}>
              <Text style={styles.statLabel}>Avg. Sleep</Text>
              <Text style={styles.statValue}>{avgSleep}</Text>
              <Text style={styles.statSub}>hours / night</Text>
            </View>
          </View>
        </View>

        {/* Primary Trigger Card */}
        <View style={styles.whiteCard}>
          <View style={styles.triggerHeader}>
            <View style={styles.alertCircle}>
              <AlertCircle color="#EF4444" size={18} />
            </View>
            <Text style={styles.triggerTitle}>Primary Stress Vector</Text>
          </View>
          <Text style={styles.triggerMain}>{commonTrigger}</Text>
          <Text style={styles.triggerDesc}>Identified in {triggerPercentage} of monitored logs this active cycle</Text>
        </View>

        {/* Longitudinal Variance Trend Card */}
        <View style={[styles.changeCard, { backgroundColor: isDecrease ? '#0D9488' : '#F87171' }]}>
          <View style={styles.changeIconContainer}>
            {isDecrease ? <TrendingDown color="#FFF" size={24} /> : <TrendingUp color="#FFF" size={24} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.changeLabel}>Weekly Variance Index</Text>
            <Text style={styles.changeValue}>
              {reportData?.is_baseline 
                ? "Baseline Established" 
                : reportData?.variance > 0 
                ? `+${reportData.variance}%` 
                : `${reportData?.variance ?? 0}%`}
            </Text>
            <Text style={styles.changeDesc}>
              {reportData?.is_baseline 
                ? "First week baseline established. Ongoing evaluations will track relative stress acceleration."
                : isDecrease 
                ? "Clinical parameters indicate positive adaptation. Stress velocity has decreased relative to baseline." 
                : "Clinical Notice: Elevated stress density detected. Designated coping protocols are advised."}
            </Text>
          </View>
        </View>

        {/* Personalized Recommendations Header */}
        <View style={styles.recommendationHeader}>
          <CheckCircle2 color="#0D9488" size={20} />
          <Text style={styles.sectionTitleLabel}>Personalized Recommendations</Text>
        </View>

        {/* Render 3 Concise Clinical Recommendations */}
        {dynamicRecommendations.map((item, index) => (
          <View key={index} style={styles.recItem}>
            <View style={styles.recIconWrap}>
              {renderLucideIcon(item.icon, 22, "#0D9488")}
            </View>
            <View style={styles.recContent}>
              <Text style={styles.recTitle}>{item.title}</Text>
              <Text style={styles.recDesc}>{item.desc}</Text>
            </View>
          </View>
        ))}

        {/* Clinical Activity Summary */}
        <View style={[styles.whiteCard, { marginTop: 10 }]}>
          <Text style={styles.sectionHeader}>Activity Summary</Text>
          <View style={styles.activityRow}>
            <Text style={styles.activityLabel}>Mood entries recorded</Text>
            <Text style={styles.activityValue}>
              {reportData?.activity_summary?.mood_count ?? moodLogs.length}
            </Text>
          </View>
          <View style={styles.activityRow}>
            <Text style={styles.activityLabel}>Clinical support interactions</Text>
            <Text style={styles.activityValue}>
              {reportData?.activity_summary?.support_count ?? 0}
            </Text>
          </View>
          <View style={styles.activityRow}>
            <Text style={styles.activityLabel}>Assessments completed</Text>
            <Text style={styles.activityValue}>
              {reportData?.activity_summary?.assessment_count ?? 0}
            </Text>
          </View>
          <View style={[styles.activityRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.activityLabel}>Relaxation & Pacing sessions</Text>
            <Text style={styles.activityValue}>
              {reportData?.activity_summary?.relaxation_count ?? 0}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  loadingCenter: {
    justifyContent: 'center', 
    alignItems: 'center'
  },
  loadingStatusText: { 
    marginTop: 12, 
    color: '#64748B', 
    fontSize: 14, 
    fontWeight: '500' 
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  backBtn: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  backText: { 
    marginLeft: 6, 
    fontSize: 15, 
    color: '#0D9488', 
    fontWeight: '600' 
  },
  exportBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#E6F4F1', 
    paddingHorizontal: 12, 
    paddingVertical: 7, 
    borderRadius: 14 
  },
  exportText: { 
    color: '#0F766E', 
    fontWeight: '700', 
    fontSize: 13, 
    marginLeft: 6 
  },
  scrollContent: { 
    padding: 20, 
    paddingBottom: 40 
  },
  titleSection: { 
    marginBottom: 20 
  },
  reportTitle: { 
    fontSize: 23, 
    fontWeight: '800', 
    color: '#1E293B', 
    marginBottom: 4 
  },
  dateRange: { 
    color: '#64748B', 
    fontSize: 14, 
    fontWeight: '500' 
  },
  whiteCard: { 
    backgroundColor: '#FFFFFF', 
    padding: 20, 
    borderRadius: 20, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: '#E2E8F0',
    elevation: 1 
  },
  sectionHeader: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#1E293B', 
    marginBottom: 14 
  },
  row: { 
    flexDirection: 'row', 
    justifyContent: 'space-between' 
  },
  statBox: { 
    width: '48%', 
    padding: 16, 
    borderRadius: 16, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  statLabel: { 
    color: '#64748B', 
    fontSize: 12, 
    textAlign: 'center', 
    marginBottom: 6, 
    fontWeight: '600' 
  },
  statValue: { 
    fontSize: 26, 
    fontWeight: '800', 
    color: '#0F766E' 
  },
  statSub: { 
    color: '#94A3B8', 
    fontSize: 11, 
    marginTop: 2 
  },
  triggerHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 10 
  },
  alertCircle: { 
    padding: 8, 
    backgroundColor: '#FEF2F2', 
    borderRadius: 12 
  },
  triggerTitle: { 
    color: '#1E293B', 
    fontWeight: '700', 
    marginLeft: 10, 
    fontSize: 15 
  },
  triggerMain: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: '#EF4444', 
    marginBottom: 4 
  },
  triggerDesc: { 
    color: '#64748B', 
    fontSize: 13, 
    lineHeight: 18 
  },
  changeCard: { 
    padding: 20, 
    borderRadius: 20, 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 20,
    elevation: 2 
  },
  changeIconContainer: { 
    backgroundColor: 'rgba(255,255,255,0.25)', 
    padding: 12, 
    borderRadius: 16, 
    marginRight: 14 
  },
  changeLabel: { 
    color: '#FFFFFF', 
    fontSize: 13, 
    opacity: 0.9, 
    fontWeight: '600' 
  },
  changeValue: { 
    color: '#FFFFFF', 
    fontSize: 28, 
    fontWeight: '800', 
    marginVertical: 2 
  },
  changeDesc: { 
    color: '#FFFFFF', 
    fontSize: 12, 
    lineHeight: 18, 
    opacity: 0.95 
  },
  recommendationHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 14, 
    gap: 8 
  },
  sectionTitleLabel: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#1E293B' 
  },
  recItem: { 
    backgroundColor: '#FFFFFF', 
    padding: 16, 
    borderRadius: 18, 
    flexDirection: 'row', 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: '#E2E8F0',
    elevation: 1 
  },
  recIconWrap: { 
    width: 44, 
    height: 44, 
    borderRadius: 14, 
    backgroundColor: '#E6F4F1', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 14 
  },
  recContent: { 
    flex: 1 
  },
  recTitle: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#0F766E', 
    marginBottom: 3 
  },
  recDesc: { 
    fontSize: 13, 
    color: '#475569', 
    lineHeight: 18 
  },
  activityRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F1F5F9' 
  },
  activityLabel: { 
    color: '#64748B', 
    fontSize: 14, 
    fontWeight: '500' 
  },
  activityValue: { 
    fontWeight: '700', 
    color: '#1E293B', 
    fontSize: 14 
  }
});

export default WeeklyReportScreen;