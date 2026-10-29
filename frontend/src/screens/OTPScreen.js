import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, StatusBar, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { verifyOTP, sendOTP } from '../api/authService';

export default function OTPScreen({ navigation, route }) {
  const { email } = route.params || {};
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async () => {
    if (otpCode.length < 6) {
      Alert.alert('Incomplete Code', 'Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const response = await verifyOTP(email, otpCode);
      if (response.status === 200) {
        Alert.alert('Verification Successful', 'Your account has been verified. Please sign in.', [
          {
            text: 'Sign In',
            onPress: () => navigation.navigate('Login'),
          },
        ]);
      }
    } catch (error) {
      const msg = error.response?.data?.detail || 'Invalid or expired verification code.';
      Alert.alert('Verification Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await sendOTP(email);
      Alert.alert('Code Dispatched', 'A fresh verification code has been sent to your email.');
    } catch (error) {
      Alert.alert('Error', 'Could not resend verification code. Please try again later.');
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient
        colors={['#0B1120', '#0F172A', '#1E293B']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.logoHalo}>
            <Image
              source={require('../../assets/mindcare-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Account Verification</Text>
            <Text style={styles.subtitle}>Enter the 6-digit code sent to</Text>
            <Text style={styles.emailText}>{email}</Text>

            <TextInput
              style={styles.otpInput}
              placeholder="000000"
              placeholderTextColor="#475569"
              keyboardType="numeric"
              maxLength={6}
              value={otpCode}
              onChangeText={setOtpCode}
            />

            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.75 }]}
              onPress={handleVerify}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.buttonText}>Verify & Proceed</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleResend}
              disabled={resending}
              style={styles.resendContainer}
              activeOpacity={0.7}
            >
              <Text style={styles.resendText}>
                Didn't receive code?{' '}
                {resending ? (
                  <ActivityIndicator size="small" color="#14B8A6" />
                ) : (
                  <Text style={styles.link}>Resend OTP</Text>
                )}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoHalo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(20, 184, 166, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.25)',
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  logo: {
    width: 100,
    height: 100,
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  emailText: {
    fontSize: 15,
    color: '#14B8A6',
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  otpInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 10,
    marginBottom: 20,
    color: '#2DD4BF',
    borderWidth: 1,
    borderColor: '#334155',
  },
  button: {
    backgroundColor: '#0D9488',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  resendContainer: {
    marginTop: 20,
  },
  resendText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  link: {
    color: '#14B8A6',
    fontWeight: '700',
  },
});