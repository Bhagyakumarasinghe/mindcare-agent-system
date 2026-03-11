import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Backend එක run වන නිවැරදි IP එක (ඔයාගේ IPv4 එක)
const API_URL = 'http://10.32.239.156:8000'; 

const authClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 1. Register User
 */
export const registerUser = async (fullName, email, password) => {
  return await authClient.post('/auth/register', {
    name: fullName, 
    email: email,
    password: password,
  });
};

/**
 * 2. Send OTP
 */
export const sendOTP = async (email) => {
  return await authClient.post(`/auth/send-otp?email=${encodeURIComponent(email)}`);
};

/**
 * 3. Verify OTP
 */
export const verifyOTP = async (email, otpCode) => {
  return await authClient.post(`/auth/verify-otp?email=${encodeURIComponent(email)}&otp=${otpCode}`);
};

/**
 * 4. Login User
 */
export const loginUser = async (email, password) => {
  return await authClient.post('/auth/login', {
    email: email, 
    password: password,
  });
};

/**
 * 5. Get User Profile
 */
export const getUserProfile = async (token) => {
  return await authClient.get('/user/me', {
    headers: {
      Authorization: `Bearer ${token}`, 
    },
  });
};

/**
 * 6. Update User Profile
 */
export const updateProfile = async (updatedData) => {
  const token = await AsyncStorage.getItem('userToken');
  return await authClient.put('/user/update', updatedData, {
    headers: {
      Authorization: `Bearer ${token}`, 
    },
  });
};

/**
 * 7. Update Notification Preference (අලුතින් එක් කළා)
 * Switch එක ක්‍රියාත්මක කරන විට Database එක update කිරීමට මෙය භාවිතා වේ.
 */
export const updateNotificationSettings = async (enabled) => {
  const token = await AsyncStorage.getItem('userToken');
  return await authClient.put(`/user/update-notifications?enabled=${enabled}`, {}, {
    headers: {
      Authorization: `Bearer ${token}`, 
    },
  });
};

/**
 * 8. Export My Data
 */
export const exportData = async () => {
  const token = await AsyncStorage.getItem('userToken');
  return await authClient.get('/user/export', {
    headers: {
      Authorization: `Bearer ${token}`, 
    },
  });
};

/**
 * 9. Logout User
 */
export const logoutUser = async () => {
  const token = await AsyncStorage.getItem('userToken');
  return await authClient.post('/user/logout', {}, {
    headers: {
      Authorization: `Bearer ${token}`, 
    },
  });
};

/**
 * 10. Delete Account
 */
export const deleteAccount = async () => {
  const token = await AsyncStorage.getItem('userToken');
  return await authClient.delete('/user/delete', {
    headers: {
      Authorization: `Bearer ${token}`, 
    },
  });
};