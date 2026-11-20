import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ArrowLeft, 
  BookOpen, 
  Save, 
  CheckCircle2, 
  Heart, 
  Clock, 
  ShieldCheck, 
  Calendar,
  AlertCircle,
  Tag,
  Settings
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { analyzeAndRecordJournal, getJournalHistory, getUserProfile } from '../api/authService';
import CrisisModal from '../components/CrisisModal';

const EMOTIONS = [
  'Calm',
  'Reflective',
  'Anxious',
  'Overwhelmed',
  'Hopeful',
  'Grateful'
];

const JournalScreen = ({ navigation }) => {
  const [activeUserId, setActiveUserId] = useState('demo_user');
  const [journalInput, setJournalInput] = useState('');
  const [selectedEmotion, setSelectedEmotion] = useState('Calm');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reflectionAnalysis, setReflectionAnalysis] = useState(null);
  
  // Clinical Early Warning & Crisis Intervention Modal State
  const [isCrisisModalVisible, setIsCrisisModalVisible] = useState(false);
  const [crisisData, setCrisisData] = useState(null);
  
  // Previous Journal Logs Timeline State (strictly dynamic from Neo4j)
  const [historyEntries, setHistoryEntries] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load User Identity and Dynamic Journal Timeline (Merging API + Local Chat Cache)
  const loadUserAndHistory = useCallback(async () => {
    let targetUser = activeUserId;
    try {
      const userRes = await getUserProfile();
      if (userRes?.data?.id) {
        targetUser = userRes.data.id;
        setActiveUserId(userRes.data.id);
      }
    } catch (err) {
      console.log('Using default identity for journal history:', err.message || err);
    }

    try {
      setLoadingHistory(true);
      const [historyRes, localRaw] = await Promise.all([
        getJournalHistory(targetUser, 30).catch((err) => {
          console.log('Error loading decrypted journal history from API:', err?.message || err);
          return null;
        }),
        AsyncStorage.getItem(`@mindcare_journal_entries_${targetUser}`).catch(() => null),
      ]);

      const backendEntries = (historyRes?.data?.status === 'success' && Array.isArray(historyRes.data.entries))
        ? historyRes.data.entries
        : [];

      let localEntries = [];
      if (localRaw) {
        try {
          const parsed = JSON.parse(localRaw);
          if (Array.isArray(parsed)) localEntries = parsed;
        } catch (parseErr) {
          console.log('Error parsing local journal entries:', parseErr);
        }
      }

      // Deduplicate by ID and content, preserving richest decrypted data
      const seenIds = new Set();
      const seenContents = new Set();
      const merged = [];

      for (const item of [...backendEntries, ...localEntries]) {
        const idKey = item.id ? String(item.id).trim() : null;
        const contentKey = (item.content || '').trim().toLowerCase();
        if (idKey && seenIds.has(idKey)) continue;
        if (contentKey && seenContents.has(contentKey)) continue;

        if (idKey) seenIds.add(idKey);
        if (contentKey) seenContents.add(contentKey);
        merged.push(item);
      }

      // Sort newest-first by timestamp
      merged.sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return timeB - timeA;
      });

      setHistoryEntries(merged);
    } catch (err) {
      console.log('Error syncing journal history:', err.message || err);
    } finally {
      setLoadingHistory(false);
      setRefreshing(false);
    }
  }, [activeUserId]);

  useEffect(() => {
    loadUserAndHistory();
  }, [loadUserAndHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    loadUserAndHistory();
  };

  // Submit Reflection
  const handleSaveReflection = async () => {
    const trimmed = journalInput.trim();
    if (!trimmed) {
      Alert.alert('Empty Reflection', 'Please write your thoughts, triggers, or small victories before saving.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await analyzeAndRecordJournal({
        user_id: activeUserId,
        content: trimmed,
        emotion: selectedEmotion
      });

      // 🚨 CLINICAL CRISIS INTERVENTION INTERCEPTION
      if (res?.data?.crisis_triggered) {
        setCrisisData(res.data);
        setIsCrisisModalVisible(true);
        setJournalInput('');
        return;
      }

      if (res?.data?.status === 'success' && res.data.analysis) {
        const analysisData = res.data.analysis;
        setReflectionAnalysis(analysisData);
        setJournalInput('');

        // Prepend new entry immediately to chronological history timeline
        const newEntry = {
          id: res.data.id || analysisData.id || `journal-${Date.now()}`,
          content: trimmed,
          emotion: selectedEmotion || analysisData.dominant_emotion || 'Calm',
          sentiment_score: analysisData.sentiment_score ?? 0.1,
          trigger: analysisData.primary_trigger || 'General Reflection',
          reflection: analysisData.short_reflection || '',
          timestamp: analysisData.timestamp || new Date().toISOString()
        };

        setHistoryEntries(prev => [newEntry, ...prev]);

        // Also cache locally for immediate offline & multi-session access
        try {
          const storageKey = `@mindcare_journal_entries_${activeUserId}`;
          const existingRaw = await AsyncStorage.getItem(storageKey);
          const existingList = existingRaw ? JSON.parse(existingRaw) : [];
          await AsyncStorage.setItem(storageKey, JSON.stringify([newEntry, ...existingList]));
        } catch (e) {
          console.log('Error caching journal entry locally:', e?.message || e);
        }

        Alert.alert('Reflection Recorded', 'Your encrypted reflection has been saved to your timeline.');
      } else {
        throw new Error('Analysis incomplete');
      }
    } catch (error) {
      if (error?.response?.data?.crisis_triggered) {
        setCrisisData(error.response.data);
        setIsCrisisModalVisible(true);
        setJournalInput('');
        return;
      }
      console.log('Reflection recorded with clinical local fallback:', error.message || error);
      const fallbackAnalysis = {
        dominant_emotion: selectedEmotion,
        sentiment_score: 0.1,
        primary_trigger: 'Personal Reflection',
        short_reflection: 'Externalizing your thoughts helps declutter working memory and restore cognitive balance.'
      };
      setReflectionAnalysis(fallbackAnalysis);

      const localEntry = {
        id: `journal-${Date.now()}`,
        content: trimmed,
        emotion: selectedEmotion,
        sentiment_score: 0.1,
        trigger: 'Personal Reflection',
        reflection: fallbackAnalysis.short_reflection,
        timestamp: new Date().toISOString()
      };
      setHistoryEntries(prev => [localEntry, ...prev]);

      try {
        const storageKey = `@mindcare_journal_entries_${activeUserId}`;
        const existingRaw = await AsyncStorage.getItem(storageKey);
        const existingList = existingRaw ? JSON.parse(existingRaw) : [];
        await AsyncStorage.setItem(storageKey, JSON.stringify([localEntry, ...existingList]));
      } catch (e) {
        console.log('Error caching local fallback entry:', e?.message || e);
      }

      setJournalInput('');
      Alert.alert('Reflection Recorded', 'Your reflection has been recorded to your clinical journal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dynamic Date and Time Formatter (e.g. "Oct 15, 2026, 9:45 AM")
  const formatTimestamp = (ts) => {
    if (!ts) return 'Recent';
    try {
      const sanitized = ts.includes('T') ? ts : ts.replace(' ', 'T');
      const d = new Date(sanitized);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return ts;
    }
  };

  return (
    <View style={styles.container}>
      {/* Ambient Translucent Mint-Teal & Soft Sky-Blue Circles */}
      <View pointerEvents="none" style={styles.ambientOrbTop} />
      <View pointerEvents="none" style={styles.ambientOrbMiddle} />
      <View pointerEvents="none" style={styles.ambientOrbBottom} />

      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F0F7F6" />

        {/* Top Clinical Header Bar with Clean Symmetrical Layout */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backBtn}
            activeOpacity={0.8}
            accessibilityLabel="Go back"
          >
            <ArrowLeft color="#0D9488" size={20} />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>Reflective Journal</Text>
          </View>

          <View style={styles.encryptedPill}>
            <ShieldCheck size={12} color="#0F766E" />
            <Text style={styles.encryptedPillText}>Encrypted</Text>
          </View>
        </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0D9488" />
          }
        >
          {/* Minimal Distraction-Free Reflection Input Card at Top */}
          <View style={styles.inputCard}>
            {/* Emotion Selector Chips */}
            <View style={styles.emotionsRow}>
              {EMOTIONS.map((tag) => {
                const isSelected = selectedEmotion === tag;
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.emotionChip, isSelected && styles.emotionChipActive]}
                    onPress={() => setSelectedEmotion(tag)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.emotionChipText, isSelected && styles.emotionChipTextActive]}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Textarea Input */}
            <TextInput
              style={styles.journalTextInput}
              multiline
              placeholder="How are you feeling today? Describe your thoughts, triggers, or small victories..."
              placeholderTextColor="#94A3B8"
              value={journalInput}
              onChangeText={setJournalInput}
              maxLength={1500}
            />

            {/* "Save Reflection" Button in MindCare Teal (#0D9488) */}
            <TouchableOpacity
              style={[styles.saveBtn, isSubmitting && styles.saveBtnDisabled]}
              onPress={handleSaveReflection}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Save size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.saveBtnText}>Save Reflection</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Decrypted "Self-Reflection Summary" Card (if analysis freshly returned) */}
          {reflectionAnalysis && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <CheckCircle2 size={18} color="#0D9488" />
                <Text style={styles.summaryTitle}>Self-Reflection Summary</Text>
              </View>

              <View style={styles.summaryBadgesRow}>
                <View style={styles.summaryEmotionBadge}>
                  <Heart size={13} color="#0F766E" />
                  <Text style={styles.summaryEmotionText}>{reflectionAnalysis.dominant_emotion || selectedEmotion}</Text>
                </View>

                {reflectionAnalysis.primary_trigger && (
                  <View style={styles.summaryTriggerBadge}>
                    <Text style={styles.summaryTriggerText}>Focus: {reflectionAnalysis.primary_trigger}</Text>
                  </View>
                )}

                {reflectionAnalysis.sentiment_score !== undefined && (
                  <View style={styles.summarySentimentBadge}>
                    <Text style={styles.summarySentimentText}>
                      Balance: {reflectionAnalysis.sentiment_score >= 0 ? `+${reflectionAnalysis.sentiment_score}` : reflectionAnalysis.sentiment_score}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.summaryBody}>"{reflectionAnalysis.short_reflection}"</Text>

              <TouchableOpacity 
                style={styles.dismissSummaryBtn}
                onPress={() => setReflectionAnalysis(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.dismissSummaryText}>Dismiss Summary</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Past Entries in a Clean Vertical Timeline */}
          <View style={styles.timelineSection}>
            <View style={styles.timelineHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Clock size={18} color="#0F766E" />
                <Text style={styles.timelineSectionTitle}>Past Entries</Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{historyEntries.length} {historyEntries.length === 1 ? 'log' : 'logs'}</Text>
              </View>
            </View>

            {loadingHistory ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color="#0D9488" size="small" />
                <Text style={styles.loadingText}>Retrieving decrypted journal history...</Text>
              </View>
            ) : historyEntries.length > 0 ? (
              <View style={styles.timelineContainer}>
                {/* Continuous Vertical Guide Line */}
                <View style={styles.timelineVerticalLine} />

                {historyEntries.map((entry, index) => {
                  const isFirst = index === 0;
                  const displayEmotion = entry.emotion || entry.trigger || 'Reflective';
                  return (
                    <View key={entry.id || index} style={styles.timelineItem}>
                      {/* Timeline Node Dot */}
                      <View style={[styles.timelineNode, isFirst && styles.timelineNodeActive]}>
                        <View style={[styles.timelineNodeInner, isFirst && styles.timelineNodeInnerActive]} />
                      </View>

                      {/* Timeline Entry Card */}
                      <View style={styles.entryCard}>
                        {/* Entry Header: Date & Emotion Pill */}
                        <View style={styles.entryHeaderRow}>
                          <View style={styles.entryDateBox}>
                            <Calendar size={13} color="#0D9488" />
                            <Text style={styles.entryDateText}>{formatTimestamp(entry.timestamp)}</Text>
                          </View>
                          <View style={styles.entryEmotionPill}>
                            <Tag size={11} color="#0D9488" />
                            <Text style={styles.entryEmotionPillText}>{displayEmotion}</Text>
                          </View>
                        </View>

                        {/* Decrypted Entry Plain Text Content */}
                        <Text style={styles.entryContentText}>{entry.content}</Text>

                        {/* AI Reflection in Teal Border Box Below */}
                        {Boolean(entry.reflection) && (
                          <View style={styles.entryReflectionBox}>
                            <View style={styles.reflectionHeader}>
                              <CheckCircle2 size={13} color="#0D9488" />
                              <Text style={styles.reflectionTitle}>AI Reflection</Text>
                            </View>
                            <Text style={styles.entryReflectionText}>
                              "{entry.reflection}"
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyStateCard}>
                <BookOpen size={28} color="#94A3B8" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyStateTitle}>No reflections recorded yet</Text>
                <Text style={styles.emptyStateSub}>
                  Write your first self-reflection above to establish your personal longitudinal timeline.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Clinical Early Warning & Crisis Intervention Modal */}
      <CrisisModal
        visible={isCrisisModalVisible}
        onClose={() => setIsCrisisModalVisible(false)}
        crisisData={crisisData}
        source="Reflective Journal"
      />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F7F6',
    position: 'relative',
  },
  safeArea: {
    flex: 1,
  },
  // Ambient Translucent Mint-Teal & Soft Sky-Blue Circles
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
    top: 360,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(20, 184, 166, 0.18)',
  },
  ambientOrbBottom: {
    position: 'absolute',
    bottom: 80,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 232, 240, 0.7)',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  headerTitleBox: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#0F766E',
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  encryptedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  encryptedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F766E',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  inputCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardHeaderSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emotionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 14,
  },
  emotionChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  emotionChipActive: {
    backgroundColor: '#F0FDFA',
    borderColor: '#0D9488',
  },
  emotionChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  emotionChipTextActive: {
    color: '#0D9488',
    fontWeight: '800',
  },
  journalTextInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 22,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  charCountRow: {
    alignItems: 'flex-end',
    marginTop: 6,
    marginBottom: 12,
  },
  charCountText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  saveBtn: {
    backgroundColor: '#0D9488',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    elevation: 2,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F766E',
  },
  summaryBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  summaryEmotionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  summaryEmotionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F766E',
  },
  summaryTriggerBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  summaryTriggerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F766E',
  },
  summarySentimentBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  summarySentimentText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0D9488',
  },
  summaryBody: {
    fontSize: 13,
    color: '#134E4A',
    fontStyle: 'italic',
    lineHeight: 19,
    marginBottom: 8,
  },
  dismissSummaryBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  dismissSummaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D9488',
  },
  timelineSection: {
    marginTop: 4,
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  timelineSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  countBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  loadingWrap: {
    paddingVertical: 30,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  timelineContainer: {
    position: 'relative',
    paddingLeft: 8,
  },
  timelineVerticalLine: {
    position: 'absolute',
    left: 15,
    top: 14,
    bottom: 20,
    width: 2,
    backgroundColor: '#E2E8F0',
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 18,
    alignItems: 'flex-start',
  },
  timelineNode: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 12,
    zIndex: 2,
  },
  timelineNodeActive: {
    borderColor: '#0D9488',
  },
  timelineNodeInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
  },
  timelineNodeInnerActive: {
    backgroundColor: '#0D9488',
  },
  entryCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    padding: 16,
    elevation: 2,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  entryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  entryDateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  entryDateText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  entryEmotionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  entryEmotionPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0D9488',
  },
  entryContentText: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 20,
  },
  entryReflectionBox: {
    marginTop: 12,
    backgroundColor: '#F0FDFA',
    borderWidth: 1.5,
    borderColor: '#99F6E4',
    padding: 10,
    borderRadius: 10,
  },
  reflectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  reflectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
    letterSpacing: 0.2,
  },
  entryReflectionText: {
    fontSize: 12,
    color: '#134E4A',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  emptyStateCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  emptyStateSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});

export default JournalScreen;
