import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions, Image, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    badge: 'DAILY MOOD LOGGING',
    title: 'Track your mood daily',
    description: 'Log your emotions and stress levels with our simple, calming, and intuitive tracking system.',
  },
  {
    id: '2',
    badge: 'CLINICAL INSIGHTS',
    title: 'Understand stress patterns',
    description: 'Intelligent analytics help you identify triggers and discover patterns in your mental health journey.',
  },
  {
    id: '3',
    badge: 'HOLISTIC WELLBEING',
    title: 'Nurture your mental wellbeing',
    description: 'Get personalized recommendations, calming breathwork, and tailored mindfulness exercises.',
  },
];

export default function OnboardingScreen({ navigation, onGetStarted, onSkip }) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const flatListRef = useRef();

  const handleFinish = () => {
    if (onGetStarted) {
      onGetStarted();
    } else if (navigation) {
      navigation.navigate('Login');
    }
  };

  const handleSkipAction = () => {
    if (onSkip) {
      onSkip();
    } else if (navigation) {
      navigation.navigate('Login');
    }
  };

  const updateCurrentSlideIndex = (e) => {
    const contentOffsetX = e.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / width);
    setCurrentSlideIndex(currentIndex);
  };

  const handleNext = () => {
    const nextIndex = currentSlideIndex + 1;
    if (nextIndex < slides.length) {
      flatListRef.current.scrollToOffset({ offset: nextIndex * width });
      setCurrentSlideIndex(nextIndex);
    } else {
      handleFinish();
    }
  };

  const Slide = ({ item }) => (
    <View style={styles.slide}>
      <View style={styles.card}>
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>{item.badge}</Text>
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <SafeAreaView style={styles.safeArea}>
        {/* Top Header Bar */}
        <View style={styles.header}>
          <Text style={styles.brandTitle}>MINDCARE</Text>
          {currentSlideIndex < slides.length - 1 && (
            <TouchableOpacity onPress={handleSkipAction} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Prominent Centered Logo Presentation */}
        <View style={styles.logoSection}>
          <View style={styles.logoWrapper}>
            <Image
              source={require('../../assets/mindcare-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Carousel Content */}
        <FlatList
          ref={flatListRef}
          data={slides}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={updateCurrentSlideIndex}
          renderItem={({ item }) => <Slide item={item} />}
          keyExtractor={(item) => item.id}
          style={styles.flatList}
        />

        {/* Footer Actions */}
        <View style={styles.footer}>
          <View style={styles.indicatorContainer}>
            {slides.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.indicator,
                  currentSlideIndex === index && styles.activeIndicator,
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>
              {currentSlideIndex === slides.length - 1 ? 'Get Started' : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 14,
  },
  brandTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D9488',
    letterSpacing: 2.5,
  },
  skipText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 10,
  },
  logoWrapper: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  logo: {
    width: 105,
    height: 105,
  },
  flatList: {
    flexGrow: 0,
  },
  slide: {
    width,
    alignItems: 'center',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  badgeContainer: {
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  badgeText: {
    color: '#0D9488',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: '#0F172A',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 14.5,
    textAlign: 'center',
    color: '#64748B',
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: 28,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  indicator: {
    height: 6,
    width: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  activeIndicator: {
    backgroundColor: '#0D9488',
    width: 24,
  },
  button: {
    backgroundColor: '#0D9488',
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});