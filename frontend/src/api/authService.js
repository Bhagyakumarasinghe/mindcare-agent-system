import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://10.234.214.156:8000'; 

const authClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

authClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('userToken');
    if (token) { config.headers.Authorization = `Bearer ${token}`; }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- AUTH FUNCTIONS ---
export const loginUser = (email, password) => authClient.post('/auth/login', { email, password });
export const registerUser = (fullName, email, password) => authClient.post('/auth/register', { name: fullName, email, password });

// --- OTP VERIFICATION ---
export const verifyOTP = (email, otp) => authClient.post('/auth/verify-otp', { email, otp });
export const sendOTP = (email) => authClient.post('/auth/send-otp', { email });

// --- PROFILE & ANALYTICS ---
export const getUserProfile = () => authClient.get('/user/me');
export const updateProfile = (updatedData) => authClient.put('/user/update', updatedData);
export const getUserAnalytics = () => authClient.get('/user/analytics');
export const getUserSummary = () => authClient.get('/user/summary');
export const getWeeklyReport = (userId) => authClient.get('/api/reports/weekly', { params: { user_id: userId } });
export const logMoodEntry = (data) => authClient.post('/user/mood-log', data);
export const exportData = () => authClient.get('/user/export');
export const logoutUser = () => authClient.post('/user/logout');

// --- CONVERSATIONAL CHAT (GEMINI) ---
export const getNextQuestion = (payload = {}, config = {}) => authClient.post(
  '/user/assessment/next-question', 
  typeof payload === 'object' && !Array.isArray(payload) ? payload : { history: payload },
  { timeout: 16000, ...config }
);
export const sendChatMessage = (message, history = []) => authClient.post('/user/chat', { message, history });

// --- ADAPTIVE ASSESSMENT & NLP EVALUATION ---
export const getAssessmentContext = () => authClient.get('/user/assessment/context');
export const evaluateAssessmentResponse = (data) => authClient.post('/user/assessment/evaluate-response', data);

// --- ML STRESS INFERENCE & NEO4J INTEGRATION ---
export const predictAndRecordStress = (data) => authClient.post('/api/ml/predict-and-record', data);
export const getGeminiRecommendations = (data) => authClient.post('/api/ml/recommendations', data);

// --- AI JOURNALING & LONGITUDINAL EMOTION ANALYTICS ---
export const analyzeAndRecordJournal = (data) => authClient.post('/api/journal/analyze-and-record', data);
export const getJournalSummary = (userId) => authClient.get(`/api/analytics/journal-summary?user_id=${encodeURIComponent(userId)}`);
export const getJournalHistory = (userId, limit = 20) => authClient.get('/api/journal/history', { params: { user_id: userId, limit } });

// --- ACADEMIC RESILIENCE & COGNITIVE PACING ---
export const getAcademicPacing = (userId) => authClient.get('/api/academic/pacing', { params: { user_id: userId } });
export const getAcademicSubjects = (userId) => authClient.get('/api/academic/subjects', { params: { user_id: userId } });
export const createAcademicSubject = (data) => authClient.post('/api/academic/subjects', data);
export const getAcademicRecommendation = (userId) => authClient.get('/api/academic/recommendation', { params: { user_id: userId } });
export const toggleSubjectTopic = (data) => authClient.post('/api/academic/topics/toggle', data);
export const toggleTopicById = (topicId) => authClient.patch(`/api/academic/topics/${topicId}/toggle`);
export const deleteAcademicSubject = (subjectId) => authClient.delete(`/api/academic/subjects/${subjectId}`);

// --- ACTIVITY & WELLNESS TELEMETRY ---
export const logActivity = (data) => authClient.post('/api/analytics/activity-log', data);
export const getDailyTip = (userId) => authClient.get('/user/daily-tip', { params: userId ? { user_id: userId } : {} });

// --- ACADEMIC AGENT SERVICES & CBT REFRAMING ---
export const decomposeAcademicTask = (userId, subjectId, assignmentText) =>
  authClient.post('/api/agent/decompose-task', { user_id: userId, subject_id: subjectId, assignment_text: assignmentText });
export const sendCBTChatMessage = (userId, message, contextChip = null) =>
  authClient.post('/api/agent/cbt-chat', {
    user_id: userId,
    context_chip: contextChip || message,
    message: message,
  });

export default authClient;