import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  Alert, 
  ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Save } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ⚠️ ඔයාගේ IP address එක මෙතනට නිවැරදිව යොදන්න
const BASE_URL = 'http://10.152.23.156:8000'; 

const Journaling = ({ navigation }) => {
  const [entry, setEntry] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Dynamic Date Formatting for UI Display
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handleSave = async () => {
    if (!entry.trim()) {
      Alert.alert('Error', 'Please write something before saving.');
      return;
    }

    setIsSaving(true);
    try {
      // User Auth Token එක AsyncStorage එකෙන් ලබා ගැනීම
      const token = await AsyncStorage.getItem('userToken');

      const response = await fetch(`${BASE_URL}/user/journal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          content: entry,
          date: new Date().toISOString() // Dynamic Real-time Date
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Journal Saved successfully!');
        setEntry('');
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.detail || 'Failed to save journal to backend.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Network Error', 'Could not connect to the FastAPI server.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#F5F3FF' }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft color="#1E293B" size={24} />
        </TouchableOpacity>

        <Text style={styles.mainTitle}>Daily Journal</Text>
        <Text style={styles.dateText}>{todayFormatted}</Text>

        <TextInput
          style={styles.journalInput}
          multiline
          placeholder="How are you feeling today? Write your thoughts..."
          placeholderTextColor="#94A3B8"
          value={entry}
          onChangeText={setEntry}
        />

        <TouchableOpacity 
          style={[styles.saveBtn, isSaving && { opacity: 0.7 }]} 
          onPress={handleSave} 
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Save color="#FFF" size={20} style={{ marginRight: 10 }} />
              <Text style={styles.saveBtnText}>Save Entry</Text>
            </>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 25 },
  backBtn: { marginBottom: 20 },
  mainTitle: { fontSize: 26, fontWeight: 'bold', color: '#1E293B' },
  dateText: { fontSize: 14, color: '#7C3AED', marginBottom: 20, fontWeight: '500' },
  journalInput: { 
    flex: 1, 
    backgroundColor: '#FFF', 
    borderRadius: 20, 
    padding: 20, 
    fontSize: 16, 
    color: '#1E293B', 
    textAlignVertical: 'top', 
    borderWidth: 1, 
    borderColor: '#DDD6FE' 
  },
  saveBtn: { 
    backgroundColor: '#7C3AED', 
    flexDirection: 'row', 
    paddingVertical: 18, 
    borderRadius: 18, 
    justify: 'center', 
    alignItems: 'center', 
    marginTop: 20 
  },
  saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});

export default Journaling;