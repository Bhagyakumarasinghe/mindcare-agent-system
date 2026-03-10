import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Save } from 'lucide-react-native';

const Journaling = ({ navigation }) => {
  const [entry, setEntry] = useState('');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#F5F3FF' }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft color="#1E293B" size={24} />
        </TouchableOpacity>

        <Text style={styles.mainTitle}>Daily Journal</Text>
        <Text style={styles.dateText}>Tuesday, March 10, 2026</Text>

        <TextInput
          style={styles.journalInput}
          multiline
          placeholder="How are you feeling today? Write your thoughts..."
          placeholderTextColor="#94A3B8"
          value={entry}
          onChangeText={setEntry}
        />

        <TouchableOpacity style={styles.saveBtn} onPress={() => alert('Journal Saved!')}>
          <Save color="#FFF" size={20} style={{ marginRight: 10 }} />
          <Text style={styles.saveBtnText}>Save Entry</Text>
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
  journalInput: { flex: 1, backgroundColor: '#FFF', borderRadius: 20, padding: 20, fontSize: 16, color: '#1E293B', textAlignVertical: 'top', borderWidth: 1, borderColor: '#DDD6FE' },
  saveBtn: { backgroundColor: '#7C3AED', flexDirection: 'row', paddingVertical: 18, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});

export default Journaling;