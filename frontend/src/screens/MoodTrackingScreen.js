import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage'; // <-- AsyncStorage import කළා

const { width } = Dimensions.get('window');

const MoodTrackingScreen = ({ navigation }) => {
  const [selectedMood, setSelectedMood] = useState('Okay');
  const [stressLevel, setStressLevel] = useState(5);
  const [sleepHours, setSleepHours] = useState('');
  const [stressFactor, setStressFactor] = useState('');
  const [note, setNote] = useState('');
  const [activities, setActivities] = useState([]);

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

    try {
      const token = await AsyncStorage.getItem('userToken');
      const BACKEND_URL = "http://10.152.23.156:8000"; // ඔයාගේ වත්මන් IP එකට අනුව යාවත්කාලීන කළා 

      // ID වෙනුවට බැකෙන්ඩ් එක බලාපොරොත්තු වන Activity Labels (e.g. ["Exercise", "Music"]) ලබා ගැනීම
      const selectedActivityLabels = activities.map(id => {
        const act = activitiesList.find(a => a.id === id);
        return act ? act.label : '';
      }).filter(label => label !== '');

      const payload = {
        mood: selectedMood,
        stress_level: parseInt(stressLevel),
        activities: selectedActivityLabels,
        stress_factor: stressFactor || 'None',
        sleep_hours: parseFloat(sleepHours) || 0,
        note: note
      };

      console.log("Sending Mood Data:", payload);

      const response = await fetch(`${BACKEND_URL}/user/mood-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (response.ok) {
        Alert.alert("Success", "Your mood entry has been saved successfully!");
        // Navigation Stack එකේ Home හෝ Dashboard එක තිබේ නම් Navigate කරන්න, නැතහොත් goBack() කරන්න
        navigation.goBack();
      } else {
        Alert.alert("Error", result.detail || "Something went wrong");
      }
    } catch (error) {
      console.error("❌ Mood Log Submit Error:", error);
      Alert.alert("Connection Error", "Could not connect to the server");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        
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
              minimumTrackTintColor="#818CF8"
              maximumTrackTintColor="#F1F5F9"
              thumbTintColor="#6366F1"
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
            multiline
            numberOfLines={4}
            value={note}
            onChangeText={setNote}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEntry}>
          <Text style={styles.saveBtnText}>Save Entry</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 25, paddingBottom: 50 },
  backBtn: { marginBottom: 10 },
  backText: { color: '#64748B', fontSize: 16 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1E293B' },
  subtitle: { fontSize: 15, color: '#64748B', marginBottom: 25 },
  whiteCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 24, marginBottom: 15, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 },
  cardHeader: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginBottom: 15 },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  moodItem: { alignItems: 'center' },
  emoji: { fontSize: 30, opacity: 0.3 },
  selectedEmoji: { opacity: 1, transform: [{scale: 1.2}] },
  moodLabel: { fontSize: 11, color: '#94A3B8', marginTop: 5 },
  selectedLabel: { color: '#6366F1', fontWeight: 'bold' },
  sliderContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  slider: { flex: 1, height: 40, marginHorizontal: 10 },
  limitText: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
  activityRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  activityItem: { alignItems: 'center', padding: 12, borderRadius: 18, borderWidth: 1, borderColor: '#F1F5F9', width: '22%' },
  selectedActivity: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  activityLabel: { fontSize: 10, color: '#64748B', marginTop: 5 },
  input: { backgroundColor: '#F8FAFC', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', color: '#1E293B', fontSize: 15 },
  saveBtn: { backgroundColor: '#C7D2FE', padding: 18, borderRadius: 18, alignItems: 'center', marginTop: 10, shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5 },
  saveBtnText: { color: '#6366F1', fontWeight: 'bold', fontSize: 16 }
});

export default MoodTrackingScreen;