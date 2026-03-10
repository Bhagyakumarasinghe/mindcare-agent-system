import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { registerUser, sendOTP } from '../api/authService'; // sendOTP එකත් import කරන්න

export default function SignupScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); // Loading state එකක් එකතු කළා

  const handleSignup = async () => {
    // 1. Validation
    if (!fullName || !email || !password) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      // 2. Register User (Backend: /auth/register)
      const regResponse = await registerUser(fullName, email, password);
      
      if (regResponse.status === 200 || regResponse.status === 201) {
        // 3. Register සාර්ථක නම් OTP එකක් යවන්න (Backend: /auth/send-otp)
        try {
          await sendOTP(email);
          Alert.alert("Success", "Account created! OTP has been sent to your email.");
          navigation.navigate('OTP', { email: email }); 
        } catch (otpError) {
          Alert.alert("Notice", "Account created but failed to send OTP. Please try Resend OTP.");
          navigation.navigate('OTP', { email: email });
        }
      }
    } catch (error) {
      // Backend එකෙන් එන වැරදි පණිවිඩය පෙන්වීම
      const errorMessage = error.response?.data?.detail || "Registration failed";
      Alert.alert("Signup Failed", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join MindCare to start your journey</Text>

        <TextInput 
          style={styles.input} 
          placeholder="Full Name" 
          placeholderTextColor="#9CA3AF"
          value={fullName}
          onChangeText={setFullName} 
        />
        <TextInput 
          style={styles.input} 
          placeholder="University Email" 
          placeholderTextColor="#9CA3AF"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail} 
        />
        <TextInput 
          style={styles.input} 
          placeholder="Password" 
          placeholderTextColor="#9CA3AF"
          secureTextEntry 
          value={password}
          onChangeText={setPassword} 
        />

        <TouchableOpacity 
          style={[styles.button, loading && { opacity: 0.7 }]} 
          onPress={handleSignup}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Sign Up</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.footerText}>
            Already have an account? <Text style={styles.link}>Login</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 30, justifyContent: 'center', flexGrow: 1 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1F2937', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6B7280', marginBottom: 30 },
  input: { 
    backgroundColor: '#F9FAFB', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: '#E5E7EB', 
    fontSize: 16,
    color: '#1F2937'
  },
  button: { 
    backgroundColor: '#4F75FF', 
    paddingVertical: 18, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 10,
    elevation: 2,
    shadowColor: '#4F75FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  footerText: { textAlign: 'center', marginTop: 25, color: '#6B7280', fontSize: 15 },
  link: { color: '#4F75FF', fontWeight: 'bold' }
});