import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser, getUserProfile } from '../api/authService';
import GlassAlert, { useGlassAlert } from '../components/GlassAlert';

const { width, height } = Dimensions.get('window');
const bgVideoSource = require('../../assets/videos/background-video-1.mp4');

export default function LoginScreen({ navigation, onNavigateToSignup, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const { alertConfig, showAlert, hideAlert } = useGlassAlert();

  // Smooth visual crossfade mask to hide the video loop boundary
  const loopMaskOpacity = useRef(new Animated.Value(0)).current;

  // Muted Native Loop (Zero audio glitch, smooth visual background)
  const player = useVideoPlayer(bgVideoSource, (player) => {
    player.loop = true;
    player.muted = true;
    player.timeUpdateEventInterval = 0.25;
    player.play();
  });

  // Gentle visual fade right at the loop boundary so there is no harsh frame jump
  useEffect(() => {
    if (!player) return;

    const subscription = player.addListener('timeUpdate', ({ currentTime }) => {
      if (player.duration > 1.5) {
        const remaining = player.duration - currentTime;

        if (remaining <= 0.45) {
          Animated.timing(loopMaskOpacity, {
            toValue: 0.48,
            duration: 250,
            useNativeDriver: true,
          }).start();
        } else if (currentTime <= 0.45) {
          Animated.timing(loopMaskOpacity, {
            toValue: 0,
            duration: 320,
            useNativeDriver: true,
          }).start();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [player]);

  // Pause video when leaving LoginScreen, resume when returning
  useFocusEffect(
    useCallback(() => {
      if (player) {
        player.play();
      }
      return () => {
        if (player) {
          player.pause();
        }
      };
    }, [player])
  );

  // Slow & calming entrance animations
  const headerFadeAnim = useRef(new Animated.Value(0.25)).current;
  const headerSlideAnim = useRef(new Animated.Value(-30)).current;
  const cardFadeAnim = useRef(new Animated.Value(0.25)).current;
  const cardSlideAnim = useRef(new Animated.Value(25)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFadeAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(headerSlideAnim, {
        toValue: 0,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardFadeAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardSlideAnim, {
        toValue: 0,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      showAlert('Missing Fields', 'Please enter both your email address and password.', 'error');
      return;
    }

    setLoading(true);
    try {
      if (onLogin) {
        await onLogin(trimmedEmail, trimmedPassword);
      } else {
        const response = await loginUser(trimmedEmail, trimmedPassword);
        if (response.status === 200 && response.data?.access_token) {
          await AsyncStorage.setItem('userToken', response.data.access_token);

          // Cache user profile immediately upon login for zero-delay display on HomeScreen
          const userPayload = response.data?.user;
          const profileToCache = {
            id: userPayload?.id || '',
            name: userPayload?.full_name || userPayload?.name || '',
            full_name: userPayload?.full_name || userPayload?.name || '',
            email: userPayload?.email || trimmedEmail,
          };
          await AsyncStorage.setItem('@mindcare_cached_profile', JSON.stringify(profileToCache));

          // If backend didn't return full name in login response, hydrate from /user/me in background
          if (!profileToCache.full_name) {
            getUserProfile().then((profRes) => {
              if (profRes?.data) {
                const p = {
                  id: profRes.data.id || profRes.data.user_id || '',
                  name: profRes.data.full_name || profRes.data.name || '',
                  full_name: profRes.data.full_name || profRes.data.name || '',
                  email: profRes.data.email || trimmedEmail,
                };
                AsyncStorage.setItem('@mindcare_cached_profile', JSON.stringify(p));
              }
            }).catch(() => {});
          }

          showAlert(
            'Welcome Back',
            'Successfully signed in to MindCare.',
            [
              {
                text: 'Continue',
                onPress: () => {
                  if (navigation) {
                    navigation.navigate('Main');
                  }
                },
              },
            ],
            'success'
          );
        }
      }
    } catch (error) {
      const errorMsg =
        error.response?.data?.detail ||
        error.message ||
        'Unable to connect to the backend server. Please verify your connection.';
      showAlert('Sign In Failed', errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const goToSignup = () => {
    if (onNavigateToSignup) {
      onNavigateToSignup();
    } else if (navigation) {
      navigation.navigate('Signup');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* 1. Underlying Glass Fallback Image */}
      <Image
        source={require('../../assets/images/onboarding-1.jpg')}
        style={{ position: 'absolute', top: 0, left: 0, width, height }}
        resizeMode="cover"
      />

      {/* 2. Full-Screen Muted Looping Background Video */}
      <VideoView
        player={player}
        style={{ position: 'absolute', top: 0, left: 0, width, height }}
        contentFit="cover"
        nativeControls={false}
        surfaceType="textureView"
      />

      {/* Balanced Soft Veil Overlay (Colors & Motion Shine Through) */}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: 'rgba(15, 23, 42, 0.38)' },
        ]}
      />

      {/* Seamless Loop Crossfade Mask */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: '#0B1120', opacity: loopMaskOpacity },
        ]}
      />

      {/* 2. Foreground Form & Content Container */}
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Highlighted Glassy Pop-Up Logo & Brand Header */}
              <Animated.View
                style={[
                  styles.brandHeader,
                  {
                    opacity: headerFadeAnim,
                    transform: [{ translateY: headerSlideAnim }],
                  },
                ]}
              >
                <View style={styles.logoHalo}>
                  <Image
                    source={require('../../assets/mindcare-logo.png')}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.brandTag}>MINDCARE</Text>
                <Text style={styles.heading}>Welcome Back</Text>
                <Text style={styles.subheading}>
                  Sign in to continue your mental wellness journey
                </Text>
              </Animated.View>

              {/* Translucent Frosted Glass Form Card */}
              <Animated.View
                style={[
                  styles.card,
                  {
                    opacity: cardFadeAnim,
                    transform: [{ translateY: cardSlideAnim }],
                  },
                ]}
              >
                {/* Email Field */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      focusedField === 'email' && styles.inputContainerFocused,
                    ]}
                  >
                    <Mail
                      size={18}
                      color={focusedField === 'email' ? '#2DD4BF' : '#E2E8F0'}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="you@example.com"
                      placeholderTextColor="rgba(255, 255, 255, 0.75)"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={email}
                      onChangeText={setEmail}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                </View>

                {/* Password Field */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>PASSWORD</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      focusedField === 'password' && styles.inputContainerFocused,
                    ]}
                  >
                    <Lock
                      size={18}
                      color={focusedField === 'password' ? '#2DD4BF' : '#E2E8F0'}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your password"
                      placeholderTextColor="rgba(255, 255, 255, 0.75)"
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeButton}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      activeOpacity={0.7}
                    >
                      {showPassword ? (
                        <EyeOff size={19} color="#2DD4BF" />
                      ) : (
                        <Eye size={19} color="#E2E8F0" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Primary Sign In Button */}
                <TouchableOpacity
                  style={[styles.button, loading && { opacity: 0.75 }]}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.88}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.buttonText}>Sign In</Text>
                  )}
                </TouchableOpacity>

                {/* Footer Switch Link */}
                <TouchableOpacity
                  onPress={goToSignup}
                  style={styles.footerLink}
                  activeOpacity={0.7}
                >
                  <Text style={styles.footerText}>
                    Don't have an account?{' '}
                    <Text style={styles.linkText}>Create Account</Text>
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Glassmorphism Alert Modal */}
      <GlassAlert
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={hideAlert}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080D1A',
  },
  safeArea: {
    flex: 1,
    zIndex: 10,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 24 : 16,
    paddingBottom: 32,
    justifyContent: 'center',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoHalo: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.50)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#2DD4BF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  logo: {
    width: 84,
    height: 84,
  },
  brandTag: {
    fontSize: 12,
    fontWeight: '800',
    color: '#5EEAD4',
    letterSpacing: 2.5,
    marginBottom: 6,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 6,
    textAlign: 'center',
  },
  subheading: {
    fontSize: 14,
    color: '#E2E8F0',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.42)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 8,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F1F5F9',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    paddingHorizontal: 16,
    height: 54,
  },
  inputContainerFocused: {
    borderColor: '#2DD4BF',
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 4,
  },
  button: {
    backgroundColor: '#0D9488',
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  footerLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    color: '#E2E8F0',
    fontSize: 14,
  },
  linkText: {
    color: '#5EEAD4',
    fontWeight: '700',
  },
});