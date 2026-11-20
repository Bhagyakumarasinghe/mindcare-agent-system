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
import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useFocusEffect } from '@react-navigation/native';
import { registerUser } from '../api/authService';
import GlassAlert, { useGlassAlert } from '../components/GlassAlert';

const { width, height } = Dimensions.get('window');
const bgVideoSource = require('../../assets/videos/background-video-1.mp4');

export default function SignupScreen({ navigation, onNavigateToLogin, onSignup }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const { alertConfig, showAlert, hideAlert } = useGlassAlert();

  // Smooth visual crossfade mask to hide the video loop boundary
  const loopMaskOpacity = useRef(new Animated.Value(0)).current;

  // Muted Native Loop (Same smooth video background as LoginScreen)
  const player = useVideoPlayer(bgVideoSource, (player) => {
    player.loop = true;
    player.muted = true;
    player.timeUpdateEventInterval = 0.25;
    player.play();
  });

  // Gentle visual fade right at the loop boundary
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

  // Pause video when leaving SignupScreen, resume when returning
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
  const headerSlideAnim = useRef(new Animated.Value(-24)).current;
  const cardFadeAnim = useRef(new Animated.Value(0.25)).current;
  const cardSlideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFadeAnim, {
        toValue: 1,
        duration: 850,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(headerSlideAnim, {
        toValue: 0,
        duration: 850,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardFadeAnim, {
        toValue: 1,
        duration: 850,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardSlideAnim, {
        toValue: 0,
        duration: 850,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSignup = async () => {
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedName || !trimmedEmail || !trimmedPassword || !trimmedConfirm) {
      showAlert('Incomplete Fields', 'Please complete all required fields.', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      showAlert('Invalid Email', 'Please enter a valid email address.', 'error');
      return;
    }

    if (trimmedPassword.length < 8) {
      showAlert(
        'Password Too Short',
        'Password must be at least 8 characters long for account security.',
        'error'
      );
      return;
    }

    if (trimmedPassword !== trimmedConfirm) {
      showAlert('Password Mismatch', 'Passwords do not match. Please re-enter.', 'error');
      return;
    }

    setLoading(true);
    try {
      if (onSignup) {
        await onSignup({ fullName: trimmedName, email: trimmedEmail, password: trimmedPassword });
      } else {
        const response = await registerUser(trimmedName, trimmedEmail, trimmedPassword);

        if (response.status === 200 || response.status === 201) {
          showAlert(
            'Account Created',
            'Welcome to MindCare! An OTP verification code has been dispatched to your email address.',
            [
              {
                text: 'Proceed to Verification',
                onPress: () => {
                  if (navigation) {
                    navigation.navigate('OTP', { email: trimmedEmail });
                  } else if (onNavigateToLogin) {
                    onNavigateToLogin();
                  }
                },
              },
            ],
            'success'
          );
        }
      }
    } catch (error) {
      let errorMessage = 'Unable to complete registration. Please check your network connection.';

      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (Array.isArray(detail)) {
          errorMessage = detail.map((err) => err.msg || err.message).join('\n');
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      showAlert('Registration Failed', errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    if (onNavigateToLogin) {
      onNavigateToLogin();
    } else if (navigation) {
      navigation.navigate('Login');
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

      {/* 2. Foreground Compact Single-Screen Container */}
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
              {/* Compact Highlighted Glassy Logo & Brand Header */}
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
                <Text style={styles.heading}>Create Account</Text>
                <Text style={styles.subheading}>
                  Begin your personalized journey to inner stillness
                </Text>
              </Animated.View>

              {/* Compact Translucent Frosted Glass Form Card */}
              <Animated.View
                style={[
                  styles.card,
                  {
                    opacity: cardFadeAnim,
                    transform: [{ translateY: cardSlideAnim }],
                  },
                ]}
              >
                {/* Full Name Field */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>FULL NAME</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      focusedField === 'fullName' && styles.inputContainerFocused,
                    ]}
                  >
                    <User
                      size={17}
                      color={focusedField === 'fullName' ? '#2DD4BF' : '#E2E8F0'}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your full name"
                      placeholderTextColor="rgba(255, 255, 255, 0.75)"
                      autoCapitalize="words"
                      value={fullName}
                      onChangeText={setFullName}
                      onFocus={() => setFocusedField('fullName')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                </View>

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
                      size={17}
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
                  <Text style={styles.inputLabel}>PASSWORD (MIN 8 CHARACTERS)</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      focusedField === 'password' && styles.inputContainerFocused,
                    ]}
                  >
                    <Lock
                      size={17}
                      color={focusedField === 'password' ? '#2DD4BF' : '#E2E8F0'}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter at least 8 characters"
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
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      {showPassword ? (
                        <EyeOff size={18} color="#2DD4BF" />
                      ) : (
                        <Eye size={18} color="#E2E8F0" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Confirm Password Field */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      focusedField === 'confirmPassword' && styles.inputContainerFocused,
                    ]}
                  >
                    <Lock
                      size={17}
                      color={focusedField === 'confirmPassword' ? '#2DD4BF' : '#E2E8F0'}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Re-enter your password"
                      placeholderTextColor="rgba(255, 255, 255, 0.75)"
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      onFocus={() => setFocusedField('confirmPassword')}
                      onBlur={() => setFocusedField(null)}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={styles.eyeButton}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={18} color="#2DD4BF" />
                      ) : (
                        <Eye size={18} color="#E2E8F0" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Primary Create Account Button */}
                <TouchableOpacity
                  style={[styles.button, loading && { opacity: 0.75 }]}
                  onPress={handleSignup}
                  disabled={loading}
                  activeOpacity={0.88}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.buttonText}>Create Account</Text>
                  )}
                </TouchableOpacity>

                {/* Footer Switch Link */}
                <TouchableOpacity
                  onPress={goToLogin}
                  style={styles.footerLink}
                  activeOpacity={0.7}
                >
                  <Text style={styles.footerText}>
                    Already have an account?{' '}
                    <Text style={styles.linkText}>Sign In</Text>
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
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'android' ? 8 : 6,
    paddingBottom: 14,
    justifyContent: 'center',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  logoHalo: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.50)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#2DD4BF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  logo: {
    width: 58,
    height: 58,
  },
  brandTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#5EEAD4',
    letterSpacing: 2.5,
    marginBottom: 2,
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginBottom: 2,
    textAlign: 'center',
  },
  subheading: {
    fontSize: 12.5,
    color: '#E2E8F0',
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 10,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.42)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 8,
  },
  inputGroup: {
    marginBottom: 11,
  },
  inputLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#F1F5F9',
    letterSpacing: 1.1,
    marginBottom: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    paddingHorizontal: 14,
    height: 46,
  },
  inputContainerFocused: {
    borderColor: '#2DD4BF',
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  inputIcon: {
    marginRight: 9,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 4,
  },
  button: {
    backgroundColor: '#0D9488',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  footerLink: {
    marginTop: 12,
    alignItems: 'center',
  },
  footerText: {
    color: '#E2E8F0',
    fontSize: 13.5,
  },
  linkText: {
    color: '#5EEAD4',
    fontWeight: '700',
  },
});