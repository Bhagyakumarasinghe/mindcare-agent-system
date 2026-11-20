import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  PanResponder,
  BackHandler,
  Easing,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    badge: 'AI MENTAL WELLNESS',
    title: 'Understand Your Mind',
    description:
      'Connect with an intelligent, empathetic AI companion designed to support your mental clarity and daily calm.',
    image: require('../../assets/images/onboarding-1.jpg'),
  },
  {
    id: '2',
    badge: 'DAILY MOOD LOGGING',
    title: 'Track Your Mood Daily',
    description:
      'Log your emotions and stress levels with our simple, calming, and intuitive tracking system.',
    image: require('../../assets/images/onboarding-1.jpg'),
  },
  {
    id: '3',
    badge: 'PERSONALIZED CARE',
    title: 'Guided Stress Relief',
    description:
      'Access tailored breathing exercises, reflective journaling, and evidence-based insights anytime.',
    image: require('../../assets/images/onboarding-1.jpg'),
  },
  {
    id: '4',
    badge: 'HOLISTIC RESILIENCE',
    title: 'Build Daily Balance',
    description:
      'Empower yourself with actionable mental health insights and long-term wellness routines.',
    image: require('../../assets/images/onboarding-1.jpg'),
  },
];

const OnboardingScreen = ({ navigation, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Slow & Graceful Logo + Brand Animations
  const logoDropAnim = useRef(new Animated.Value(-110)).current;
  const logoScaleAnim = useRef(new Animated.Value(0.82)).current;
  const logoOpacityAnim = useRef(new Animated.Value(0)).current;

  const brandDropAnim = useRef(new Animated.Value(-35)).current;
  const brandScaleAnim = useRef(new Animated.Value(0.9)).current;
  const brandOpacityAnim = useRef(new Animated.Value(0)).current;

  // Slow Glass Card & Gentle Cascading Text Animations
  const cardDropAnim = useRef(new Animated.Value(-28)).current;
  const cardScaleAnim = useRef(new Animated.Value(0.97)).current;
  const cardOpacityAnim = useRef(new Animated.Value(0.2)).current;

  const badgeDropAnim = useRef(new Animated.Value(-26)).current;
  const badgeOpacityAnim = useRef(new Animated.Value(0)).current;

  const titleDropAnim = useRef(new Animated.Value(-26)).current;
  const titleOpacityAnim = useRef(new Animated.Value(0)).current;

  const descDropAnim = useRef(new Animated.Value(-26)).current;
  const descOpacityAnim = useRef(new Animated.Value(0)).current;

  // 1. Slow, Calming Logo + MINDCARE Descent
  useEffect(() => {
    logoDropAnim.setValue(-110);
    logoScaleAnim.setValue(0.82);
    logoOpacityAnim.setValue(0);

    brandDropAnim.setValue(-35);
    brandScaleAnim.setValue(0.9);
    brandOpacityAnim.setValue(0);

    const smoothEase = Easing.out(Easing.cubic);

    Animated.parallel([
      Animated.timing(logoDropAnim, {
        toValue: 0,
        duration: 1100,
        easing: smoothEase,
        useNativeDriver: true,
      }),
      Animated.timing(logoScaleAnim, {
        toValue: 1,
        duration: 1100,
        easing: smoothEase,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacityAnim, {
        toValue: 1,
        duration: 950,
        easing: smoothEase,
        useNativeDriver: true,
      }),

      Animated.sequence([
        Animated.delay(220),
        Animated.parallel([
          Animated.timing(brandDropAnim, {
            toValue: 0,
            duration: 950,
            easing: smoothEase,
            useNativeDriver: true,
          }),
          Animated.timing(brandScaleAnim, {
            toValue: 1,
            duration: 950,
            easing: smoothEase,
            useNativeDriver: true,
          }),
          Animated.timing(brandOpacityAnim, {
            toValue: 1,
            duration: 850,
            easing: smoothEase,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, [currentIndex]);

  // 2. Slow Glass Card & Gentle Cascading Text Fall
  useEffect(() => {
    cardDropAnim.setValue(-28);
    cardScaleAnim.setValue(0.97);
    cardOpacityAnim.setValue(0.2);

    badgeDropAnim.setValue(-26);
    badgeOpacityAnim.setValue(0);

    titleDropAnim.setValue(-26);
    titleOpacityAnim.setValue(0);

    descDropAnim.setValue(-26);
    descOpacityAnim.setValue(0);

    const smoothEase = Easing.out(Easing.cubic);

    Animated.parallel([
      Animated.timing(cardDropAnim, {
        toValue: 0,
        duration: 950,
        easing: smoothEase,
        useNativeDriver: true,
      }),
      Animated.timing(cardScaleAnim, {
        toValue: 1,
        duration: 950,
        easing: smoothEase,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacityAnim, {
        toValue: 1,
        duration: 850,
        easing: smoothEase,
        useNativeDriver: true,
      }),

      Animated.stagger(220, [
        Animated.parallel([
          Animated.timing(badgeDropAnim, {
            toValue: 0,
            duration: 850,
            easing: smoothEase,
            useNativeDriver: true,
          }),
          Animated.timing(badgeOpacityAnim, {
            toValue: 1,
            duration: 800,
            easing: smoothEase,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(titleDropAnim, {
            toValue: 0,
            duration: 900,
            easing: smoothEase,
            useNativeDriver: true,
          }),
          Animated.timing(titleOpacityAnim, {
            toValue: 1,
            duration: 850,
            easing: smoothEase,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(descDropAnim, {
            toValue: 0,
            duration: 950,
            easing: smoothEase,
            useNativeDriver: true,
          }),
          Animated.timing(descOpacityAnim, {
            toValue: 1,
            duration: 900,
            easing: smoothEase,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, [currentIndex]);

  // Handle Android Hardware Back Button / Edge Gesture
  useEffect(() => {
    const onBackPress = () => {
      if (currentIndexRef.current > 0) {
        setCurrentIndex((prev) => prev - 1);
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );
    return () => subscription.remove();
  }, []);

  // Handle Left & Right Finger Swipes
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dy) < 40;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -45 && currentIndexRef.current < SLIDES.length - 1) {
          setCurrentIndex((prev) => prev + 1);
        } else if (gestureState.dx > 45 && currentIndexRef.current > 0) {
          setCurrentIndex((prev) => prev - 1);
        }
      },
    })
  ).current;

  const finishOnboarding = async () => {
    try {
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
    } catch (e) {
      console.log('AsyncStorage error:', e);
    }

    if (onComplete) {
      onComplete();
    } else if (navigation) {
      navigation.replace('Login');
    }
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      finishOnboarding();
    }
  };

  const currentSlide = SLIDES[currentIndex];

  return (
    <View style={styles.root} {...panResponder.panHandlers}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* 1. Full-Screen Unmasked Background Artwork (100% Clarity) */}
      <Image
        source={currentSlide.image}
        style={styles.bgImage}
        resizeMode="cover"
      />

      {/* 2. Foreground UI Container */}
      <View style={styles.foreground}>
        {/* Top Bar: Only Skip on the right */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={finishOnboarding}
            style={styles.skipBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Center Highlighted Glassy Pop-Up Logo + MINDCARE Badge */}
        <View style={styles.centerBrandSection}>
          <Animated.View
            style={[
              styles.logoOuterGlow,
              {
                opacity: logoOpacityAnim,
                transform: [
                  { translateY: logoDropAnim },
                  { scale: logoScaleAnim },
                ],
              },
            ]}
          >
            <View style={styles.logoInnerGlass}>
              <Image
                source={require('../../assets/mindcare-logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </Animated.View>

          <Animated.View
            style={[
              styles.brandPill,
              {
                opacity: brandOpacityAnim,
                transform: [
                  { translateY: brandDropAnim },
                  { scale: brandScaleAnim },
                ],
              },
            ]}
          >
            <Text style={styles.brandUnderLogo}>MINDCARE</Text>
          </Animated.View>
        </View>

        {/* Bottom Animated Glassmorphism Card + Slow Cascading Falling Text */}
        <View style={styles.bottomSection}>
          <Animated.View
            style={[
              styles.glassCard,
              {
                opacity: cardOpacityAnim,
                transform: [
                  { translateY: cardDropAnim },
                  { scale: cardScaleAnim },
                ],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.badge,
                {
                  opacity: badgeOpacityAnim,
                  transform: [{ translateY: badgeDropAnim }],
                },
              ]}
            >
              <Text style={styles.badgeText}>{currentSlide.badge}</Text>
            </Animated.View>

            <Animated.Text
              style={[
                styles.title,
                {
                  opacity: titleOpacityAnim,
                  transform: [{ translateY: titleDropAnim }],
                },
              ]}
            >
              {currentSlide.title}
            </Animated.Text>

            <Animated.Text
              style={[
                styles.description,
                {
                  opacity: descOpacityAnim,
                  transform: [{ translateY: descDropAnim }],
                },
              ]}
            >
              {currentSlide.description}
            </Animated.Text>
          </Animated.View>

          {/* Clickable Pagination Dots */}
          <View style={styles.dotsRow}>
            {SLIDES.map((_, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => setCurrentIndex(idx)}
                style={[
                  styles.dot,
                  idx === currentIndex ? styles.activeDot : styles.inactiveDot,
                ]}
              />
            ))}
          </View>

          {/* Primary Next / Get Started Button */}
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>
              {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: width,
    height: height,
    backgroundColor: '#091522',
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width,
    height: height,
    opacity: 1,
  },
  foreground: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 52,
    paddingBottom: 34,
    zIndex: 10,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  skipBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.56)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  skipText: {
    color: '#5EEAD4',
    fontSize: 13,
    fontWeight: '700',
  },
  centerBrandSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoOuterGlow: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: 'rgba(45, 212, 191, 0.16)',
    borderWidth: 1.5,
    borderColor: '#2DD4BF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2DD4BF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  logoInnerGlass: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 76,
    height: 76,
    opacity: 1,
  },
  brandPill: {
    marginTop: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: 'rgba(45, 212, 191, 0.50)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  brandUnderLogo: {
    color: '#5EEAD4',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 3.5,
  },
  bottomSection: {
    width: '100%',
    alignItems: 'center',
  },
  glassCard: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.56)',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
    marginBottom: 22,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  badge: {
    backgroundColor: 'rgba(45, 212, 191, 0.22)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.45)',
    marginBottom: 14,
  },
  badgeText: {
    color: '#5EEAD4',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    color: '#E2E8F0',
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '500',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dot: {
    height: 7,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    width: 24,
    backgroundColor: '#2DD4BF',
  },
  inactiveDot: {
    width: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  nextBtn: {
    width: '100%',
    height: 54,
    backgroundColor: '#0D9488',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default OnboardingScreen;