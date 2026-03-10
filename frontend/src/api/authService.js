import axios from 'axios';

// Backend එක run වන නිවැරදි IP එක (ඔයාගේ වර්තමාන IPv4 එක)
const API_URL = 'http://10.32.239.156:8000'; 

const authClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 1. Register User
 * Backend Route: @router.post("/register")
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
 * Backend Route: @router.post("/send-otp")
 */
export const sendOTP = async (email) => {
  return await authClient.post(`/auth/send-otp?email=${encodeURIComponent(email)}`);
};

/**
 * 3. Verify OTP
 * Backend Route: @router.post("/verify-otp")
 */
export const verifyOTP = async (email, otpCode) => {
  return await authClient.post(`/auth/verify-otp?email=${encodeURIComponent(email)}&otp=${otpCode}`);
};

/**
 * 4. Login User
 * Backend Route: @router.post("/login")
 */
export const loginUser = async (email, password) => {
  return await authClient.post('/auth/login', {
    email: email, 
    password: password,
  });
};

/**
 * 5. Get User Profile (මේ කොටස අනිවාර්යයෙන් තිබිය යුතුයි)
 * Backend Route: @router.get("/me")
 * Dashboard එකේ නම පෙන්වීමට මෙය භාවිතා කරයි.
 */
export const getUserProfile = async (token) => {
  return await authClient.get('/user/me', {
    headers: {
      // ලොගින් වීමේදී ලැබුණු JWT Token එක මෙහිදී header එකක් ලෙස යවයි
      Authorization: `Bearer ${token}`, 
    },
  });
};