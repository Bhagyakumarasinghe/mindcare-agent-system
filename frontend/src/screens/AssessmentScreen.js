import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CheckCircle2, Send } from 'lucide-react-native';

// ✅ නිවැරදි API Service එක Import කරගන්න (දැන් getNextQuestion පාවිච්චි කරනවා)
import { getNextQuestion } from '../api/authService';

const AssessmentScreen = ({ navigation }) => {
  const [currentQuestion, setCurrentQuestion] = useState("Hi! I'm your MindCare assistant. To start our check-in, how has your mood been over the last few days?");
  const [history, setHistory] = useState([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [totalScore, setTotalScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [aiLabel, setAiLabel] = useState("");
  const [textAnswer, setTextAnswer] = useState("");

  const maxSteps = 5;
  const progressPercent = (currentStep / maxSteps) * 100;
  
  const options = [
    { label: 'Never', points: 0 },
    { label: 'Rarely', points: 1 },
    { label: 'Sometimes', points: 2 },
    { label: 'Often', points: 3 },
    { label: 'Always', points: 4 },
  ];

  const fallbackQuestions = [
    "How has your sleep quality been over the past few nights?",
    "Are you feeling overwhelmed by your academic workload?",
    "Have you been able to spend time with friends or family lately?",
    "How is your energy level usually by the end of the day?",
    "Have you been finding it hard to focus on your studies recently?"
  ];

  const submitAnswer = async (label, points = 0) => {
    if (isLoading || (!label && !textAnswer)) return;

    const finalAnswer = label || textAnswer;
    const pointsToAdd = (!label && textAnswer) ? 2 : points;
    
    // ✅ Backend (assessment_agent.py) එක බලාපොරොත්තු වන format එක: {question, answer}
    const newEntry = { question: currentQuestion, answer: finalAnswer };
    const updatedHistory = [...history, newEntry];

    setHistory(updatedHistory);
    setIsLoading(true);
    setTextAnswer("");

    try {
      // ✅ අලුතින් හදාගත්තු /user/assessment/next-question endpoint එක call කිරීම
      const response = await getNextQuestion(updatedHistory);
      const data = response.data;

      console.log("DEBUG ASSESSMENT DATA:", data);

      if (data.status === "success") {
        let nextQ = data.question;

        // ✅ FINISH string එක ඇත්නම් assessment එක අවසන් කිරීම
        if (nextQ && nextQ.includes("FINISH")) {
          const parts = nextQ.split("|");
          setTotalScore(parseInt(parts[1]?.trim()) || 5);
          setAiLabel(parts[2]?.trim() || "Assessment Completed");
          setIsFinished(true);
        } else if (nextQ) {
          setCurrentQuestion(nextQ); 
          setCurrentStep(updatedHistory.length + 1);
          setTotalScore(prev => prev + pointsToAdd);
        }
      } else {
        throw new Error("Assessment API Error");
      }
    } catch (error) {
      console.log("Assessment Fallback Applied:", error);
      if (updatedHistory.length >= maxSteps) {
        setIsFinished(true);
      } else {
        // API Error එකක් ආවොත් fallbackQuestions පෙන්වීම
        setCurrentQuestion(fallbackQuestions[updatedHistory.length]);
        setCurrentStep(updatedHistory.length + 1);
        setTotalScore(prev => prev + pointsToAdd);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isFinished) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultContainer}>
          <CheckCircle2 size={80} color="#22C55E" />
          <Text style={styles.resultTitle}>Check-in Complete</Text>
          <Text style={styles.scoreText}>Stress Score: {totalScore}/10</Text>
          <Text style={styles.aiLabelText}>{aiLabel}</Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.doneBtnText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <ArrowLeft size={20} color="#4F75FF" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.progressPercentText}>{Math.round(progressPercent)}%</Text>
          </View>

          <View style={styles.progressBarContainer}>
            <Text style={styles.questionCounter}>{`MindCare Assessment: Step ${Math.min(currentStep, maxSteps)} of ${maxSteps}`}</Text>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${Math.min(progressPercent, 100)}%` }]} />
            </View>
          </View>

          <View style={styles.questionCard}>
            {isLoading ? (
              <ActivityIndicator size="large" color="#4F75FF" />
            ) : (
              <Text style={styles.questionText}>{currentQuestion}</Text>
            )}
          </View>

          <Text style={styles.sectionLabel}>Quick Select:</Text>
          <View style={styles.optionsContainer}>
            {options.map((opt, i) => (
              <TouchableOpacity key={i} style={styles.optionButton} onPress={() => submitAnswer(opt.label, opt.points)} disabled={isLoading}>
                <Text style={styles.optionLabel}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Type your response here..."
              value={textAnswer}
              onChangeText={setTextAnswer}
              multiline
              editable={!isLoading}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={() => submitAnswer()} disabled={isLoading}>
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
  scrollContent: { padding: 25 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: '#4F75FF', marginLeft: 8 },
  progressPercentText: { color: '#4F75FF' },
  progressBarContainer: { marginBottom: 20 },
  questionCounter: { fontSize: 13, color: '#94A3B8', marginBottom: 8 },
  progressBarBackground: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3 },
  progressBarFill: { height: 6, backgroundColor: '#4F75FF', borderRadius: 3 },
  questionCard: { backgroundColor: '#F8FAFC', padding: 25, borderRadius: 20, marginBottom: 20, minHeight: 140, justifyContent: 'center', elevation: 1 },
  questionText: { fontSize: 18, color: '#1E293B', fontWeight: '500', lineHeight: 26 },
  sectionLabel: { fontSize: 12, color: '#94A3B8', fontWeight: 'bold', marginBottom: 10 },
  optionsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  optionButton: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFF' },
  optionLabel: { color: '#4F75FF', fontWeight: '600' },
  inputContainer: { flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 15, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  textInput: { flex: 1, paddingHorizontal: 10, minHeight: 40 },
  sendBtn: { backgroundColor: '#4F75FF', padding: 10, borderRadius: 12 },
  resultContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  resultTitle: { fontSize: 26, fontWeight: 'bold', marginTop: 20, color: '#22C55E' },
  scoreText: { fontSize: 18, color: '#64748B', marginTop: 10 },
  aiLabelText: { fontSize: 16, color: '#4F75FF', textAlign: 'center', marginTop: 10, paddingHorizontal: 20 },
  doneBtn: { backgroundColor: '#4F75FF', padding: 18, borderRadius: 15, width: '100%', alignItems: 'center', marginTop: 30 },
  doneBtnText: { color: '#FFF', fontWeight: 'bold' }
});

export default AssessmentScreen;