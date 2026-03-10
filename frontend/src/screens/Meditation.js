import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Play, SkipBack, SkipForward, Headphones } from 'lucide-react-native';

const Meditation = ({ navigation }) => {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFFBEB' }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <ArrowLeft color="#1E293B" size={24} />
      </TouchableOpacity>

      <View style={styles.artworkContainer}>
        <View style={styles.artWork}>
          <Headphones size={80} color="#F59E0B" />
        </View>
      </View>

      <Text style={styles.medTitle}>Mindful Peace</Text>
      <Text style={styles.medAuthor}>5 Minute Guided Session</Text>

      <View style={styles.playerControls}>
        <TouchableOpacity><SkipBack size={32} color="#1E293B" /></TouchableOpacity>
        
        <TouchableOpacity style={styles.mainPlayBtn}>
          <Play size={35} color="#FFF" fill="#FFF" />
        </TouchableOpacity>
        
        <TouchableOpacity><SkipForward size={32} color="#1E293B" /></TouchableOpacity>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar} />
        <View style={styles.timeInfo}>
          <Text style={styles.timeText}>0:00</Text>
          <Text style={styles.timeText}>5:00</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 30, alignItems: 'center' },
  backBtn: { alignSelf: 'flex-start' },
  artworkContainer: { marginTop: 60, marginBottom: 40 },
  artWork: { width: 220, height: 220, backgroundColor: '#FEF3C7', borderRadius: 40, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  medTitle: { fontSize: 28, fontWeight: 'bold', color: '#1E293B' },
  medAuthor: { fontSize: 16, color: '#B45309', marginTop: 8 },
  playerControls: { flexDirection: 'row', alignItems: 'center', gap: 40, marginTop: 50 },
  mainPlayBtn: { backgroundColor: '#F59E0B', width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', elevation: 8 },
  progressContainer: { width: '100%', marginTop: 50 },
  progressBar: { height: 6, backgroundColor: '#FEF3C7', borderRadius: 3, width: '100%' },
  timeInfo: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  timeText: { fontSize: 12, color: '#B45309' }
});

export default Meditation;