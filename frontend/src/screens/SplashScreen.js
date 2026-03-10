import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, Animated } from 'react-native';

const SplashScreen = ({ navigation }) => {
  // සජීවීකරණය සඳහා (Fade in effect)
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    // ලෝගෝ එක පෙනී සිටීමේ සජීවීකරණය
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start();

    // තත්පර 3 කට පසු Onboarding ස්ක්‍රීන් එකට මාරු වීම
    const timer = setTimeout(() => {
      navigation.replace('Onboarding'); 
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <View style={styles.logoContainer}>
          {/* මෙතනට ඔයාගේ heart icon එක දාන්න */}
          <Text style={styles.heartIcon}>🤍</Text> 
        </View>
        <Text style={styles.title}>Mind Care</Text>
        <Text style={styles.subtitle}>Your Mental Health Companion</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#9BA3FF', // ඔයාගේ image එකේ තියෙන ලා නිල්/දම් පාට
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    width: 100,
    height: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  heartIcon: {
    fontSize: 50,
    color: '#FFF',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFF',
  },
  subtitle: {
    fontSize: 16,
    color: '#FFF',
    marginTop: 10,
    opacity: 0.9,
  },
});

export default SplashScreen;