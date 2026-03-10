import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { verifyOTP, sendOTP } from '../api/authService'; // sendOTP එකත් import කරන්න

export default function OTPScreen({ navigation, route }) {
  const { email } = route.params; 
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async () => {
    if (otpCode.length < 6) {
      Alert.alert("Error", "Please enter the 6-digit code.");
      return;
    }

    setLoading(true);
    try {
      // Backend: /auth/verify-otp?email=...&otp=...
      const response = await verifyOTP(email, otpCode);
      if (response.status === 200) {
        Alert.alert("Success", "Account verified successfully!");
        navigation.navigate('Login');
      }
    } catch (error) {
      const msg = error.response?.data?.detail || "Invalid or expired OTP";
      Alert.alert("Verification Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await sendOTP(email);
      Alert.alert("Success", "A new OTP has been sent to your email.");
    } catch (error) {
      Alert.alert("Error", "Could not resend OTP. Try again later.");
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Verification</Text>
        <Text style={styles.subtitle}>Enter the 6-digit code sent to:</Text>
        <Text style={styles.emailText}>{email}</Text>

        <TextInput 
          style={styles.otpInput} 
          placeholder="000000" 
          placeholderTextColor="#D1D5DB"
          keyboardType="numeric"
          maxLength={6} // අංක 6ක් පමණයි
          value={otpCode}
          onChangeText={setOtpCode}
        />

        <TouchableOpacity 
          style={[styles.button, loading && { opacity: 0.7 }]} 
          onPress={handleVerify}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Verify & Proceed</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleResend} disabled={resending} style={styles.resendContainer}>
          <Text style={styles.resendText}>
            Didn't receive code? {resending ? <ActivityIndicator size="small" color="#4F75FF" /> : <Text style={styles.link}>Resend OTP</Text>}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1, padding: 30, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 30, fontWeight: 'bold', color: '#1F2937', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#6B7280', textAlign: 'center' },
  emailText: { fontSize: 16, color: '#1F2937', fontWeight: '600', marginBottom: 40 },
  otpInput: { 
    backgroundColor: '#F3F4F6', 
    width: '100%', 
    padding: 20, 
    borderRadius: 15, 
    textAlign: 'center', 
    fontSize: 32, 
    fontWeight: 'bold', 
    letterSpacing: 12, 
    marginBottom: 30,
    color: '#4F75FF',
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  button: { backgroundColor: '#4F75FF', width: '100%', paddingVertical: 18, borderRadius: 15, alignItems: 'center', elevation: 4 },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  resendContainer: { marginTop: 25 },
  resendText: { color: '#6B7280', fontSize: 15 },
  link: { color: '#4F75FF', fontWeight: 'bold' }
});