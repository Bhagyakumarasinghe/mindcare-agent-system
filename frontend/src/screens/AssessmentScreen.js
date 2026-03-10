import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CheckCircle2, RefreshCcw } from 'lucide-react-native';

const AssessmentScreen = ({ navigation }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [totalScore, setTotalScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const questions = [
    "Feeling nervous, anxious, or on edge",
    "Not being able to stop or control worrying",
    "Worrying too much about different things",
    "Trouble relaxing or sitting still",
    "Becoming easily annoyed or irritable",
    "Feeling afraid as if something awful might happen",
    "Trouble falling or staying asleep, or sleeping too much",
    "Feeling tired or having little energy",
    "Poor appetite or overeating",
    "Feeling bad about yourself or that you are a failure"
  ];

  const totalQuestions = questions.length;
  const progressPercent = (currentStep / totalQuestions) * 100;

  const options = [
    { label: 'Never', points: 0 },
    { label: 'Rarely', points: 1 },
    { label: 'Sometimes', points: 2 },
    { label: 'Often', points: 3 },
    { label: 'Always', points: 4 },
  ];

  const handleOptionSelect = (points) => {
    setTotalScore(totalScore + points);
    if (currentStep < totalQuestions) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsFinished(true);
    }
  };

  // Score එක අනුව Feedback එක තීරණය කිරීම
  const getFeedback = () => {
    if (totalScore <= 10) return { 
      title: "Doing Great!", 
      msg: "Your mental wellbeing seems stable. Keep up your healthy routines!", 
      color: "#22C55E" 
    };
    if (totalScore <= 20) return { 
      title: "Mild Stress", 
      msg: "You're feeling a bit overwhelmed. Try some breathing exercises in our 'Relax' section.", 
      color: "#EAB308" 
    };
    if (totalScore <= 30) return { 
      title: "Moderate Anxiety", 
      msg: "It might be helpful to talk to our AI Agent or a friend about what's on your mind.", 
      color: "#F97316" 
    };
    return { 
      title: "High Tension", 
      msg: "You're going through a tough time. Please consider professional support or speak with a counselor.", 
      color: "#EF4444" 
    };
  };

  const feedback = getFeedback();

  if (isFinished) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultContainer}>
          <CheckCircle2 size={80} color={feedback.color} />
          <Text style={[styles.resultTitle, { color: feedback.color }]}>{feedback.title}</Text>
          <Text style={styles.scoreText}>Your Score: {totalScore} / 40</Text>
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackMsg}>{feedback.msg}</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.doneBtn} 
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.doneBtnText}>Back to Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.retryBtn} 
            onPress={() => {
              setCurrentStep(1);
              setTotalScore(0);
              setIsFinished(false);
            }}
          >
            <RefreshCcw size={18} color="#64748B" />
            <Text style={styles.retryText}>Retake Assessment</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={20} color="#4F75FF" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.progressPercentText}>{Math.round(progressPercent)}%</Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <Text style={styles.questionCounter}>{`Question ${currentStep} of ${totalQuestions}`}</Text>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>

        <View style={styles.aiContextHeader}>
          <Text style={styles.aiContextTitle}>MindCare Wellness Check</Text>
          <Text style={styles.aiContextSubtitle}>Answering honestly helps our AI support you better.</Text>
        </View>

        {/* Question Card */}
        <View style={styles.questionCard}>
          <Text style={styles.questionTimeFrame}>In the past 2 weeks...</Text>
          <Text style={styles.questionText}>{questions[currentStep - 1]}</Text>
        </View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {options.map((option, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.optionButton}
              onPress={() => handleOptionSelect(option.points)}
            >
              <Text style={styles.optionLabel}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { paddingHorizontal: 25, paddingBottom: 50 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 15 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: '#4F75FF', fontSize: 16, marginLeft: 8 },
  progressPercentText: { color: '#4F75FF', fontSize: 14, fontWeight: '500' },
  progressBarContainer: { marginBottom: 30 },
  questionCounter: { fontSize: 14, color: '#94A3B8', marginBottom: 10, fontWeight: '500' },
  progressBarBackground: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: 6, backgroundColor: '#4F75FF' },
  aiContextHeader: { marginBottom: 20, alignItems: 'center' },
  aiContextTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  aiContextSubtitle: { fontSize: 13, color: '#64748B', marginTop: 3, textAlign: 'center' },
  questionCard: { backgroundColor: '#F8FAFC', padding: 30, borderRadius: 24, marginBottom: 30, elevation: 1 },
  questionTimeFrame: { fontSize: 16, fontWeight: 'bold', color: '#4F75FF', marginBottom: 10 },
  questionText: { fontSize: 18, color: '#1E293B', lineHeight: 26, fontWeight: '500' },
  optionsContainer: { gap: 12 },
  optionButton: { backgroundColor: '#FFFFFF', paddingVertical: 18, borderRadius: 18, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  optionLabel: { color: '#1E293B', fontSize: 16, fontWeight: '500' },
  
  // Result Styles
  resultContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  resultTitle: { fontSize: 28, fontWeight: 'bold', marginTop: 20 },
  scoreText: { fontSize: 18, color: '#64748B', marginTop: 10 },
  feedbackCard: { backgroundColor: '#F8FAFC', padding: 25, borderRadius: 20, marginTop: 30, width: '100%', borderWidth: 1, borderColor: '#E2E8F0' },
  feedbackMsg: { fontSize: 16, color: '#1E293B', textAlign: 'center', lineHeight: 24 },
  doneBtn: { backgroundColor: '#4F75FF', paddingVertical: 18, borderRadius: 18, width: '100%', alignItems: 'center', marginTop: 40 },
  doneBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  retryText: { color: '#64748B', marginLeft: 8, fontSize: 14, fontWeight: '500' }
});

export default AssessmentScreen;