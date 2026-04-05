import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CheckCircle2, Send } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AssessmentScreen = ({ navigation }) => {
  const [currentQuestion, setCurrentQuestion] = useState("Hi! How has your mood been over the last few days?");
  const [history, setHistory] = useState([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [totalScore, setTotalScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [aiLabel, setAiLabel] = useState("");
  const [textAnswer, setTextAnswer] = useState(""); // Text input එක සඳහා state එක

  const maxSteps = 5;
  const progressPercent = (currentStep / maxSteps) * 100;

  const options = [
    { label: 'Never', points: 0 },
    { label: 'Rarely', points: 1 },
    { label: 'Sometimes', points: 2 },
    { label: 'Often', points: 3 },
    { label: 'Always', points: 4 },
  ];

  // --- Common Submit Function ---
  const submitAnswer = async (label, points = 0) => {
    if (isLoading || (!label && !textAnswer)) return;

    const finalAnswer = label || textAnswer;
    const newScore = totalScore + points;
    setTotalScore(newScore);

    const updatedHistory = [...history, { question: currentQuestion, answer: finalAnswer }];
    setHistory(updatedHistory);
    setIsLoading(true);
    setTextAnswer(""); // Input එක clear කිරීම

    try {
      const token = await AsyncStorage.getItem('userToken'); 
      const response = await fetch('http://10.32.239.156:8000/user/assessment/next-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ history: updatedHistory })
      });

      if (!response.ok) throw new Error("Server error");
      const data = await response.json();

      if (data.question.includes("FINISH")) {
        const parts = data.question.split("|");
        setAiLabel(parts[2]?.trim() || "Assessment Complete");
        setIsFinished(true);
      } else {
        setCurrentQuestion(data.question);
        setCurrentStep(prev => prev + 1);
      }
    } catch (error) {
      Alert.alert("Connection Error", "Check your backend connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const getFeedback = () => {
    if (totalScore <= 5) return { title: "Doing Great!", msg: "Your wellbeing seems stable.", color: "#22C55E" };
    if (totalScore <= 12) return { title: "Mild Stress", msg: "You're feeling a bit overwhelmed.", color: "#EAB308" };
    return { title: "High Tension", msg: "Consider talking to a professional.", color: "#EF4444" };
  };

  const feedback = getFeedback();

  if (isFinished) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultContainer}>
          <CheckCircle2 size={80} color={feedback.color} />
          <Text style={[styles.resultTitle, { color: feedback.color }]}>{feedback.title}</Text>
          <Text style={styles.scoreText}>Your Final Score: {totalScore}</Text>
          <Text style={styles.aiLabelText}>Condition: {aiLabel}</Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.doneBtnText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <ArrowLeft size={20} color="#4F75FF" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.progressPercentText}>{Math.min(Math.round(progressPercent), 100)}%</Text>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <Text style={styles.questionCounter}>{`Adaptive Step: ${currentStep}`}</Text>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${Math.min(progressPercent, 100)}%` }]} />
            </View>
          </View>

          {/* Question Card */}
          <View style={styles.questionCard}>
            {isLoading ? (
              <ActivityIndicator size="large" color="#4F75FF" />
            ) : (
              <>
                <Text style={styles.questionTimeFrame}>MindCare asks...</Text>
                <Text style={styles.questionText}>{currentQuestion}</Text>
              </>
            )}
          </View>

          {/* Options (Quick Buttons) */}
          <Text style={styles.sectionLabel}>Quick Select:</Text>
          <View style={styles.optionsContainer}>
            {options.map((option, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.optionButton}
                onPress={() => submitAnswer(option.label, option.points)}
                disabled={isLoading}
              >
                <Text style={styles.optionLabel}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* OR Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR DESCRIBE</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Text Input Area */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Describe how you feel..."
              multiline
              value={textAnswer}
              onChangeText={setTextAnswer}
              placeholderTextColor="#94A3B8"
            />
            <TouchableOpacity 
              style={[styles.sendBtn, !textAnswer && { backgroundColor: '#CBD5E1' }]} 
              onPress={() => submitAnswer()}
              disabled={!textAnswer || isLoading}
            >
              <Send size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { paddingHorizontal: 25, paddingBottom: 50 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 15 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: '#4F75FF', fontSize: 16, marginLeft: 8 },
  progressPercentText: { color: '#4F75FF', fontSize: 14, fontWeight: '500' },
  progressBarContainer: { marginBottom: 20 },
  questionCounter: { fontSize: 14, color: '#94A3B8', marginBottom: 10 },
  progressBarBackground: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: 6, backgroundColor: '#4F75FF' },
  questionCard: { backgroundColor: '#F8FAFC', padding: 25, borderRadius: 24, marginBottom: 20, elevation: 1, minHeight: 140, justifyContent: 'center' },
  questionTimeFrame: { fontSize: 14, fontWeight: 'bold', color: '#4F75FF', marginBottom: 8 },
  questionText: { fontSize: 17, color: '#1E293B', lineHeight: 24, fontWeight: '500' },
  sectionLabel: { fontSize: 12, color: '#94A3B8', fontWeight: 'bold', marginBottom: 10, textTransform: 'uppercase' },
  optionsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  optionButton: { backgroundColor: '#FFFFFF', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  optionLabel: { color: '#4F75FF', fontSize: 14, fontWeight: '600' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { marginHorizontal: 10, fontSize: 10, color: '#94A3B8', fontWeight: 'bold' },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#F8FAFC', borderRadius: 20, padding: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  textInput: { flex: 1, minHeight: 45, maxHeight: 100, paddingHorizontal: 10, color: '#1E293B', fontSize: 15 },
  sendBtn: { backgroundColor: '#4F75FF', width: 45, height: 45, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  
  // Result styles
  resultContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  resultTitle: { fontSize: 24, fontWeight: 'bold', marginTop: 20 },
  scoreText: { fontSize: 16, color: '#64748B', marginTop: 8 },
  aiLabelText: { fontSize: 16, color: '#4F75FF', marginTop: 4, fontWeight: '600' },
  doneBtn: { backgroundColor: '#4F75FF', paddingVertical: 16, borderRadius: 16, width: '100%', alignItems: 'center', marginTop: 30 },
  doneBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});

export default AssessmentScreen;