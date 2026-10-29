import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft, Settings, HeartPulse } from 'lucide-react-native';
import { logMoodEntry } from '../api/authService';

const { width } = Dimensions.get('window');

const MoodTrackingScreen = ({ navigation }) => {
  const [selectedMood, setSelectedMood] = useState('Okay');
  const [stressLevel, setStressLevel] = useState(5);
  const [sleepHours, setSleepHours] = useState('');
  const [stressFactor, setStressFactor] = useState('');
  const [note, setNote] = useState('');
  const [activities, setActivities] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const moods = [
    { label: 'Great', emoji: '🤩' },
    { label: 'Good', emoji: '😊' },
    { label: 'Okay', emoji: '😐' },
    { label: 'Bad', emoji: '😟' },
    { label: 'Terrible', emoji: '😭' },
  ];

  const activitiesList = [
    { id: '1', label: 'Exercise', icon: '🏃' },
    { id: '2', label: 'Meditation', icon: '🧘' },
    { id: '3', label: 'Reading', icon: '📚' },
    { id: '4', label: 'Music', icon: '🎧' },
  ];

  const toggleActivity = (id) => {
    if (activities.includes(id)) {
      setActivities(activities.filter(a => a !== id));
    } else {
      setActivities([...activities, id]);
    }
  };

  const handleSaveEntry = async () => {
    if (!sleepHours) {
      Alert.alert("Missing Info", "Please enter your sleep hours.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Map selected activity IDs to descriptive labels
      const selectedActivityLabels = activities.map(id => {
        const act = activitiesList.find(a => a.id === id);
        return act ? act.label : '';
      }).filter(label => label !== '');

      // Payload strictly conforming to requirements:
      // mood, stress_score, activities, sleep_hours, stress_factor, journal_note
      const payload = {
        mood: selectedMood,
        stress_score: parseInt(stressLevel),
        stress_level: parseInt(stressLevel), // Backwards compatibility
        activities: selectedActivityLabels,
        stress_factor: stressFactor || 'None',
        sleep_hours: parseFloat(sleepHours) || 0,
        journal_note: note,
        note: note // Backwards compatibility
      };

      console.log("Submitting Mood Entry Payload:", payload);

      let saved = false;
      try {
        const res = await logMoodEntry(payload);
        if (res && (res.status === 200 || res.status === 201 || res.data?.status === 'success')) {
          saved = true;
        }
      } catch (serviceErr) {
        console.log("authService call failed, trying direct endpoint with token:", serviceErr.message || serviceErr);
        const token = await AsyncStorage.getItem('userToken');
        const BACKEND_URL = "http://10.234.214.156:8000";
        const response = await fetch(`${BACKEND_URL}/user/mood-log`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify(payload)
        });
        if (response.ok) {
          saved = true;
        } else {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.detail || "Server error while saving mood entry.");
        }
      }

      if (saved) {
        Alert.alert(
          "Logged Successfully 🌿",
          "Your daily self-reflection metrics have been recorded into your health graph.",
          [{ text: "Done", onPress: () => navigation.goBack() }]
        );
      }
    } catch (error) {
      console.error("❌ Mood Log Submit Error:", error);
      Alert.alert("Submission Notice", error.message || "Could not sync mood entry to backend.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header Bar with Standardized Non-Obtrusive Settings Button */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackBtn}>
          <ArrowLeft size={20} color="#0D9488" />
          <Text style={styles.headerBackText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.headerRightGroup}>
          <View style={styles.headerRightBadge}>
            <HeartPulse size={14} color="#0F766E" style={{ marginRight: 4 }} />
            <Text style={styles.headerRightBadgeText}>Daily Tracking</Text>
          </View>
          <TouchableOpacity 
            style={styles.headerGearBtn}
            onPress={() => navigation.navigate('Main', { screen: 'Profile' })}
            activeOpacity={0.7}
            accessibilityLabel="Settings"
          >
            <Settings size={18} color="#0D9488" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Mood Tracking</Text>
        <Text style={styles.subtitle}>How are you feeling today?</Text>

        {/* Mood Card */}
        <View style={styles.whiteCard}>
          <Text style={styles.cardHeader}>Select Your Mood</Text>
          <View style={styles.moodRow}>
            {moods.map((mood, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.moodItem}
                onPress={() => setSelectedMood(mood.label)}
              >
                <Text style={[styles.emoji, selectedMood === mood.label && styles.selectedEmoji]}>
                  {mood.emoji}
                </Text>
                <Text style={[styles.moodLabel, selectedMood === mood.label && styles.selectedLabel]}>
                  {mood.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Stress Level Card */}
        <View style={styles.whiteCard}>
          <Text style={styles.cardHeader}>Stress Level: {stressLevel}/10</Text>
          <View style={styles.sliderContainer}>
            <Text style={styles.limitText}>Low</Text>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={10}
              step={1}
              value={stressLevel}
              onValueChange={(val) => setStressLevel(val)}
              minimumTrackTintColor="#0D9488"
              maximumTrackTintColor="#E2E8F0"
              thumbTintColor="#0D9488"
            />
            <Text style={styles.limitText}>High</Text>
          </View>
        </View>

        {/* Activities Card */}
        <View style={styles.whiteCard}>
          <Text style={styles.cardHeader}>What have you been doing?</Text>
          <View style={styles.activityRow}>
            {activitiesList.map((item) => (
              <TouchableOpacity 
                key={item.id} 
                style={[styles.activityItem, activities.includes(item.id) && styles.selectedActivity]}
                onPress={() => toggleActivity(item.id)}
              >
                <Text style={{fontSize: 22}}>{item.icon}</Text>
                <Text style={styles.activityLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Input Cards */}
        <View style={styles.whiteCard}>
          <Text style={styles.cardHeader}>Main Stress Factor</Text>
          <TextInput 
            style={styles.input} 
            placeholder="e.g. Work, Study, Family" 
            placeholderTextColor="#94A3B8"
            value={stressFactor}
            onChangeText={setStressFactor}
          />
        </View>

        <View style={styles.whiteCard}>
          <Text style={styles.cardHeader}>Sleep Hours (Last Night)</Text>
          <TextInput 
            style={styles.input} 
            placeholder="e.g. 7" 
            keyboardType="numeric"
            placeholderTextColor="#94A3B8"
            value={sleepHours}
            onChangeText={setSleepHours}
          />
        </View>

        <View style={styles.whiteCard}>
          <Text style={styles.cardHeader}>Write a note to yourself</Text>
          <TextInput 
            style={[styles.input, {height: 100, textAlignVertical: 'top'}]} 
            placeholder="How was your day truly?" 
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
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save Entry</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  headerBackBtn: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerBackText: {
    color: '#0D9488',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 6
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  headerRightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F4F1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12
  },
  headerRightBadgeText: {
    color: '#0F766E',
    fontSize: 12,
    fontWeight: '700'
  },
  headerGearBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center'
  },
  scrollContent: { 
    padding: 22, 
    paddingBottom: 60 
  },
  title: { 
    fontSize: 26, 
    fontWeight: '800', 
    color: '#1E293B',
    marginTop: 4
  },
  subtitle: { 
    fontSize: 14, 
    color: '#64748B', 
    marginTop: 4,
    marginBottom: 20 
  },
  whiteCard: { 
    backgroundColor: '#FFF', 
    padding: 18, 
    borderRadius: 20, 
    marginBottom: 14, 
    elevation: 1, 
    shadowColor: '#0F172A', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.04, 
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  cardHeader: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#1E293B', 
    marginBottom: 14 
  },
  moodRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between' 
  },
  moodItem: { 
    alignItems: 'center' 
  },
  emoji: { 
    fontSize: 30, 
    opacity: 0.35 
  },
  selectedEmoji: { 
    opacity: 1, 
    transform: [{ scale: 1.25 }] 
  },
  moodLabel: { 
    fontSize: 11, 
    color: '#94A3B8', 
    marginTop: 6,
    fontWeight: '500' 
  },
  selectedLabel: { 
    color: '#0D9488', 
    fontWeight: '700' 
  },
  sliderContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 5 
  },
  slider: { 
    flex: 1, 
    height: 40, 
    marginHorizontal: 8 
  },
  limitText: { 
    fontSize: 12, 
    color: '#94A3B8', 
    fontWeight: '600' 
  },
  activityRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    flexWrap: 'wrap',
    gap: 8
  },
  activityItem: { 
    alignItems: 'center', 
    padding: 12, 
    borderRadius: 16, 
    borderWidth: 1.5, 
    borderColor: '#F1F5F9', 
    width: '22%' 
  },
  selectedActivity: { 
    borderColor: '#0D9488', 
    backgroundColor: '#F0FDFA' 
  },
  activityLabel: { 
    fontSize: 10, 
    color: '#64748B', 
    marginTop: 5,
    fontWeight: '600' 
  },
  input: { 
    backgroundColor: '#F8FAFC', 
    padding: 14, 
    borderRadius: 14, 
    borderWidth: 1.5, 
    borderColor: '#E2E8F0', 
    color: '#1E293B', 
    fontSize: 14,
    lineHeight: 20
  },
  saveBtn: { 
    backgroundColor: '#0D9488', 
    paddingVertical: 16, 
    borderRadius: 16, 
    alignItems: 'center', 
    marginTop: 10, 
    elevation: 2,
    shadowColor: '#0D9488', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.25, 
    shadowRadius: 8 
  },
  saveBtnDisabled: {
    backgroundColor: '#94A3B8'
  },
  saveBtnText: { 
    color: '#FFFFFF', 
    fontWeight: '700', 
    fontSize: 16 
  }
});

export default MoodTrackingScreen;