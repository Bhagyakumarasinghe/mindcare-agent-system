import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    image: '💙',
    title: 'Track your mood daily',
    description: 'Log your emotions and stress levels with our simple and intuitive tracking system.',
  },
  {
    id: '2',
    image: '📈',
    title: 'Understand your stress patterns',
    description: 'AI-powered analytics help you identify triggers and patterns in your mental health.',
  },
  {
    id: '3',
    image: '😊',
    title: 'Improve your mental wellbeing',
    description: 'Get personalized recommendations and relaxation exercises tailored to your needs.',
  },
];

export default function OnboardingScreen({ navigation }) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const flatListRef = useRef();

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
      navigation.navigate('Login'); // Onboarding අවසානයේ Login පේජ් එකට යයි
    }
  };

  const Slide = ({ item }) => (
    <View style={styles.slide}>
      <View style={styles.iconContainer}>
        <Text style={styles.iconText}>{item.image}</Text>
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.skipBtn} onPress={() => navigation.navigate('Login')}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={updateCurrentSlideIndex}
        renderItem={({ item }) => <Slide item={item} />}
        keyExtractor={(item) => item.id}
      />

      <View style={styles.footer}>
        <View style={styles.indicatorContainer}>
          {slides.map((_, index) => (
            <View key={index} style={[styles.indicator, currentSlideIndex === index && styles.activeIndicator]} />
          ))}
        </View>

        <TouchableOpacity style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>
            {currentSlideIndex === slides.length - 1 ? 'Get Started ➔' : 'Next ➔'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  skipBtn: { position: 'absolute', top: 50, right: 30, zIndex: 10 },
  skipText: { color: '#6B7280', fontSize: 14 },
  slide: { width, alignItems: 'center', justifyContent: 'center', padding: 40 },
  iconContainer: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#F0F4FF', alignItems: 'center', justifyContent: 'center', marginBottom: 40 },
  iconText: { fontSize: 60 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: '#1F2937', marginBottom: 15 },
  description: { fontSize: 16, textAlign: 'center', color: '#6B7280', lineHeight: 24 },
  footer: { paddingHorizontal: 40, paddingBottom: 50 },
  indicatorContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 30 },
  indicator: { height: 6, width: 6, borderRadius: 3, backgroundColor: '#E5E7EB', marginHorizontal: 4 },
  activeIndicator: { backgroundColor: '#4F75FF', width: 20 },
  button: { backgroundColor: '#4F75FF', paddingVertical: 18, borderRadius: 15, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
});