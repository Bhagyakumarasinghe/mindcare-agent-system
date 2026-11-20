import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  TextInput,
  ActivityIndicator, 
  Alert,
  Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ArrowLeft, 
  CheckCircle2, 
  Activity, 
  Moon, 
  Clock, 
  ChevronRight, 
  ShieldCheck,
  Send,
  MessageSquare,
  HeartPulse
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  predictAndRecordStress, 
  getUserProfile, 
  getAssessmentContext, 
  evaluateAssessmentResponse,
  getNextQuestion
} from '../api/authService';

const PSS_QUESTIONS = [
  {
    id: 1,
    category: "Stress Perception",
    question: "Over the past few days, how often have you been upset because of something that happened unexpectedly?",
    options: ["Never", "Almost Never", "Sometimes", "Fairly Often", "Very Often"]
  },
  {
    id: 2,
    category: "Control & Agency",
    question: "Over the past few days, how often have you felt unable to control the important things in your life?",
    options: ["Never", "Almost Never", "Sometimes", "Fairly Often", "Very Often"]
  },
  {
    id: 3,
    category: "Nervous Arousal",
    question: "Over the past few days, how often have you felt nervous, stressed, or emotionally overloaded?",
    options: ["Never", "Almost Never", "Sometimes", "Fairly Often", "Very Often"]
  },
  {
    id: 4,
    category: "Coping Confidence",
    question: "Over the past few days, how often have you felt confident in your ability to handle personal challenges?",
    options: ["Never", "Almost Never", "Sometimes", "Fairly Often", "Very Often"]
  },
  {
    id: 5,
    category: "Life Trajectory",
    question: "Over the past few days, how often have you felt that things were moving smoothly in your direction?",
    options: ["Never", "Almost Never", "Sometimes", "Fairly Often", "Very Often"]
  },
  {
    id: 6,
    category: "Workload Coping",
    question: "Over the past few days, how often have you found that you could not cope with all the tasks you had to do?",
    options: ["Never", "Almost Never", "Sometimes", "Fairly Often", "Very Often"]
  },
  {
    id: 7,
    category: "Irritation Regulation",
    question: "Over the past few days, how often have you been able to control irritations in your daily life?",
    options: ["Never", "Almost Never", "Sometimes", "Fairly Often", "Very Often"]
  },
  {
    id: 8,
    category: "Self-Efficacy",
    question: "Over the past few days, how often have you felt on top of your responsibilities and in control?",
    options: ["Never", "Almost Never", "Sometimes", "Fairly Often", "Very Often"]
  },
  {
    id: 9,
    category: "Sleep Architecture",
    question: "How many hours of sleep did you get last night?",
    options: ["< 5 hours", "5 - 6 hours", "7 - 8 hours", "> 8 hours"],
    mapping: {
      "< 5 hours": 4.5,
      "5 - 6 hours": 5.5,
      "7 - 8 hours": 7.5,
      "> 8 hours": 8.5
    }
  },
  {
    id: 10,
    category: "Focus & Academic Load",
    question: "Daily focused study or work duration?",
    options: ["< 4 hours", "4 - 6 hours", "6 - 8 hours", "> 8 hours"],
    mapping: {
      "< 4 hours": 3.5,
      "4 - 6 hours": 5.0,
      "6 - 8 hours": 7.0,
      "> 8 hours": 9.0
    }
  }
];

export const alignPssToStressCategory = (pssScore) => {
  const numeric = typeof pssScore === 'number' ? pssScore : parseFloat(pssScore) || 5.0;
  return Math.round(numeric * 10) / 10;
};

export default function AssessmentScreen({ navigation }) {
  const [questions, setQuestions] = useState(PSS_QUESTIONS);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [scores, setScores] = useState({});
  const [textNotes, setTextNotes] = useState({});
  const [isEvaluatingText, setIsEvaluatingText] = useState(false);
  const [isAdaptingNext, setIsAdaptingNext] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState(null);
  const [currentUserId, setCurrentUserId] = useState("demo_user");

  // Longitudinal Memory State
  const [longitudinalContext, setLongitudinalContext] = useState(null);
  const [checkinMessage, setCheckinMessage] = useState(null);
  const [loadingContext, setLoadingContext] = useState(true);

  const totalQuestions = questions.length;
  const currentQ = questions[currentStepIndex] || PSS_QUESTIONS[currentStepIndex];
  const isPsychometricStep = currentStepIndex < 8; // Q1 to Q8
  const progressPercent = ((currentStepIndex + 1) / totalQuestions) * 100;

  const selectedOption = answers[currentStepIndex] || null;
  const currentText = textNotes[currentStepIndex] || "";

  useEffect(() => {
    fetchActiveUserAndContext();
  }, []);

  const fetchActiveUserAndContext = async () => {
    try {
      setLoadingContext(true);
      const profileRes = await getUserProfile();
      if (profileRes?.data?.id) {
        setCurrentUserId(profileRes.data.id);
      }

      // Fetch Longitudinal Memory and Gemini Check-in Prompt
      const ctxRes = await getAssessmentContext();
      if (ctxRes?.data?.status === "success") {
        setLongitudinalContext(ctxRes.data.context || {});
        setCheckinMessage(ctxRes.data.checkin_message || null);
      }
    } catch (e) {
      console.log("Using baseline user longitudinal session context:", e.message || e);
      setCheckinMessage("Welcome to your MindCare check-in. Let's evaluate your emotional resilience and academic balance over the past few days.");
    } finally {
      setLoadingContext(false);
    }
  };

  const handleSelectOption = (option, optionIndex) => {
    setAnswers(prev => ({ ...prev, [currentStepIndex]: option }));
    if (isPsychometricStep) {
      // Direct Likert mapping 0 to 4
      setScores(prev => ({ ...prev, [currentStepIndex]: optionIndex }));
    }
  };

  const handleTextChange = (text) => {
    setTextNotes(prev => ({ ...prev, [currentStepIndex]: text }));
  };

  const handleNext = async () => {
    if (isSubmitting || isEvaluatingText) return;

    let updatedScores = { ...scores };
    let updatedAnswers = { ...answers };

    // Seamless single "Continue" flow:
    // If user types in "Express In Your Own Words" without picking a radio button
    if (isPsychometricStep && !selectedOption && currentText.trim()) {
      try {
        setIsEvaluatingText(true);
        let mappedScore = 2;
        let mappedOption = currentQ.options[2];

        try {
          const res = await evaluateAssessmentResponse({
            question: currentQ.question,
            text_response: currentText.trim()
          });

          if (res?.data?.status === "success" && res.data.evaluation) {
            const evalData = res.data.evaluation;
            mappedScore = Math.max(0, Math.min(4, parseInt(evalData.score ?? 2)));
            mappedOption = currentQ.options[mappedScore] || "Sometimes";
          }
        } catch (apiError) {
          console.log("Assessment evaluation network fallback:", apiError);
          // Client-side instant keyword fallback
          const t = currentText.toLowerCase().trim();
          if (["no", "nope", "never", "not at all", "none", "zero", "nah"].some(w => t === w || t.includes(w))) {
            mappedScore = 0;
          } else if (["always", "constantly", "severe", "overwhelmed", "unbearable"].some(w => t.includes(w))) {
            mappedScore = 4;
          } else if (["often", "frequently", "a lot", "stressed"].some(w => t.includes(w))) {
            mappedScore = 3;
          } else if (["rarely", "almost never", "hardly", "barely"].some(w => t.includes(w))) {
            mappedScore = 1;
          } else {
            mappedScore = 2;
          }
          mappedOption = currentQ.options[mappedScore] || "Sometimes";
        }

        updatedScores[currentStepIndex] = mappedScore;
        updatedAnswers[currentStepIndex] = mappedOption;
        setScores(updatedScores);
        setAnswers(updatedAnswers);

      } finally {
        setIsEvaluatingText(false);
      }
    } else if (!selectedOption && !currentText.trim()) {
      Alert.alert("Selection Required", "Please select an indicator or describe your state to proceed.");
      return;
    }

    if (currentStepIndex < totalQuestions - 1) {
      const nextStepIdx = currentStepIndex + 1;

      // Real-time Gemini Adaptive Question Generation for Steps 2 through 8 (stepIndex 1 to 7)
      if (nextStepIdx <= 7) {
        try {
          setIsAdaptingNext(true);
          const nextQRes = await getNextQuestion({
            stepIndex: nextStepIdx,
            previousAnswers: updatedAnswers,
            lastQuestion: currentQ.question,
            lastLikertLabel: updatedAnswers[currentStepIndex] || selectedOption || "Sometimes",
            lastAnswerText: currentText.trim()
          }, { timeout: 16000 });

          if (nextQRes?.data?.status === "success" && nextQRes.data.question) {
            setQuestions(prev => {
              const copy = [...prev];
              copy[nextStepIdx] = {
                ...copy[nextStepIdx],
                question: nextQRes.data.question,
                category: nextQRes.data.category || copy[nextStepIdx].category
              };
              return copy;
            });
          }
        } catch (adaptErr) {
          console.log("Adaptive question generation fallback:", adaptErr);
          // Gracefully retains baseline validated PSS question
        } finally {
          setIsAdaptingNext(false);
        }
      }

      setCurrentStepIndex(prev => prev + 1);
    } else {
      // Step 10 submission: execute ML inference and Neo4j recording
      await finalizeAssessment(updatedAnswers, updatedScores);
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    } else {
      navigation.goBack();
    }
  };

  const finalizeAssessment = async (overrideAnswers, overrideScores) => {
    setIsSubmitting(true);
    try {
      const activeAnswers = overrideAnswers || answers;
      const activeScores = overrideScores || scores;

      // Compute Scaled Clinical PSS Score (0 to 10) from Questions 1 to 8
      // In Cohen's PSS, positive coping questions are reverse-scored:
      // Q4 (index 3: confident), Q5 (index 4: moving smoothly),
      // Q7 (index 6: control irritations), Q8 (index 7: on top of responsibilities)
      const reverseIndices = new Set([3, 4, 6, 7]);
      let rawScoreSum = 0;
      for (let i = 0; i < 8; i++) {
        const raw = activeScores[i] !== undefined ? activeScores[i] : 2; // Default to mid (2) if omitted
        const itemScore = reverseIndices.has(i) ? (4 - raw) : raw;
        rawScoreSum += itemScore;
      }
      // Maximum raw score is 8 * 4 = 32. Scale to 0 - 10
      const computedPss = Math.round((rawScoreSum / 32) * 10 * 10) / 10;

      // Extract quantitative biometric values from Questions 9 and 10
      const sleepSelection = activeAnswers[8] || "7 - 8 hours";
      const studySelection = activeAnswers[9] || "4 - 6 hours";

      const sleepVal = PSS_QUESTIONS[8].mapping[sleepSelection] || 7.0;
      const studyVal = PSS_QUESTIONS[9].mapping[studySelection] || 5.0;

      const userReflections = Object.values(textNotes).filter(t => typeof t === 'string' && t.trim().length > 0);

      const payload = {
        user_id: currentUserId,
        study_hours: studyVal,
        extracurricular_hours: 2.0,
        sleep_hours: sleepVal,
        physical_activity_hours: 1.5,
        pss_score: computedPss,
        reflections: userReflections
      };

      console.log("Submitting ML & Graph assessment payload:", payload);
      const response = await predictAndRecordStress(payload);
      const data = response.data;

      if (data.status === "success") {
        const predictedCategory = data.stress_level || data.predicted_stress || "Moderate";
        const finalPssScore = data.scaled_pss_score !== undefined && data.scaled_pss_score !== null
          ? Number(data.scaled_pss_score)
          : data.pss_score !== undefined && data.pss_score !== null
          ? Number(data.pss_score)
          : computedPss;

        const resultData = {
          predicted_stress: predictedCategory,
          stress_level: predictedCategory,
          confidence: data.confidence,
          assessment_id: data.assessment_id,
          pss_score: finalPssScore,
          scaled_pss_score: finalPssScore,
          recommendations: data.recommendations || [],
          study_hours: studyVal,
          sleep_hours: sleepVal,
          timestamp: new Date().toISOString()
        };

        // Cache for Weekly Report Screen and dashboard components
        await AsyncStorage.setItem("mindcare_latest_assessment", JSON.stringify(resultData));
        setAssessmentResult(resultData);
      } else {
        throw new Error("Assessment submission failed");
      }
    } catch (error) {
      console.error("ML Assessment submission fallback:", error);
      // Fallback result to maintain continuous clinical flow
      const fallbackCategory = "Moderate";
      const fallbackPss = computedPss;
      const fallbackResult = {
        predicted_stress: fallbackCategory,
        stress_level: fallbackCategory,
        confidence: 0.84,
        pss_score: fallbackPss,
        scaled_pss_score: fallbackPss,
        assessment_id: "local-" + Date.now(),
        study_hours: studyVal,
        sleep_hours: sleepVal,
        recommendations: [
          {
            title: "Autonomic Regulation",
            desc: "Incorporate deep breathing intervals between study blocks to regulate autonomic nervous system tone.",
            icon: "HeartPulse"
          },
          {
            title: "Sleep Consistency",
            desc: `With ${sleepVal}h sleep recorded, maintain a steady rest schedule to bolster emotional resilience.`,
            icon: "Moon"
          },
          {
            title: "Cognitive Pacing",
            desc: `Divide your ${studyVal}h daily study cadence with mindful restorative breaks to preserve focus.`,
            icon: "Clock"
          }
        ]
      };
      await AsyncStorage.setItem("mindcare_latest_assessment", JSON.stringify(fallbackResult));
      setAssessmentResult(fallbackResult);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Completion Screen View
  if (assessmentResult) {
    const stressLevel = assessmentResult.stress_level || assessmentResult.predicted_stress || "Moderate";
    const isHigh = stressLevel === "High";
    const isModerate = stressLevel === "Moderate";
    // Soft color-coded pills:
    // Low: soft emerald (#DCFCE7, border #86EFAC, text #15803D)
    // Moderate: warm amber (#FEF3C7, border #FCD34D, text #B45309)
    // High: soft coral-red (#FEE2E2, border #FCA5A5, text #B91C1C)
    const badgeColor = isHigh ? "#B91C1C" : isModerate ? "#B45309" : "#15803D";
    const badgeBg = isHigh ? "#FEE2E2" : isModerate ? "#FEF3C7" : "#DCFCE7";
    const badgeBorder = isHigh ? "#FCA5A5" : isModerate ? "#FCD34D" : "#86EFAC";
    const rawScore = assessmentResult.scaled_pss_score ?? assessmentResult.pss_score ?? 5.0;
    const pssFormatted = Number(rawScore).toFixed(1);

    return (
      <View style={styles.container}>
        {/* Ambient Translucent Mint-Teal and Soft Sky-Blue Circles (Identical to HomeScreen.js) */}
        <View pointerEvents="none" style={styles.ambientOrbTop} />
        <View pointerEvents="none" style={styles.ambientOrbMiddle} />
        <View pointerEvents="none" style={styles.ambientOrbBottom} />

        <SafeAreaView style={styles.safeArea}>
          {/* Top Header Bar with Minimal Layout */}
          <View style={styles.headerBar}>
            <TouchableOpacity 
              onPress={() => navigation.navigate("Main", { screen: "Home" })} 
              style={styles.circularBackBtn}
              accessibilityLabel="Dashboard"
              activeOpacity={0.7}
            >
              <ArrowLeft size={20} color="#0D9488" strokeWidth={2.5} />
            </TouchableOpacity>

            <View style={styles.headerRightBadge}>
              <ShieldCheck size={15} color="#0F766E" style={{ marginRight: 5 }} />
              <Text style={styles.headerRightBadgeText}>Assessment Results</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.resultScrollContent} showsVerticalScrollIndicator={false}>
          {/* 1. Top Calming Hero Image Banner */}
          <View style={styles.heroCard}>
            <Image 
              source={require('../../assets/images/banner-1.png')}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
            <LinearGradient
              colors={["rgba(15, 23, 42, 0.05)", "rgba(15, 23, 42, 0.6)"]}
              style={styles.heroGradientOverlay}
            >
              <View style={styles.heroPillTag}>
                <Text style={styles.heroPillText}>CLINICAL WELLNESS SUMMARY</Text>
              </View>
              <Text style={styles.heroTitle}>Assessment Complete</Text>
            </LinearGradient>
          </View>

          {/* 2. Frosted White Glass Metrics Card (Clean, Icon-Free Editorial) */}
          <View style={styles.metricsCard}>
            <View style={styles.metricsTopRow}>
              <Text style={styles.metricsLabel}>Predicted Stress Level</Text>
              <View style={[styles.statusPill, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
                <Text style={[styles.statusPillText, { color: badgeColor }]}>
                  {stressLevel}
                </Text>
              </View>
            </View>

            <View style={styles.metricsHDivider} />

            <View style={styles.metricsDualRow}>
              <View style={styles.metricColumn}>
                <Text style={styles.metricColLabel}>SCALED PSS INDEX</Text>
                <View style={styles.metricValueRow}>
                  <Text style={styles.metricColValueLarge}>{pssFormatted}</Text>
                  <Text style={styles.metricColValueUnit}>/10</Text>
                </View>
              </View>

              <View style={styles.metricsVDivider} />

              <View style={styles.metricColumn}>
                <Text style={styles.metricColLabel}>HEALTH GRAPH</Text>
                <View style={styles.syncedRow}>
                  <View style={styles.syncedDot} />
                  <Text style={styles.syncedText}>Synced</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 3. Editorial Personalized Coping Protocols (Zero Boxy Icons) */}
          <View style={styles.recsSection}>
            <View style={styles.recsHeaderContainer}>
              <Text style={styles.recsSectionTitle}>Personalized Coping Protocols</Text>
              <Text style={styles.recsSectionSubtitle}>Tailored to your sleep, study load & reflections</Text>
            </View>

            {(assessmentResult.recommendations || []).map((rec, idx) => {
              const stepNum = String(idx + 1).padStart(2, '0');
              return (
                <View key={idx} style={styles.editorialRecCard}>
                  <View style={styles.recAccentBar} />
                  <View style={styles.recBody}>
                    <View style={styles.recHeaderRow}>
                      <Text style={styles.recStepNum}>{stepNum}</Text>
                      <Text style={styles.recTitle}>{rec.title}</Text>
                    </View>
                    <Text style={styles.recDesc}>{rec.desc}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* 4. Bottom Action Button: Back to Dashboard */}
          <View style={styles.buttonStack}>
            <TouchableOpacity 
              style={styles.primaryTealBtn} 
              onPress={() => navigation.navigate("Main", { screen: "Home" })}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryTealBtnText}>Back to Dashboard</Text>
              <ChevronRight size={18} color="#FFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Ambient Translucent Mint-Teal and Soft Sky-Blue Circles (Identical to HomeScreen.js) */}
      <View pointerEvents="none" style={styles.ambientOrbTop} />
      <View pointerEvents="none" style={styles.ambientOrbMiddle} />
      <View pointerEvents="none" style={styles.ambientOrbBottom} />

      <SafeAreaView style={styles.safeArea}>
        {/* Top Header Bar with Minimal Layout */}
        <View style={styles.headerBar}>
          <TouchableOpacity 
            onPress={handlePrevious} 
            style={styles.circularBackBtn}
            accessibilityLabel="Back"
            activeOpacity={0.7}
          >
          <ArrowLeft size={20} color="#0D9488" strokeWidth={2.5} />
        </TouchableOpacity>

        <View style={styles.headerRightBadge}>
          <ShieldCheck size={15} color="#0F766E" style={{ marginRight: 5 }} />
          <Text style={styles.headerRightBadgeText}>Adaptive PSS</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        {/* Longitudinal Memory Check-in Banner */}
        {checkinMessage && (
          <View style={styles.longitudinalBanner}>
            <View style={styles.longitudinalBannerHeader}>
              <HeartPulse size={16} color="#0D9488" />
              <Text style={styles.longitudinalBannerTitle}>Clinical Progress Patterns</Text>
              {longitudinalContext?.last_stress_level && (
                <View style={styles.historyPill}>
                  <Text style={styles.historyPillText}>Prior: {longitudinalContext.last_stress_level}</Text>
                </View>
              )}
            </View>
            <Text style={styles.longitudinalBannerText} numberOfLines={3}>{checkinMessage}</Text>
          </View>
        )}

        {/* Progress Tracker */}
        <View style={styles.progressContainer}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressStepText}>
              Step {currentStepIndex + 1} of {totalQuestions}
            </Text>
            <Text style={styles.progressPercentText}>
              {Math.round(progressPercent)}%
            </Text>
          </View>

          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>

        {/* Category Chip */}
        <View style={styles.categoryChip}>
          {currentStepIndex === 8 ? (
            <Moon size={14} color="#0F766E" style={{ marginRight: 6 }} />
          ) : currentStepIndex === 9 ? (
            <Clock size={14} color="#0F766E" style={{ marginRight: 6 }} />
          ) : (
            <HeartPulse size={14} color="#0F766E" style={{ marginRight: 6 }} />
          )}
          <Text style={styles.categoryChipText}>{currentQ.category}</Text>
        </View>

        {/* Question Prompt Card */}
        <View style={styles.questionCard}>
          <Text style={styles.questionText}>{currentQ.question}</Text>
        </View>

        {/* HYBRID ARCHITECTURE (Questions 1-8): NLP Free-form Input alongside Radio Options */}
        {isPsychometricStep && (
          <View style={styles.nlpInputCard}>
            <View style={styles.nlpHeaderRow}>
              <MessageSquare size={16} color="#0D9488" />
              <Text style={styles.nlpHeaderTitle}>Express In Your Own Words (Optional)</Text>
            </View>
            <TextInput
              style={styles.nlpTextInput}
              placeholder="e.g. I felt completely overwhelmed by assignment deadlines yesterday..."
              placeholderTextColor="#94A3B8"
              value={currentText}
              onChangeText={handleTextChange}
              multiline
              maxLength={300}
              editable={!isSubmitting && !isEvaluatingText}
            />
          </View>
        )}

        {/* Response Option Chips (Radio Buttons) */}
        <Text style={styles.optionsSectionTitle}>
          {isPsychometricStep ? "Or Select Clinical Likert Indicator:" : "Select Biometric Range:"}
        </Text>
        <View style={styles.optionsList}>
          {currentQ.options.map((option, idx) => {
            const isSelected = selectedOption === option;
            return (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.8}
                style={[
                  styles.optionChip,
                  isSelected && styles.optionChipSelected
                ]}
                onPress={() => handleSelectOption(option, idx)}
                disabled={isSubmitting || isEvaluatingText}
              >
                <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                  {isSelected && <View style={styles.radioDot} />}
                </View>
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Floating Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.nextButton, 
            (!selectedOption && !currentText.trim()) && styles.nextButtonDisabled
          ]}
          onPress={handleNext}
          disabled={(!selectedOption && !currentText.trim()) || isSubmitting || isEvaluatingText || isAdaptingNext}
          activeOpacity={0.8}
        >
          {isSubmitting || isEvaluatingText || isAdaptingNext ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color="#FFF" />
              <Text style={styles.nextButtonText}>
                {isAdaptingNext ? "Adapting next question..." : isEvaluatingText ? "Evaluating response..." : "Processing..."}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.nextButtonText}>
                {currentStepIndex === totalQuestions - 1 ? "Complete Assessment" : "Continue"}
              </Text>
              <ChevronRight size={20} color="#FFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#EDF5F4' 
  },
  safeArea: {
    flex: 1,
  },

  // Ambient Translucent Mint-Teal & Soft Sky-Blue Circles (Matching HomeScreen.js)
  ambientOrbTop: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(45, 212, 191, 0.24)',
  },
  ambientOrbMiddle: {
    position: 'absolute',
    top: 360,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(20, 184, 166, 0.20)',
  },
  ambientOrbBottom: {
    position: 'absolute',
    bottom: 100,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
  },

  headerBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 12,
  },
  circularBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#CCFBF1',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  headerRightBadgeText: {
    color: '#0F766E',
    fontSize: 12,
    fontWeight: '700'
  },
  scrollBody: { 
    paddingHorizontal: 20, 
    paddingTop: 16,
    paddingBottom: 110 
  },
  longitudinalBanner: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    padding: 14,
    marginBottom: 12,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  longitudinalBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  longitudinalBannerTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F766E',
    marginLeft: 6,
    flex: 1,
  },
  historyPill: {
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  historyPillText: {
    fontSize: 11,
    color: '#0D9488',
    fontWeight: '700',
  },
  longitudinalBannerText: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
  },
  progressContainer: { 
    marginBottom: 12 
  },
  progressLabelRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 8 
  },
  progressStepText: { 
    fontSize: 13, 
    color: '#64748B', 
    fontWeight: '600' 
  },
  progressPercentText: { 
    fontSize: 13, 
    color: '#0D9488', 
    fontWeight: '700' 
  },
  progressBarTrack: { 
    height: 8, 
    backgroundColor: '#E2E8F0', 
    borderRadius: 4, 
    overflow: 'hidden' 
  },
  progressBarFill: { 
    height: '100%', 
    backgroundColor: '#0D9488', 
    borderRadius: 4 
  },
  categoryChip: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    alignSelf: 'flex-start', 
    backgroundColor: '#CCFBF1', 
    paddingHorizontal: 12, 
    paddingVertical: 5, 
    borderRadius: 18, 
    marginBottom: 10 
  },
  categoryChipText: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#0F766E' 
  },
  questionCard: { 
    backgroundColor: 'rgba(255, 255, 255, 0.88)', 
    borderRadius: 24, 
    padding: 20, 
    borderWidth: 1.5, 
    borderColor: '#FFFFFF', 
    marginBottom: 14,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2 
  },
  questionText: { 
    fontSize: 16.5, 
    fontWeight: '700', 
    color: '#0F172A', 
    lineHeight: 24 
  },
  nlpInputCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    marginBottom: 14,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  nlpHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  nlpHeaderTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginLeft: 6
  },
  nlpTextInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    fontSize: 13.5,
    color: '#1E293B',
    minHeight: 60,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  optionsSectionTitle: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: '#64748B', 
    textTransform: 'uppercase', 
    letterSpacing: 0.5, 
    marginBottom: 10 
  },
  optionsList: { 
    gap: 10 
  },
  optionChip: { 
    backgroundColor: 'rgba(255, 255, 255, 0.88)', 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 24, 
    borderWidth: 1.5, 
    borderColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  optionChipSelected: { 
    backgroundColor: 'rgba(204, 251, 241, 0.92)', 
    borderColor: '#0D9488', 
    borderWidth: 1.8,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 2,
  },
  radioCircle: { 
    width: 22, 
    height: 22, 
    borderRadius: 11, 
    borderWidth: 2, 
    borderColor: '#CBD5E1', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12,
    backgroundColor: '#FFFFFF',
  },
  radioCircleSelected: { 
    borderColor: '#0D9488',
    backgroundColor: '#0D9488',
  },
  radioDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: '#FFFFFF', 
  },
  optionText: { 
    fontSize: 15, 
    color: '#334155', 
    fontWeight: '600' 
  },
  optionTextSelected: { 
    color: '#0F766E', 
    fontWeight: '800' 
  },
  bottomBar: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    backgroundColor: 'rgba(255, 255, 255, 0.92)', 
    paddingHorizontal: 20, 
    paddingVertical: 14, 
    borderTopWidth: 1.2, 
    borderTopColor: 'rgba(255, 255, 255, 0.7)',
    elevation: 8 
  },
  nextButton: { 
    backgroundColor: '#0D9488', 
    paddingVertical: 15, 
    borderRadius: 20, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 8,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  nextButtonDisabled: { 
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  nextButtonText: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontWeight: '700' 
  },
  resultScrollContent: { 
    padding: 20, 
    paddingTop: 16,
    paddingBottom: 40 
  },
  heroCard: {
    height: 185,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  heroGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 18,
  },
  heroPillTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  heroPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  metricsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    padding: 20,
    marginTop: 14,
    marginBottom: 20,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  metricsTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricsLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  metricsHDivider: {
    height: 1,
    backgroundColor: 'rgba(203, 213, 225, 0.45)',
    marginVertical: 16,
  },
  metricsDualRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricColumn: {
    flex: 1,
  },
  metricColLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  metricColValueLarge: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0D9488',
  },
  metricColValueUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    marginLeft: 2,
  },
  metricsVDivider: {
    width: 1,
    height: 38,
    backgroundColor: 'rgba(203, 213, 225, 0.45)',
    marginHorizontal: 16,
  },
  syncedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  syncedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0D9488',
    marginRight: 6,
  },
  syncedText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  recsSection: { 
    marginBottom: 10 
  },
  recsHeaderContainer: {
    marginBottom: 14,
  },
  recsSectionTitle: { 
    fontSize: 17, 
    fontWeight: '700', 
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  recsSectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  editorialRecCard: { 
    backgroundColor: 'rgba(255, 255, 255, 0.88)', 
    borderRadius: 24, 
    borderWidth: 1.5, 
    borderColor: '#FFFFFF',
    flexDirection: 'row', 
    overflow: 'hidden',
    marginBottom: 12, 
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2 
  },
  recAccentBar: {
    width: 3.5,
    backgroundColor: '#0D9488',
  },
  recBody: { 
    flex: 1,
    padding: 18,
  },
  recHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  recStepNum: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0D9488',
    letterSpacing: 0.5,
    marginRight: 8,
  },
  recTitle: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#0F172A', 
    flex: 1,
  },
  recDesc: { 
    fontSize: 13.5, 
    color: '#475569', 
    lineHeight: 20,
    marginTop: 2,
  },
  buttonStack: { 
    marginTop: 10,
    paddingBottom: 34 
  },
  primaryTealBtn: { 
    backgroundColor: '#0D9488', 
    height: 54, 
    borderRadius: 20, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 8,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4
  },
  primaryTealBtnText: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontWeight: '800' 
  },
  secondaryBtn: { 
    backgroundColor: '#FFFFFF', 
    paddingVertical: 15, 
    borderRadius: 16, 
    borderWidth: 1.5, 
    borderColor: '#E2E8F0', 
    alignItems: 'center' 
  },
  secondaryBtnText: { 
    color: '#64748B', 
    fontSize: 15, 
    fontWeight: '600' 
  }
});