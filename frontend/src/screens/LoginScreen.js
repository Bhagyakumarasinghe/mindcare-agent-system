import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage'; // මෙය අලුතින් එකතු කළා
import { loginUser } from '../api/authService';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const response = await loginUser(email, password);
      
      if (response.status === 200) {
        // ඉතාමත් වැදගත්: ලැබෙන access_token එක AsyncStorage වල සේව් කිරීම
        // response.data.access_token යනු ඔයාගේ Backend එකෙන් එන නම විය යුතුයි.
        const token = response.data.access_token; 
        await AsyncStorage.setItem('userToken', token); 

        Alert.alert("Success", "Welcome back!");
        navigation.navigate('Main'); 
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || "Invalid email or password";
      Alert.alert("Login Failed", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue your journey</Text>

        <TextInput 
          style={styles.input} 
          placeholder="Email Address" 
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
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => navigation.navigate('Signup')}
          style={styles.footerLink}
        >
          <Text style={styles.footerText}>
            Don't have an account? <Text style={styles.link}>Sign Up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1, padding: 30, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#1F2937', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6B7280', marginBottom: 40 },
  input: { 
    backgroundColor: '#F9FAFB', 
    padding: 18, 
    borderRadius: 15, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: '#E5E7EB',
    fontSize: 16,
    color: '#1F2937'
  },
  button: { 
    backgroundColor: '#4F75FF', 
    paddingVertical: 18, 
    borderRadius: 15, 
    alignItems: 'center',
    marginTop: 10,
    elevation: 3,
    shadowColor: '#4F75FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  footerLink: { marginTop: 25, alignItems: 'center' },
  footerText: { color: '#6B7280', fontSize: 15 },
  link: { color: '#4F75FF', fontWeight: 'bold' }
});