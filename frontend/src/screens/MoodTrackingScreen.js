import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  TextInput,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  Image,
  Animated,
  Easing,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, HeartPulse, CheckCircle2, Check } from 'lucide-react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useFocusEffect } from '@react-navigation/native';
import { logMoodEntry } from '../api/authService';
import { invalidateAnalyticsCache } from './AnalyticsScreen';
import GlassAlert, { useGlassAlert } from '../components/GlassAlert';

const { width } = Dimensions.get('window');

const EMOTION_MAP = {
  Great: ['Focused', 'Confident', 'Grateful', 'Refreshed'],
  Good: ['Focused', 'Confident', 'Grateful', 'Refreshed'],
  Okay: ['Calm', 'Neutral', 'Distracted', 'Hopeful'],
  Bad: ['Overwhelmed', 'Anxious', 'Fatigued', 'Unmotivated'],
  Terrible: ['Overwhelmed', 'Anxious', 'Fatigued', 'Unmotivated'],
};

const ENERGY_LEVELS = ['Drained', 'Steady', 'Energized'];

const STRESS_FACTOR_SUGGESTIONS = [
  'Exams / Viva',
  'Assignment Deadlines',
  'Lack of Sleep',
  'Coding / Thesis',
  'Heavy Workload',
  'Financial',
  'Personal / Family',
];

const MoodTrackingScreen = ({ navigation }) => {
  const [selectedMood, setSelectedMood] = useState('Okay');
  const [selectedEmotions, setSelectedEmotions] = useState(['Calm']);
  const [energyLevel, setEnergyLevel] = useState('Steady');
  const [sleepHours, setSleepHours] = useState('7.0');
  const [stressFactorsText, setStressFactorsText] = useState('');
  const [note, setNote] = useState('');
  const [selectedActivities, setSelectedActivities] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [microReflection, setMicroReflection] = useState(null);
  const [showReflectionModal, setShowReflectionModal] = useState(false);

  const { alertConfig, showAlert, hideAlert } = useGlassAlert();

  // Looping muted video player for the Visual Header Banner
  const bannerPlayer = useVideoPlayer(
    require('../../assets/videos/mood-banner-video.mp4'),
    (player) => {
      player.loop = true;
      player.muted = true;
      player.play();
    }
  );

  // Play video on focus, pause when blurred / navigating away
  useFocusEffect(
    useCallback(() => {
      if (bannerPlayer) {
        bannerPlayer.play();
      }
      return () => {
        if (bannerPlayer) {
          bannerPlayer.pause();
        }
      };
    }, [bannerPlayer])
  );

  const moods = [
    { label: 'Great', image: require('../../assets/images/mood-great.png') },
    { label: 'Good', image: require('../../assets/images/mood-good.png') },
    { label: 'Okay', image: require('../../assets/images/mood-okay.png') },
    { label: 'Bad', image: require('../../assets/images/mood-bad.png') },
    { label: 'Terrible', image: require('../../assets/images/mood-terrible.png') },
  ];

  const activitiesList = [
    { id: '1', name: 'Exercise', label: 'Exercise', image: require('../../assets/images/activity-exercise.png') },
    { id: '2', name: 'Meditation', label: 'Meditation', image: require('../../assets/images/activity-meditation.png') },
    { id: '3', name: 'Reading', label: 'Reading', image: require('../../assets/images/activity-reading.png') },
    { id: '4', name: 'Music', label: 'Music', image: require('../../assets/images/activity-music.png') },
    { id: '5', name: 'Study / Work', label: 'Study / Work', image: require('../../assets/images/activity-study.png') },
    { id: '6', name: 'Social', label: 'Social', image: require('../../assets/images/activity-social.png') },
    { id: '7', name: 'Nature Walk', label: 'Nature Walk', image: require('../../assets/images/activity-nature.png') },
    { id: '8', name: 'Gaming', label: 'Gaming', image: require('../../assets/images/activity-gaming.png') },
  ];

  const SINGLE_SET_WIDTH = activitiesList.length * (118 + 12); // 1040
  const MARQUEE_DURATION = 20000;

  const marqueeAnim = useRef(new Animated.Value(0)).current;
  const currentOffsetRef = useRef(0);
  const isInteractingRef = useRef(false);
  const activeAnimRef = useRef(null);

  const resumeMarquee = useCallback((startOffset) => {
    if (isInteractingRef.current) return;

    let fromVal = typeof startOffset === 'number' ? startOffset : currentOffsetRef.current;
    if (fromVal <= -SINGLE_SET_WIDTH || fromVal >= 0) {
      fromVal = 0;
      marqueeAnim.setValue(0);
      currentOffsetRef.current = 0;
    }

    const distance = Math.abs(-SINGLE_SET_WIDTH - fromVal);
    const duration = Math.max(100, (distance / SINGLE_SET_WIDTH) * MARQUEE_DURATION);

    activeAnimRef.current = Animated.timing(marqueeAnim, {
      toValue: -SINGLE_SET_WIDTH,
      duration,
      easing: Easing.linear,
      useNativeDriver: true,
    });

    activeAnimRef.current.start(({ finished }) => {
      if (finished && !isInteractingRef.current) {
        marqueeAnim.setValue(0);
        currentOffsetRef.current = 0;
        resumeMarquee(0);
      }
    });
  }, [marqueeAnim]);

  useEffect(() => {
    const listenerId = marqueeAnim.addListener(({ value }) => {
      currentOffsetRef.current = value;
    });
    resumeMarquee(0);

    return () => {
      marqueeAnim.removeListener(listenerId);
      isInteractingRef.current = true;
      marqueeAnim.stopAnimation();
    };
  }, [resumeMarquee, marqueeAnim]);

  const handleCardPressIn = () => {
    isInteractingRef.current = true;
    marqueeAnim.stopAnimation((val) => {
      currentOffsetRef.current = val;
    });
  };

  const handleCardPressOut = () => {
    isInteractingRef.current = false;
    resumeMarquee(currentOffsetRef.current);
  };

  const handleMoodSelect = (moodLabel) => {
    setSelectedMood(moodLabel);
    const available = EMOTION_MAP[moodLabel] || [];
    setSelectedEmotions([available[0]]);
  };

  const toggleEmotion = (emotion) => {
    setSelectedEmotions((prev) => {
      if (prev.includes(emotion)) {
        return prev.length > 1 ? prev.filter((e) => e !== emotion) : prev;
      }
      if (prev.length >= 2) {
        return [prev[1], emotion];
      }
      return [...prev, emotion];
    });
  };

  const toggleStressFactorSuggestion = (suggestion) => {
    const currentList = stressFactorsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const existsIndex = currentList.findIndex(
      (item) => item.toLowerCase() === suggestion.toLowerCase()
    );

    let updatedList;
    if (existsIndex >= 0) {
      updatedList = currentList.filter((_, idx) => idx !== existsIndex);
    } else {
      updatedList = [...currentList, suggestion];
    }
    setStressFactorsText(updatedList.join(', '));
  };

  const toggleActivity = (activityName) => {
    setSelectedActivities((prev) =>
      prev.includes(activityName)
        ? prev.filter((a) => a !== activityName)
        : [...prev, activityName]
    );
  };

  // Robust error message formatter supporting FastAPI 422 validation detail arrays
  const formatApiError = (err) => {
    if (!err) return 'Could not sync mood entry to backend.';
    const detail = err.response?.data?.detail ?? err.detail ?? err.message;
    if (Array.isArray(detail)) {
      return detail
        .map((d) => (d && d.msg ? d.msg : (typeof d === 'string' ? d : JSON.stringify(d))))
        .join(', ');
    }
    if (typeof detail === 'object' && detail !== null) {
      return detail.msg || detail.message || JSON.stringify(detail);
    }
    if (typeof detail === 'string') {
      return detail;
    }
    return err.message || 'Server error while saving mood entry.';
  };

  const handleSaveEntry = async () => {
    setIsSubmitting(true);
    try {
      // 1. Resolve logged-in user ID from local auth cache
      let activeUserId = 'demo_user';
      try {
        const cachedProfile = await AsyncStorage.getItem('@mindcare_cached_profile');
        if (cachedProfile) {
          const parsed = JSON.parse(cachedProfile);
          activeUserId = parsed.id || parsed._id || parsed.user_id || 'demo_user';
        }
      } catch (e) {
        // fallback
      }

      const parsedStressFactors = stressFactorsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      // Explicit numeric casting for Pydantic V2 validation
      const parsedSleepHours = Number(parseFloat(sleepHours) || 7.0);

      // Clinical mapping: Mood to stress index (0.0 to 10.0)
      const moodStressMap = {
        Great: 2.0,
        Good: 3.5,
        Okay: 5.0,
        Bad: 7.5,
        Terrible: 9.0,
      };
      const derivedStressScore = Number(moodStressMap[selectedMood] ?? 5.0);

      // Clinical mapping: Mood to numeric score (1.0 to 5.0)
      const moodScoreMap = {
        Great: 5.0,
        Good: 4.0,
        Okay: 3.0,
        Bad: 2.0,
        Terrible: 1.0,
      };
      const derivedMoodScore = Number(moodScoreMap[selectedMood] ?? 3.0);

      const payload = {
        user_id: String(activeUserId),
        mood: String(selectedMood || 'Okay'),
        mood_score: derivedMoodScore,
        emotion_tags: Array.isArray(selectedEmotions) ? selectedEmotions : ['Calm'],
        energy_level: String(energyLevel || 'Steady'),
        stress_score: derivedStressScore,
        stress_level: derivedStressScore,
        activities: Array.isArray(selectedActivities) ? selectedActivities : [],
        stress_factors: parsedStressFactors,
        stress_factor: parsedStressFactors.length > 0 ? String(parsedStressFactors[0]) : 'None',
        sleep_hours: parsedSleepHours,
        journal_note: String(note || ''),
        note: String(note || ''),
        notes: String(note || ''),
      };

      console.log('Submitting Mood Entry Payload:', payload);

      let saved = false;
      let reflectionText = '';
      try {
        const res = await logMoodEntry(payload);
        if (res && (res.status === 200 || res.status === 201 || res.data?.status === 'success')) {
          saved = true;
          reflectionText = res.data?.micro_reflection || '';
        }
      } catch (serviceErr) {
        console.warn('authService call failed, trying direct endpoint with token:', serviceErr.message || serviceErr);
        const token = await AsyncStorage.getItem('userToken');
        const BACKEND_URL = 'http://10.234.214.156:8000';
        const response = await fetch(`${BACKEND_URL}/user/mood-log`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });
        if (response.ok) {
          const result = await response.json().catch(() => ({}));
          saved = true;
          reflectionText = result?.micro_reflection || '';
        } else {
          const result = await response.json().catch(() => ({}));
          const errMsg = formatApiError(result);
          throw new Error(errMsg);
        }
      }

      if (saved) {
        // On successful POST /user/mood-log (200 OK), write latest biometrics & invalidate stale analytics cache
        const weekday = new Date().toLocaleDateString('en-US', { weekday: 'short' });
        const biometricsPayload = {
          user_id: activeUserId,
          sleep_hours: parsedSleepHours,
          stress_score: derivedStressScore,
          stress_level: derivedStressScore,
          mood: selectedMood,
          mood_score: derivedMoodScore,
          timestamp: new Date().toISOString(),
          date: new Date().toISOString(),
          day_of_week: weekday,
          weekday: weekday,
        };

        try {
          if (activeUserId && activeUserId !== 'demo_user') {
            await AsyncStorage.setItem(
              `@mindcare_latest_biometrics_${activeUserId}`,
              JSON.stringify(biometricsPayload)
            );
          }
          await AsyncStorage.setItem(
            '@mindcare_latest_biometrics',
            JSON.stringify(biometricsPayload)
          );
          // Invalidate stale analytics cache so next focus forces fresh server data
          await AsyncStorage.setItem('@mindcare_analytics_cache_stale', Date.now().toString());
          try {
            invalidateAnalyticsCache();
          } catch (invErr) {
            // ignore
          }
        } catch (storageErr) {
          console.warn('Local biometrics cache write notice:', storageErr);
        }

        setMicroReflection(
          reflectionText ||
            `Acknowledging your ${energyLevel.toLowerCase()} energy and emotional focus builds mental stamina. Honor your cognitive pace today.`
        );
        setShowReflectionModal(true);
      }
    } catch (error) {
      const friendlyErrorMsg = formatApiError(error);
      console.warn('⚠️ Mood Log Submit Notice:', friendlyErrorMsg);
      showAlert('Submission Notice', friendlyErrorMsg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* 1. Bright Soft Mint-Teal Gradient Background */}
      <LinearGradient
        colors={['#F0FDFA', '#E6F4F1', '#F8FAFC']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Visible Soft Mint/Aqua Ambient Circles */}
      <View pointerEvents="none" style={styles.ambientOrbTop} />
      <View pointerEvents="none" style={styles.ambientOrbMiddle} />

      <SafeAreaView style={styles.safeArea}>
        {/* Top Header Bar */}
        <View style={styles.headerBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerBackBtn}
            activeOpacity={0.8}
            accessibilityLabel="Go Back"
          >
            <ArrowLeft size={20} color="#0D9488" />
          </TouchableOpacity>

          <View style={styles.headerRightBadge}>
            <HeartPulse size={14} color="#0F766E" style={{ marginRight: 5 }} />
            <Text style={styles.headerRightBadgeText}>Daily Tracking</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Screen Title */}
          <Text style={styles.title}>Mood Tracking</Text>
          <Text style={styles.subtitle}>How are you feeling today?</Text>

          {/* 2. Visual Header Banner (expo-video VideoView) */}
          <View style={styles.bannerCard}>
            <VideoView
              player={bannerPlayer}
              style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
              contentFit="cover"
              nativeControls={false}
            />
            <LinearGradient
              colors={['rgba(15, 23, 42, 0.20)', 'rgba(15, 23, 42, 0.65)']}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            <View style={styles.bannerTextContent} pointerEvents="none">
              <Text style={styles.bannerTag}>MINDFUL REFLECTION</Text>
              <Text style={styles.bannerTitle}>
                Track patterns to nurture your inner balance
              </Text>
            </View>
          </View>

          {/* 1. What have you been doing? (Activity Photo Cards) */}
          <View style={styles.whiteCard}>
            <View style={styles.activityHeaderContainer}>
              <Text style={styles.cardHeaderNoMargin}>What have you been doing?</Text>
              <Text style={styles.activitySubHeader}>Tap all that apply</Text>
            </View>

            <View style={styles.marqueeContainer}>
              <Animated.View
                style={[
                  styles.marqueeRow,
                  {
                    transform: [{ translateX: marqueeAnim }],
                  },
                ]}
              >
                {[...activitiesList, ...activitiesList].map((item, index) => {
                  const isSelected = selectedActivities.includes(item.name);
                  const itemKey = `${item.id}-${index}`;
                  return (
                    <Pressable
                      key={itemKey}
                      style={[
                        styles.activityCard,
                        isSelected && styles.activityCardSelected,
                      ]}
                      onPressIn={handleCardPressIn}
                      onPressOut={handleCardPressOut}
                      onPress={() => toggleActivity(item.name)}
                    >
                      <Image
                        source={item.image}
                        style={styles.activityCardImage}
                        resizeMode="cover"
                        pointerEvents="none"
                      />
                      {/* Subtle Mint Tint Overlay when selected */}
                      {isSelected && (
                        <View
                          style={styles.activityCardSelectedOverlay}
                          pointerEvents="none"
                        />
                      )}
                      <LinearGradient
                        colors={['transparent', 'rgba(15, 23, 42, 0.85)']}
                        style={styles.activityCardScrim}
                        pointerEvents="none"
                      />
                      {isSelected && (
                        <View style={styles.activityCheckBadge} pointerEvents="none">
                          <Check size={14} color="#FFFFFF" strokeWidth={3} />
                        </View>
                      )}
                      <Text
                        style={styles.activityCardLabel}
                        numberOfLines={1}
                        pointerEvents="none"
                      >
                        {item.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </Animated.View>
            </View>
          </View>

          {/* 2. Select Your Mood (including Affect Labeling) */}
          <View style={styles.whiteCard}>
            <Text style={styles.cardHeader}>Select Your Mood</Text>
            <View style={styles.moodRow}>
              {moods.map((mood, index) => {
                const isSelected = selectedMood === mood.label;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.moodItem, isSelected && styles.moodItemSelected]}
                    onPress={() => handleMoodSelect(mood.label)}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={mood.image}
                      style={[
                        styles.moodImage,
                        isSelected ? styles.moodImageSelected : styles.moodImageUnselected,
                      ]}
                      resizeMode="contain"
                    />
                    <Text
                      style={[styles.moodLabel, isSelected && styles.selectedLabel]}
                      numberOfLines={1}
                    >
                      {mood.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Dynamic Emotion Sub-Tags (Affect Labeling) */}
            <View style={styles.affectSection}>
              <View style={styles.affectHeaderRow}>
                <Text style={styles.affectHeaderTitle}>AFFECT LABELING</Text>
                <Text style={styles.affectHeaderSub}>Pick 1–2 specific feelings</Text>
              </View>
              <View style={styles.affectChipsRow}>
                {(EMOTION_MAP[selectedMood] || []).map((emotion) => {
                  const isChosen = selectedEmotions.includes(emotion);
                  return (
                    <TouchableOpacity
                      key={emotion}
                      style={[
                        styles.affectChip,
                        isChosen ? styles.affectChipActive : styles.affectChipInactive,
                      ]}
                      onPress={() => toggleEmotion(emotion)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.affectChipText,
                          isChosen ? styles.affectChipTextActive : styles.affectChipTextInactive,
                        ]}
                      >
                        {emotion}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* 3. Mental Energy Level */}
          <View style={styles.whiteCard}>
            <Text style={styles.cardHeader}>Mental Energy Level</Text>
            <Text style={styles.energySubTitle}>Cognitive focus & battery capacity</Text>
            <View style={styles.energyRow}>
              {ENERGY_LEVELS.map((level) => {
                const isCurrent = energyLevel === level;
                return (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.energyPill,
                      isCurrent ? styles.energyPillActive : styles.energyPillInactive,
                    ]}
                    onPress={() => setEnergyLevel(level)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.energyPillText,
                        isCurrent ? styles.energyPillTextActive : styles.energyPillTextInactive,
                      ]}
                    >
                      {level}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 4. Sleep Hours */}
          <View style={styles.whiteCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeaderNoMargin}>Sleep Hours</Text>
              <View style={styles.sleepBadge}>
                <Text style={styles.sleepBadgeText}>
                  {parseFloat(sleepHours) ? `${parseFloat(sleepHours).toFixed(1)} hrs` : 'Hours'}
                </Text>
              </View>
            </View>
            <Text style={styles.cardSubHeader}>Hours of rest last night</Text>

            {/* Top Row — Quick-Select Hour Chips */}
            <View style={styles.quickSleepRow}>
              {['5', '6', '7', '8', '9'].map((val) => {
                const isSelected = parseFloat(sleepHours) === parseFloat(val);
                return (
                  <TouchableOpacity
                    key={val}
                    style={[
                      styles.quickSleepPill,
                      isSelected ? styles.quickSleepPillActive : styles.quickSleepPillInactive,
                    ]}
                    onPress={() => setSleepHours(val)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.quickSleepText,
                        isSelected ? styles.quickSleepTextActive : styles.quickSleepTextInactive,
                      ]}
                    >
                      {val}h
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Bottom Row — Numeric Input Field */}
            <View style={styles.sleepInputWrapper}>
              <TextInput
                style={styles.sleepTextInput}
                value={sleepHours !== undefined && sleepHours !== null ? String(sleepHours) : ''}
                onChangeText={(text) => {
                  const sanitized = text.replace(/[^0-9.]/g, '');
                  const parts = sanitized.split('.');
                  const clean = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : sanitized;
                  setSleepHours(clean);
                }}
                placeholder="e.g. 7.5"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
                maxLength={5}
              />
              <Text style={styles.sleepInputUnit}>hrs</Text>
            </View>
          </View>

          {/* 5. Stress Factors */}
          <View style={styles.whiteCard}>
            <Text style={styles.cardHeader}>Stress Factors</Text>
            <Text style={styles.cardSubHeader}>Tap suggestions or type your own triggers</Text>

            {/* Top Section — Quick-Select Suggestion Chips */}
            <View style={styles.stressFactorsRow}>
              {STRESS_FACTOR_SUGGESTIONS.map((factor) => {
                const currentList = stressFactorsText
                  .split(',')
                  .map((s) => s.trim().toLowerCase())
                  .filter(Boolean);
                const isSelected = currentList.includes(factor.toLowerCase());
                return (
                  <TouchableOpacity
                    key={factor}
                    style={[
                      styles.stressFactorChip,
                      isSelected ? styles.stressFactorChipActive : styles.stressFactorChipInactive,
                    ]}
                    onPress={() => toggleStressFactorSuggestion(factor)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.stressFactorText,
                        isSelected ? styles.stressFactorTextActive : styles.stressFactorTextInactive,
                      ]}
                    >
                      {factor}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Bottom Section — Editable Text Input Field */}
            <View style={styles.stressInputWrapper}>
              <TextInput
                style={styles.stressTextInput}
                value={stressFactorsText}
                onChangeText={setStressFactorsText}
                placeholder="Selected or custom triggers appear here..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={2}
              />
            </View>
          </View>

          {/* 6. Write a note to yourself */}
          <View style={styles.whiteCard}>
            <Text style={styles.cardHeader}>Write a note to yourself</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="How was your day truly? Write your thoughts or small victories..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              value={note}
              onChangeText={setNote}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, isSubmitting && styles.saveBtnDisabled]}
            onPress={handleSaveEntry}
            disabled={isSubmitting}
            activeOpacity={0.88}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Save Entry</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      {/* MindCare GlassAlert Component */}
      <GlassAlert
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={hideAlert}
      />

      {/* 7. Post-Save Gemini AI Micro-Reflection Card Modal */}
      <Modal
        visible={showReflectionModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowReflectionModal(false);
          navigation.goBack();
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.reflectionCard}>
            <View style={styles.reflectionAccentBar} />
            <View style={styles.reflectionInner}>
              <View style={styles.reflectionTagRow}>
                <Text style={styles.reflectionTag}>CLINICAL REFLECTION</Text>
              </View>
              <Text style={styles.reflectionText}>
                {microReflection}
              </Text>

              <View style={styles.reflectionMetaRow}>
                <View style={styles.reflectionMetaPill}>
                  <Text style={styles.reflectionMetaPillText}>{selectedMood}</Text>
                </View>
                {selectedEmotions.map((em) => (
                  <View key={em} style={styles.reflectionMetaPill}>
                    <Text style={styles.reflectionMetaPillText}>{em}</Text>
                  </View>
                ))}
                <View style={styles.reflectionMetaPill}>
                  <Text style={styles.reflectionMetaPillText}>{energyLevel} Energy</Text>
                </View>
                <View style={styles.reflectionMetaPill}>
                  <Text style={styles.reflectionMetaPillText}>{(parseFloat(sleepHours) || 7.0).toFixed(1)}h Sleep</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.reflectionDoneBtn}
                onPress={() => {
                  setShowReflectionModal(false);
                  navigation.goBack();
                }}
                activeOpacity={0.88}
              >
                <Text style={styles.reflectionDoneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  safeArea: {
    flex: 1,
  },

  // Ambient Orbs
  ambientOrbTop: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(45, 212, 191, 0.22)',
  },
  ambientOrbMiddle: {
    position: 'absolute',
    top: 400,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(20, 184, 166, 0.16)',
  },

  // Top Header Bar
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    marginBottom: 8,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    borderWidth: 1.2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  headerRightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#CCFBF1',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  headerRightBadgeText: {
    color: '#0F766E',
    fontSize: 12,
    fontWeight: '700',
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 24,
  },
  title: {
    fontSize: 27,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
    marginTop: 3,
    marginBottom: 12,
    fontWeight: '500',
  },

  // 2. Banner Card
  bannerCard: {
    height: 168,
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    marginBottom: 16,
    position: 'relative',
    backgroundColor: '#0F172A',
    justifyContent: 'flex-end',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  bannerImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  bannerTextContent: {
    padding: 14,
    zIndex: 2,
  },
  bannerTag: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#5EEAD4',
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  bannerTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 19,
  },

  // Frosted White Glass Card
  whiteCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    padding: 18,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  cardHeaderNoMargin: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  // 3. Mood Items
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  moodItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'rgba(248, 250, 252, 0.70)',
  },
  moodItemSelected: {
    backgroundColor: '#CCFBF1',
    borderColor: '#0D9488',
    borderWidth: 2,
    transform: [{ scale: 1.06 }],
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  moodImage: {
    width: 38,
    height: 38,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
  },
  moodImageSelected: {
    opacity: 1,
  },
  moodImageUnselected: {
    opacity: 0.75,
  },
  moodLabel: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  },
  selectedLabel: {
    color: '#0F766E',
    fontWeight: '800',
  },

  // Activities Marquee
  activityHeaderContainer: {
    marginBottom: 12,
  },
  activityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  activitySubHeader: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 4,
  },
  marqueeContainer: {
    overflow: 'hidden',
    width: '100%',
    paddingVertical: 4,
    borderRadius: 20,
  },
  marqueeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  activityCard: {
    width: 118,
    height: 142,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E2E8F0',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 3,
    justifyContent: 'flex-end',
  },
  activityCardSelected: {
    borderWidth: 2.5,
    borderColor: '#0D9488',
    transform: [{ scale: 1.04 }],
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  activityCardSelectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 148, 136, 0.18)',
    zIndex: 1,
  },
  activityCardImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  activityCardScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '52%',
    zIndex: 2,
  },
  activityCheckBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0D9488',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 20,
  },
  activityCardLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    padding: 10,
    letterSpacing: -0.2,
    zIndex: 2,
  },

  input: {
    backgroundColor: 'rgba(248, 250, 252, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    color: '#0F172A',
    fontSize: 14,
    lineHeight: 20,
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },

  // Save Button
  saveBtn: {
    backgroundColor: '#0D9488',
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    elevation: 4,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  saveBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16.5,
    letterSpacing: 0.3,
  },

  // Affect Labeling Sub-Tags
  affectSection: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.7)',
  },
  affectHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  affectHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0D9488',
    letterSpacing: 1.2,
  },
  affectHeaderSub: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
  },
  affectChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  affectChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1.2,
  },
  affectChipActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  affectChipInactive: {
    backgroundColor: 'rgba(241, 245, 249, 0.85)',
    borderColor: '#E2E8F0',
  },
  affectChipText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  affectChipTextActive: {
    color: '#FFFFFF',
  },
  affectChipTextInactive: {
    color: '#475569',
  },

  // Mental Energy Selector
  energySubTitle: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '500',
    marginTop: -6,
    marginBottom: 14,
  },
  energyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  energyPill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  energyPillActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  energyPillInactive: {
    backgroundColor: 'rgba(241, 245, 249, 0.9)',
    borderColor: '#E2E8F0',
  },
  energyPillText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  energyPillTextActive: {
    color: '#FFFFFF',
  },
  energyPillTextInactive: {
    color: '#475569',
  },

  // Sleep Hours Card
  cardSubHeader: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 14,
  },
  sleepBadge: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sleepBadgeText: {
    color: '#0F766E',
    fontSize: 12.5,
    fontWeight: '700',
  },
  quickSleepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 12,
  },
  quickSleepPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
  },
  quickSleepPillActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  quickSleepPillInactive: {
    backgroundColor: 'rgba(241, 245, 249, 0.85)',
    borderColor: '#E2E8F0',
  },
  quickSleepText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  quickSleepTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  quickSleepTextInactive: {
    color: '#475569',
  },
  sleepInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    height: 50,
  },
  sleepTextInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    paddingVertical: 0,
  },
  sleepInputUnit: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D9488',
    marginLeft: 8,
  },

  // Stress Factors Card
  stressFactorsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stressFactorChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.2,
  },
  stressFactorChipActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  stressFactorChipInactive: {
    backgroundColor: 'rgba(241, 245, 249, 0.9)',
    borderColor: '#E2E8F0',
  },
  stressFactorText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  stressFactorTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  stressFactorTextInactive: {
    color: '#475569',
  },
  stressInputWrapper: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
    minHeight: 52,
    justifyContent: 'center',
  },
  stressTextInput: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#0F172A',
    lineHeight: 20,
    paddingVertical: 0,
  },

  // Micro-Reflection Modal Card
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  reflectionCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    elevation: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    position: 'relative',
  },
  reflectionAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 3.5,
    backgroundColor: '#0D9488',
  },
  reflectionInner: {
    padding: 22,
    paddingLeft: 24,
  },
  reflectionTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reflectionTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0D9488',
    letterSpacing: 1.5,
  },
  reflectionText: {
    fontSize: 14.5,
    color: '#1E293B',
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 16,
  },
  reflectionMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  reflectionMetaPill: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reflectionMetaPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F766E',
  },
  reflectionDoneBtn: {
    backgroundColor: '#0D9488',
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  reflectionDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default MoodTrackingScreen;
