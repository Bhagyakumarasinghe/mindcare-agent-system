import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://10.152.23.156:8000'; 

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

/** * ✅ OTP FUNCTIONS (අලුතින් එක්කළා)
 * Backend එකේ Body(...) බලාපොරොත්තු වන නිසා JSON Object එකක් ලෙස යවයි.
 */
export const verifyOTP = (email, otp) => authClient.post('/auth/verify-otp', { email, otp });
export const sendOTP = (email) => authClient.post('/auth/send-otp', { email });

// --- PROFILE & AI FUNCTIONS ---
export const getUserProfile = () => authClient.get('/user/me');
export const updateProfile = (updatedData) => authClient.put('/user/update', updatedData);
export const getUserAnalytics = () => authClient.get('/user/analytics');
export const exportData = () => authClient.get('/user/export');
export const logoutUser = () => authClient.post('/user/logout');

export const getNextQuestion = (history = []) => authClient.post('/user/assessment/next-question', { history });
export const sendChatMessage = (message, history = []) => authClient.post('/user/chat', { message, history });

export default authClient;