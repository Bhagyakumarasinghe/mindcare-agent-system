import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ToastAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  Plus,
  X,
  Award,
  Search,
  Play,
  GraduationCap,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Trash2,
  Flame,
} from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import {
  getAcademicSubjects,
  createAcademicSubject,
  getAcademicRecommendation,
  deleteAcademicSubject,
  toggleTopicById,
  toggleSubjectTopic,
  getUserProfile,
  decomposeAcademicTask,
} from '../api/authService';
import { recordStudySession } from '../utils/activityTracker';

// Module-level cache for instantaneous mount & freeze-prevention
let cachedSubjectsData = null;
let cachedRecData = null;

export default function AplusTrackScreen({ navigation }) {
  const [loading, setLoading] = useState(!cachedSubjectsData);
  const [subjects, setSubjects] = useState(cachedSubjectsData || []);
  const [recommendation, setRecommendation] = useState(cachedRecData || null);
  const [latestBiometrics, setLatestBiometrics] = useState(null);
  const [userId, setUserId] = useState('demo_user');
  const userIdRef = useRef('demo_user');
  const isFetchingRef = useRef(false);

  // Search Query State for real-time subject & topic filtering
  const [searchQuery, setSearchQuery] = useState('');

  // Interactive "Add Subject & Module" Modal State
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newDifficulty, setNewDifficulty] = useState('High');
  const [newDaysRemaining, setNewDaysRemaining] = useState('18');
  const [currentTopicInput, setCurrentTopicInput] = useState('');
  const [newTopicsList, setNewTopicsList] = useState([]);
  const [isSubmittingSubject, setIsSubmittingSubject] = useState(false);

  // Exam Crunch Mode State
  const [isCrunchMode, setIsCrunchMode] = useState(false);

  // Task Decomposer State
  const [expandedDecomposerId, setExpandedDecomposerId] = useState(null);
  const [assignmentInputMap, setAssignmentInputMap] = useState({});
  const [decomposingLoadingId, setDecomposingLoadingId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Helper to persist current A+ track state into AsyncStorage
  const persistAplusCache = (uid, currentSubjects, currentRec) => {
    const targetUid = uid || userIdRef.current;
    if (!targetUid || targetUid === 'demo_user') return;
    try {
      AsyncStorage.setItem(
        `@mindcare_aplus_cache_${targetUid}`,
        JSON.stringify({
          subjects: currentSubjects,
          recommendation: currentRec,
          timestamp: Date.now(),
        })
      ).catch(() => {});
    } catch (e) {
      // ignore
    }
  };

  // Immediate storage hydration on mount (0ms delay, no spinner if cached)
  useEffect(() => {
    let isMounted = true;
    const hydrateFromStorage = async () => {
      try {
        let uid = 'demo_user';
        const cachedProf = await AsyncStorage.getItem('@mindcare_cached_profile');
        if (cachedProf) {
          const parsedProf = JSON.parse(cachedProf);
          if (parsedProf?.id || parsedProf?.user_id) {
            uid = parsedProf.id || parsedProf.user_id;
            userIdRef.current = uid;
            if (isMounted) setUserId(uid);
          }
        }

        const aplusCacheKey = `@mindcare_aplus_cache_${uid}`;
        const [cachedAplus, scopedBio] = await Promise.all([
          AsyncStorage.getItem(aplusCacheKey),
          uid && uid !== 'demo_user' ? AsyncStorage.getItem(`@mindcare_latest_biometrics_${uid}`) : null,
        ]);

        if (scopedBio && isMounted) {
          try {
            setLatestBiometrics(JSON.parse(scopedBio));
          } catch (bioErr) {
            // ignore
          }
        } else if (isMounted) {
          setLatestBiometrics(null);
        }

        if (cachedAplus) {
          const parsedAplus = JSON.parse(cachedAplus);
          if (parsedAplus?.subjects && Array.isArray(parsedAplus.subjects) && isMounted) {
            cachedSubjectsData = parsedAplus.subjects;
            setSubjects(parsedAplus.subjects);
            if (parsedAplus?.recommendation) {
              cachedRecData = parsedAplus.recommendation;
              setRecommendation(parsedAplus.recommendation);
            }
            setLoading(false);
          }
        }
      } catch (e) {
        // ignore
      }
    };

    hydrateFromStorage();
    return () => { isMounted = false; };
  }, []);

  const loadScreenData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      // 1. Resolve user ID immediately from cached profile or ref
      let targetUser = userIdRef.current;
      if (!targetUser || targetUser === 'demo_user') {
        try {
          const cachedProf = await AsyncStorage.getItem('@mindcare_cached_profile');
          if (cachedProf) {
            const parsedProf = JSON.parse(cachedProf);
            if (parsedProf?.id || parsedProf?.user_id) {
              targetUser = parsedProf.id || parsedProf.user_id;
              userIdRef.current = targetUser;
              setUserId(targetUser);
            }
          }
        } catch (e) {
          // ignore
        }
      }

      // Only show full loading spinner if we have zero cached subjects
      if (!cachedSubjectsData && subjects.length === 0) {
        setLoading(true);
      }

      // If still demo_user, attempt a quick non-blocking profile resolution
      if (!targetUser || targetUser === 'demo_user') {
        try {
          const userRes = await Promise.race([
            getUserProfile(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Profile timeout')), 1500))
          ]);
          if (userRes?.data?.id) {
            targetUser = userRes.data.id;
            userIdRef.current = targetUser;
            setUserId(targetUser);
          }
        } catch (err) {
          console.log('Using default user identity for academic track:', err?.message || err);
        }
      }

      // 2. Single concurrent fetch for subjects and recommendations
      const [subjectsRes, recRes] = await Promise.all([
        getAcademicSubjects(targetUser).catch(() => null),
        getAcademicRecommendation(targetUser).catch(() => null),
      ]);

      let freshSubjects = null;
      let freshRec = null;

      if (subjectsRes?.data?.subjects) {
        freshSubjects = subjectsRes.data.subjects;
        cachedSubjectsData = freshSubjects;
        setSubjects(freshSubjects);
      }
      if (recRes?.data) {
        freshRec = recRes.data;
        cachedRecData = freshRec;
        setRecommendation(freshRec);
      }

      // 3. Persist latest data to AsyncStorage cache for instant subsequent visits
      if (freshSubjects || freshRec) {
        persistAplusCache(
          targetUser,
          freshSubjects || subjects,
          freshRec || recommendation
        );
      }
    } catch (error) {
      console.error('Error loading academic data:', error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []); // IMPORTANT: Empty dependency array ensures loadScreenData never cascades on userId state changes

  useFocusEffect(
    useCallback(() => {
      const syncCrunchMode = async () => {
        try {
          const val = await AsyncStorage.getItem('mindcare_exam_crunch_mode');
          setIsCrunchMode(val === 'true');
        } catch (e) {
          // ignore
        }
      };

      const syncLatestBiometrics = async () => {
        try {
          let uid = userIdRef.current;
          if (!uid || uid === 'demo_user') {
            const cachedProf = await AsyncStorage.getItem('@mindcare_cached_profile');
            if (cachedProf) {
              const parsedProf = JSON.parse(cachedProf);
              uid = parsedProf?.id || parsedProf?.user_id || '';
            }
          }
          if (uid && uid !== 'demo_user') {
            const scopedBio = await AsyncStorage.getItem(`@mindcare_latest_biometrics_${uid}`);
            setLatestBiometrics(scopedBio ? JSON.parse(scopedBio) : null);
          } else {
            setLatestBiometrics(null);
          }
        } catch (e) {
          // ignore
        }
      };

      syncCrunchMode();
      syncLatestBiometrics();
      loadScreenData();
    }, [loadScreenData])
  );

  // Task Decomposer Handler: calls /api/agent/decompose-task and dynamically appends to subject
  const handleDecomposeTasks = async (subjectId) => {
    const rawInput = (assignmentInputMap[subjectId] || '').trim();
    if (!rawInput) {
      Alert.alert('Notice', 'Please paste coursework requirements or project topics to break down.');
      return;
    }

    try {
      setDecomposingLoadingId(subjectId);
      const res = await decomposeAcademicTask(userIdRef.current || userId, subjectId, rawInput);
      const data = res?.data;

      const rawNewTopics = data?.created_topics || (data?.tasks || []).map((t, i) => ({
        id: `decomp-${Date.now()}-${i}`,
        name: typeof t === 'string' ? t : (t.name || t.title || ''),
        title: typeof t === 'string' ? t : (t.title || t.name || ''),
        completed: false,
        priority: 1
      }));

      // Deduplicate generated sub-tasks by title (case-insensitive, trimmed)
      const seenTitles = new Set();
      const newTopics = [];
      for (const item of rawNewTopics) {
        const titleKey = (item.name || item.title || '').trim().toLowerCase();
        if (titleKey && !seenTitles.has(titleKey)) {
          seenTitles.add(titleKey);
          newTopics.push({
            ...item,
            name: (item.name || item.title || '').trim(),
            title: (item.title || item.name || '').trim()
          });
        }
      }

      if (newTopics && newTopics.length > 0) {
        setSubjects((prevSubjects) => {
          const updated = prevSubjects.map((sub) => {
            if (sub.id === subjectId || sub.name === subjectId) {
              const existingNames = new Set(
                (sub.topics || []).map((item) => (item.name || item.title || '').trim().toLowerCase())
              );
              const filteredNew = newTopics.filter(
                (item) => !existingNames.has((item.name || item.title || '').trim().toLowerCase())
              );
              const combinedTopics = [...(sub.topics || []), ...filteredNew];
              
              // Ensure uniqueness across combined topics by title
              const seenCombined = new Set();
              const uniqueTopics = [];
              for (const top of combinedTopics) {
                const k = (top.name || top.title || '').trim().toLowerCase();
                if (k && !seenCombined.has(k)) {
                  seenCombined.add(k);
                  uniqueTopics.push(top);
                }
              }

              const completedCount = uniqueTopics.filter((t) => t.completed).length;
              return {
                ...sub,
                topics: uniqueTopics,
                total_topics_count: uniqueTopics.length,
                completed_topics_count: completedCount,
                completion_percentage: uniqueTopics.length > 0
                  ? Math.round((completedCount / uniqueTopics.length) * 100)
                  : 0
              };
            }
            return sub;
          });
          cachedSubjectsData = updated;
          persistAplusCache(userIdRef.current, updated, recommendation);
          return updated;
        });

        setAssignmentInputMap((prev) => ({ ...prev, [subjectId]: '' }));
        setExpandedDecomposerId(null);
        setToastMessage('Tasks decomposed into checklist');
        if (Platform.OS === 'android') {
          try {
            ToastAndroid.show('Tasks decomposed into checklist', ToastAndroid.SHORT);
          } catch (e) {
            // ignore
          }
        }
        setTimeout(() => {
          setToastMessage(null);
        }, 3000);
      }
    } catch (err) {
      console.error('Task decomposition error:', err);
      Alert.alert('Decomposition Error', 'Unable to break down coursework at this time. Please try again.');
    } finally {
      setDecomposingLoadingId(null);
    }
  };

  // Topic Toggle Integration (via PATCH /api/academic/topics/{topic_id}/toggle)
  const handleToggleTopic = async (subjectId, topic) => {
    const topicId = topic.id;
    const topicName = (topic.name || topic.title || '').trim();
    const currentStatus = Boolean(topic.completed);
    const nextStatus = !currentStatus;

    // Optimistically update subject checklist and completion percentage
    if (nextStatus) {
      recordStudySession(userIdRef.current, focusMinutes || 25).catch(() => {});
    }

    setSubjects((prevSubjects) => {
      const updated = prevSubjects.map((sub) => {
        if (sub.id !== subjectId) return sub;
        const updatedTopics = (sub.topics || []).map((t) => {
          const tName = (t.name || t.title || '').trim();
          if ((topicId && t.id === topicId) || (topicName && tName === topicName)) {
            return { ...t, completed: nextStatus };
          }
          return t;
        });
        const compCount = updatedTopics.filter((t) => t.completed).length;
        const totalCount = updatedTopics.length;
        const newPct = totalCount > 0 ? Math.round((compCount / totalCount) * 100) : 0;
        return {
          ...sub,
          topics: updatedTopics,
          completed_topics_count: compCount,
          total_topics_count: totalCount,
          completion_percentage: newPct,
        };
      });
      cachedSubjectsData = updated;
      persistAplusCache(userIdRef.current, updated, recommendation);
      return updated;
    });

    try {
      if (topicId) {
        const res = await toggleTopicById(topicId);
        if (res?.data?.status === 'success' && res.data.progress_percentage !== undefined) {
          const verifiedPct = Math.round(res.data.progress_percentage);
          const verifiedComp = res.data.completed_topics;
          setSubjects((prev) => {
            const updated = prev.map((sub) => {
              if (sub.id !== subjectId) return sub;
              return {
                ...sub,
                completion_percentage: verifiedPct,
                completed_topics_count: verifiedComp !== undefined ? verifiedComp : sub.completed_topics_count,
              };
            });
            cachedSubjectsData = updated;
            persistAplusCache(userIdRef.current, updated, recommendation);
            return updated;
          });
        }
      } else {
        // Fallback to legacy toggle endpoint by name
        await toggleSubjectTopic({
          user_id: userIdRef.current || userId,
          subject_id: subjectId,
          topic_name: topicName,
          completed: nextStatus,
        });
      }
    } catch (error) {
      console.error('Failed to toggle topic status on server:', error);
    }
  };

  // Add Topic to Draft Builder
  const handleAddTopicChip = () => {
    const trimmed = currentTopicInput.trim();
    if (!trimmed) return;
    if (newTopicsList.includes(trimmed)) {
      Alert.alert('Duplicate Topic', 'This topic has already been added.');
      return;
    }
    setNewTopicsList((prev) => [...prev, trimmed]);
    setCurrentTopicInput('');
  };

  const handleRemoveTopicChip = (indexToRemove) => {
    setNewTopicsList((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Create & Enroll Subject in Neo4j
  const handleCreateSubject = async () => {
    const trimmedName = newSubjectName.trim();
    if (!trimmedName) {
      Alert.alert('Subject Required', 'Please enter a subject name (e.g., Distributed Systems).');
      return;
    }

    setIsSubmittingSubject(true);
    try {
      // Calculate exam date string based on days remaining input
      const days = parseInt(newDaysRemaining, 10) || 14;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      const examDateStr = targetDate.toISOString().split('T')[0];

      const topicsToSend =
        newTopicsList.length > 0
          ? newTopicsList
          : ['Core Principles & Architecture', 'Key Proofs & Implementations', 'Exam Review & Practice Problems'];

      const payload = {
        user_id: userIdRef.current || userId,
        name: trimmedName,
        target_grade: 'A+',
        difficulty: newDifficulty,
        exam_date: examDateStr,
        topics: topicsToSend,
      };

      const res = await createAcademicSubject(payload);
      if (res?.data?.subject) {
        const created = res.data.subject;
        setSubjects((prev) => {
          const updated = [created, ...prev];
          cachedSubjectsData = updated;
          persistAplusCache(userIdRef.current, updated, recommendation);
          return updated;
        });
        setIsAddModalVisible(false);
        setNewSubjectName('');
        setNewDifficulty('High');
        setNewDaysRemaining('18');
        setNewTopicsList([]);
        setCurrentTopicInput('');
        Alert.alert('Subject Enrolled', `${trimmedName} added to your A+ Track roadmap.`);
      } else {
        throw new Error('Subject enrollment failed');
      }
    } catch (error) {
      console.error('Error creating academic subject:', error);
      Alert.alert('Notice', 'Failed to enroll subject. Please verify your connection.');
    } finally {
      setIsSubmittingSubject(false);
    }
  };

  // Delete Subject Action with Confirmation Alert
  const handleDeleteSubject = (subjectId, subjectName) => {
    Alert.alert(
      'Delete Subject',
      'Delete this subject and its study records?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Optimistic update
            setSubjects((prev) => {
              const updated = prev.filter((s) => s.id !== subjectId);
              cachedSubjectsData = updated;
              persistAplusCache(userIdRef.current, updated, recommendation);
              return updated;
            });
            try {
              await deleteAcademicSubject(subjectId);
            } catch (error) {
              console.error('Error deleting subject:', error);
              Alert.alert('Notice', 'Failed to delete subject. Refreshing list.');
              loadScreenData();
            }
          },
        },
      ]
    );
  };

  // Pacing Parameters (Default strictly to 25m / 5m if Exam Crunch Mode is active)
  const focusMinutes = isCrunchMode ? 25 : (recommendation?.focus_minutes || 35);
  const breakMinutes = isCrunchMode ? 5 : (recommendation?.break_minutes || 5);

  // Resolved Biometrics: Prioritize fresh local biometrics cache from Mood Check-in, then recommendation
  const rawSleep =
    latestBiometrics?.sleep_hours !== undefined && latestBiometrics?.sleep_hours !== null
      ? latestBiometrics.sleep_hours
      : recommendation?.biometrics?.sleep_hours;
  const numSleep = rawSleep !== undefined && rawSleep !== null && !isNaN(Number(rawSleep)) ? Number(rawSleep) : 7;
  const displaySleepHours = numSleep % 1 === 0 ? numSleep : numSleep.toFixed(1);

  const displayStressLevel =
    latestBiometrics?.stress_level !== undefined && latestBiometrics?.stress_level !== null
      ? (typeof latestBiometrics.stress_level === 'number'
          ? (latestBiometrics.stress_level > 6.5 ? 'High' : latestBiometrics.stress_level > 4.0 ? 'Moderate' : 'Low')
          : String(latestBiometrics.stress_level))
      : recommendation?.biometrics?.stress_level || 'Moderate';

  // Filter subjects and their topics in real-time based on searchQuery
  const filteredSubjects = subjects.filter((sub) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = (sub.name || '').toLowerCase().includes(q);
    const targetMatch = (sub.target_grade || '').toLowerCase().includes(q);
    const diffMatch = (sub.difficulty || '').toLowerCase().includes(q);
    const topicMatch = (sub.topics || []).some((t) =>
      (t.name || t.title || '').toLowerCase().includes(q)
    );
    return nameMatch || targetMatch || diffMatch || topicMatch;
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingCenter]}>
        <ActivityIndicator size="large" color="#0D9488" />
        <Text style={styles.loadingText}>Loading Academic Resilience Track...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Ambient Translucent Mint-Teal & Soft Sky-Blue Circles */}
      <View pointerEvents="none" style={styles.ambientOrbTop} />
      <View pointerEvents="none" style={styles.ambientOrbMiddle} />
      <View pointerEvents="none" style={styles.ambientOrbBottom} />

      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F0F7F6" />

        {/* Top Clinical Header Bar with Clean Standard Spacing (No Collisions) */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={20} color="#0D9488" />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>A+ Study Track</Text>
          </View>

          {/* Balanced spacer preserving centered title alignment */}
          <View style={{ width: 36 }} />
        </View>

        {/* Brief Clinical Toast / Notification */}
        {toastMessage && (
          <View style={styles.toastNotification}>
            <CheckCircle2 size={16} color="#0D9488" style={{ marginRight: 8 }} />
            <Text style={styles.toastNotificationText}>{toastMessage}</Text>
          </View>
        )}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
        {/* Discreet Clinical Exam Crunch Mode Banner */}
        {isCrunchMode && (
          <View style={styles.crunchModeBanner}>
            <Clock size={15} color="#0D9488" style={{ marginRight: 8 }} />
            <Text style={styles.crunchModeBannerText}>
              Exam Mode Active: Micro-breaks prioritized to reduce cognitive fatigue.
            </Text>
          </View>
        )}

        {/* Top Study Hero Banner Card */}
        <View style={styles.heroBannerCard}>
          <Image
            source={require('../../assets/images/A-plus-banner.jpg')}
            style={styles.heroBannerImage}
            resizeMode="cover"
          />
        </View>

        {/* De-cluttered Top Pacing Recommendation: "Today's Recommended Focus" */}
        <View style={styles.pacingBanner}>
          <View style={styles.pacingBannerTop}>
            <View style={styles.pacingBannerTitleBox}>
              <Text style={styles.pacingBannerTitle}>Today's Recommended Focus</Text>
              <View style={styles.adaptiveBadge}>
                <Clock size={12} color="#0F766E" />
                <Text style={styles.adaptiveBadgeText}>
                  {focusMinutes} min Study / {breakMinutes} min Reset
                </Text>
              </View>
            </View>
          </View>

          {/* Biometrics Status Row */}
          {(recommendation?.biometrics || latestBiometrics) && (
            <View style={styles.biometricsRow}>
              <View style={styles.biometricPill}>
                <Clock size={11} color="#0F766E" />
                <Text style={styles.biometricPillText}>
                  Sleep: {displaySleepHours}h
                </Text>
              </View>
              <View style={styles.biometricPill}>
                <Flame size={11} color="#0F766E" />
                <Text style={styles.biometricPillText}>
                  Stress: {displayStressLevel}
                </Text>
              </View>
            </View>
          )}

          {/* Single Primary CTA: Start Study Timer pre-filled with dynamic focus minutes */}
          <TouchableOpacity
            style={styles.startTimerCTA}
            onPress={() => navigation.navigate('FocusTimer', { initialMinutes: focusMinutes })}
            activeOpacity={0.88}
          >
            <Play size={16} color="#FFFFFF" fill="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.startTimerCTAText}>Start Study Timer ({focusMinutes}m)</Text>
          </TouchableOpacity>
        </View>

        {/* Horizontal Action Row: Search Bar + Compact Teal + Enroll Button */}
        <View style={styles.actionRow}>
          <View style={styles.searchBarContainer}>
            <Search size={16} color="#0D9488" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search subjects or topics..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchQuery.trim().length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ padding: 2 }}
              >
                <X size={15} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.topEnrollBtn}
            onPress={() => setIsAddModalVisible(true)}
            activeOpacity={0.85}
            accessibilityLabel="Enroll New Subject"
          >
            <Plus size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.topEnrollBtnText}>Enroll</Text>
          </TouchableOpacity>
        </View>

        {/* Section Heading & Subject Count */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>Enrolled Subjects & Modules</Text>
          <View style={styles.subjectCountBadge}>
            <Text style={styles.subjectCountText}>
              {searchQuery.trim().length > 0
                ? `${filteredSubjects.length} of ${subjects.length}`
                : `${subjects.length} ${subjects.length === 1 ? 'Subject' : 'Subjects'}`}
            </Text>
          </View>
        </View>

        {/* Clean Subject Cards or Empty State Card */}
        {subjects.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <GraduationCap size={36} color="#0D9488" style={{ marginBottom: 10 }} />
            <Text style={styles.emptyStateTitle}>No Enrolled Subjects</Text>
            <Text style={styles.emptyStateSub}>
              No subjects enrolled yet. Add your modules and exam dates to unlock stress-adapted study pacing.
            </Text>
            <TouchableOpacity
              style={styles.emptyStateAddBtn}
              onPress={() => setIsAddModalVisible(true)}
              activeOpacity={0.85}
            >
              <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.emptyStateAddBtnText}>Add Your First Subject</Text>
            </TouchableOpacity>
          </View>
        ) : filteredSubjects.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <BookOpen size={32} color="#0D9488" style={{ marginBottom: 10 }} />
            <Text style={styles.emptyStateTitle}>No Matching Subjects</Text>
            <Text style={styles.emptyStateSub}>
              No enrolled subjects or topics match "{searchQuery}".
            </Text>
            <TouchableOpacity
              style={styles.clearSearchBtn}
              onPress={() => setSearchQuery('')}
              activeOpacity={0.85}
            >
              <Text style={styles.clearSearchBtnText}>Clear Search</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredSubjects.map((sub) => {
            const rawTopics = sub.topics || [];
            // Deduplicate items by title before rendering
            const seenRenderTitles = new Set();
            const topics = [];
            for (const top of rawTopics) {
              const titleKey = (top.name || top.title || '').trim().toLowerCase();
              if (titleKey && !seenRenderTitles.has(titleKey)) {
                seenRenderTitles.add(titleKey);
                topics.push(top);
              }
            }

            const completedCount = topics.filter((t) => t.completed).length;
            const totalCount = topics.length;
            const completionPct = totalCount > 0
              ? Math.round((completedCount / totalCount) * 100)
              : (sub.completion_percentage || 0);
            const daysRem = sub.days_remaining !== undefined ? sub.days_remaining : 14;

            return (
              <View key={sub.id} style={styles.subjectCard}>
                {/* Header: Subject Name + Delete Trash Icon Button */}
                <View style={styles.subjectCardHeader}>
                  <Text style={styles.subjectName}>{sub.name}</Text>
                  <TouchableOpacity
                    style={styles.deleteSubjectBtn}
                    onPress={() => handleDeleteSubject(sub.id, sub.name)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    activeOpacity={0.7}
                    accessibilityLabel="Delete subject"
                  >
                    <Trash2 size={16} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                {/* Consolidated Metadata Badges Row: [A+ Target • High • 16d left] */}
                <View style={styles.compactMetaRow}>
                  <View style={styles.compactMetaPill}>
                    <Award size={12} color="#0D9488" style={{ marginRight: 4 }} />
                    <Text style={styles.compactMetaText}>
                      {sub.target_grade || 'A+'} Target • {sub.difficulty || 'High'} • {daysRem === 0 ? 'Exam Today' : `${daysRem}d left`}
                    </Text>
                  </View>
                </View>

                {/* Dynamic Progress Bar */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressLabelRow}>
                    <Text style={styles.progressTitle}>Topic Mastery</Text>
                    <Text style={styles.progressPercentage}>
                      {completedCount}/{totalCount} Completed ({completionPct}%)
                    </Text>
                  </View>
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.max(0, Math.min(100, completionPct))}%`,
                          backgroundColor: completionPct >= 80 ? '#0D9488' : '#14B8A6',
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Topic Mastery Checklist: Interactive checkbox + Topic name */}
                <View style={styles.checklistSection}>
                  {topics.length > 0 ? (
                    topics.map((topic, idx) => {
                      const isCompleted = Boolean(topic.completed);
                      const topicTitle = topic.name || topic.title;
                      return (
                        <TouchableOpacity
                          key={topic.id || `${sub.id}-${topicTitle}-${idx}`}
                          style={styles.topicCheckRow}
                          onPress={() => handleToggleTopic(sub.id, topic)}
                          activeOpacity={0.7}
                        >
                          {isCompleted ? (
                            <CheckCircle2 size={19} color="#0D9488" />
                          ) : (
                            <Circle size={19} color="#CBD5E1" />
                          )}
                          <Text
                            style={[
                              styles.topicTitle,
                              isCompleted && styles.topicTitleCompleted,
                            ]}
                          >
                            {topicTitle}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text style={styles.noTopicsText}>No modules enrolled yet.</Text>
                  )}
                </View>

                {/* Expandable Task Decomposer Section */}
                <View style={styles.decomposerContainer}>
                  <TouchableOpacity
                    style={styles.decomposerToggleBtn}
                    onPress={() => setExpandedDecomposerId((prev) => (prev === sub.id ? null : sub.id))}
                    activeOpacity={0.7}
                    accessibilityLabel="Deconstruct Assignment Workload"
                  >
                    <View style={styles.decomposerToggleLeft}>
                      <Ionicons name="document-text-outline" size={16} color="#0D9488" style={{ marginRight: 8 }} />
                      <Text style={styles.decomposerToggleTitle}>Deconstruct Assignment Workload</Text>
                    </View>
                    <ChevronDown
                      size={16}
                      color="#0D9488"
                      style={{ transform: [{ rotate: expandedDecomposerId === sub.id ? '180deg' : '0deg' }] }}
                    />
                  </TouchableOpacity>

                  {expandedDecomposerId === sub.id && (
                    <View style={styles.decomposerContent}>
                      <TextInput
                        style={styles.decomposerTextInput}
                        placeholder="Paste coursework requirements or project topics..."
                        placeholderTextColor="#94A3B8"
                        multiline
                        numberOfLines={3}
                        value={assignmentInputMap[sub.id] || ''}
                        onChangeText={(val) => setAssignmentInputMap((prev) => ({ ...prev, [sub.id]: val }))}
                      />
                      <TouchableOpacity
                        style={styles.decomposerActionBtn}
                        onPress={() => handleDecomposeTasks(sub.id)}
                        disabled={decomposingLoadingId === sub.id}
                        activeOpacity={0.8}
                      >
                        {decomposingLoadingId === sub.id ? (
                          <ActivityIndicator size="small" color="#0D9488" style={{ marginRight: 6 }} />
                        ) : (
                          <Ionicons name="document-text-outline" size={15} color="#0D9488" style={{ marginRight: 6 }} />
                        )}
                        <Text style={styles.decomposerActionBtnText}>
                          {decomposingLoadingId === sub.id ? 'Deconstructing Tasks...' : 'Break Down Tasks'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* --- INTERACTIVE "ADD SUBJECT & MODULE" MODAL --- */}
      <Modal
        visible={isAddModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsAddModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContentCard}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <GraduationCap size={20} color="#0D9488" />
                <Text style={styles.modalHeaderTitle}>Enroll New Subject</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsAddModalVisible(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              {/* Field 1: Subject Name */}
              <Text style={styles.fieldLabel}>Subject Name</Text>
              <TextInput
                style={styles.inputField}
                placeholder="e.g., Distributed Systems"
                placeholderTextColor="#94A3B8"
                value={newSubjectName}
                onChangeText={setNewSubjectName}
              />

              {/* Field 2: Exam / Deadline Date */}
              <Text style={styles.fieldLabel}>Days Remaining Until Exam</Text>
              <TextInput
                style={styles.inputField}
                placeholder="e.g., 18"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={newDaysRemaining}
                onChangeText={setNewDaysRemaining}
              />

              {/* Field 3: Perceived Difficulty Selector Chips */}
              <Text style={styles.fieldLabel}>Perceived Difficulty</Text>
              <View style={styles.difficultyChipsRow}>
                {['High', 'Medium', 'Low'].map((lvl) => {
                  const isSelected = newDifficulty === lvl;
                  return (
                    <TouchableOpacity
                      key={lvl}
                      style={[
                        styles.diffChip,
                        isSelected && styles.diffChipSelected,
                      ]}
                      onPress={() => setNewDifficulty(lvl)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.diffChipText,
                          isSelected && styles.diffChipTextSelected,
                        ]}
                      >
                        {lvl}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Field 4: Topics / Modules Builder */}
              <Text style={styles.fieldLabel}>Modules / Topics Checklist</Text>
              <View style={styles.topicInputRow}>
                <TextInput
                  style={[styles.inputField, { flex: 1, marginBottom: 0 }]}
                  placeholder="e.g., Raft Consensus & Log Compaction"
                  placeholderTextColor="#94A3B8"
                  value={currentTopicInput}
                  onChangeText={setCurrentTopicInput}
                  onSubmitEditing={handleAddTopicChip}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={styles.addTopicBtn}
                  onPress={handleAddTopicChip}
                  activeOpacity={0.8}
                >
                  <Plus size={16} color="#FFFFFF" />
                  <Text style={styles.addTopicBtnText}>Add</Text>
                </TouchableOpacity>
              </View>

              {/* Topics Preview Chips / List */}
              {newTopicsList.length > 0 && (
                <View style={styles.topicChipsList}>
                  {newTopicsList.map((top, idx) => (
                    <View key={idx} style={styles.topicPreviewChip}>
                      <Text style={styles.topicPreviewText}>{top}</Text>
                      <TouchableOpacity
                        onPress={() => handleRemoveTopicChip(idx)}
                        style={styles.removeTopicBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <X size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Submit CTA: "Create Study Plan" styled in Teal (#0D9488) */}
              <TouchableOpacity
                style={[
                  styles.submitPlanBtn,
                  isSubmittingSubject && styles.submitPlanBtnDisabled,
                ]}
                onPress={handleCreateSubject}
                disabled={isSubmittingSubject}
                activeOpacity={0.88}
              >
                {isSubmittingSubject ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <BookOpen size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.submitPlanBtnText}>Create Study Plan</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F7F6',
    position: 'relative',
  },
  safeArea: {
    flex: 1,
  },
  loadingCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#0D9488',
    fontWeight: '600',
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
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerBadge: {
    backgroundColor: '#E6F4F1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  headerBadgeText: {
    fontSize: 10,
    color: '#0F766E',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  toastNotification: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDFA',
    borderBottomWidth: 1,
    borderBottomColor: '#99F6E4',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  toastNotificationText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F766E',
  },
  pacingBanner: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginTop: 0,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  pacingBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pacingBannerTitleBox: {
    flex: 1,
  },
  pacingBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F766E',
    marginBottom: 4,
  },
  adaptiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#CCFBF1',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  adaptiveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },
  pacingCopy: {
    fontSize: 13,
    color: '#134E4A',
    lineHeight: 19,
    marginBottom: 10,
  },
  biometricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  biometricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  biometricPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F766E',
  },
  startTimerCTA: {
    backgroundColor: '#0D9488',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  startTimerCTAText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  subjectCountBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  subjectCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  subjectCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  subjectCardHeader: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  subjectName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginRight: 8,
  },
  deleteSubjectBtn: {
    position: 'relative',
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  compactMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  compactMetaText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F766E',
  },
  emptyStateCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptyStateSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  emptyStateAddBtn: {
    backgroundColor: '#0D9488',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 14,
    elevation: 2,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  emptyStateAddBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  progressContainer: {
    marginBottom: 14,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  progressPercentage: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D9488',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  checklistSection: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    gap: 9,
  },
  topicCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  topicTitle: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '500',
    flex: 1,
    lineHeight: 18,
  },
  topicTitleCompleted: {
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  noTopicsText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  // Top Study Hero Banner Card
  heroBannerCard: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    position: 'relative',
  },
  heroBannerImage: {
    height: 135,
    width: '100%',
  },
  heroBannerOverlayBadge: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  heroBannerOverlayBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
    letterSpacing: 0.2,
  },

  // Horizontal Action Row: Search Bar + Compact Teal + Enroll Button
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    paddingHorizontal: 12,
    height: 46,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 0,
  },
  topEnrollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D9488',
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 16,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  topEnrollBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  clearSearchBtn: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#0D9488',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 8,
  },
  clearSearchBtnText: {
    color: '#0D9488',
    fontSize: 12.5,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: 18,
  },
  modalContentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  inputField: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    marginBottom: 14,
  },
  difficultyChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  diffChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  diffChipSelected: {
    borderColor: '#0D9488',
    backgroundColor: '#F0FDFA',
  },
  diffChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  diffChipTextSelected: {
    color: '#0D9488',
    fontWeight: '800',
  },
  topicInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  addTopicBtn: {
    backgroundColor: '#0D9488',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    gap: 4,
  },
  addTopicBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  topicChipsList: {
    flexDirection: 'column',
    gap: 6,
    marginBottom: 16,
  },
  topicPreviewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  topicPreviewText: {
    fontSize: 12,
    color: '#0F766E',
    fontWeight: '600',
    flex: 1,
  },
  removeTopicBtn: {
    padding: 2,
  },
  submitPlanBtn: {
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
    marginTop: 8,
    marginBottom: 6,
  },
  submitPlanBtnDisabled: {
    opacity: 0.7,
  },
  submitPlanBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  // Exam Crunch Mode Banner
  crunchModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
  },
  crunchModeBannerText: {
    color: '#0F766E',
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1,
  },
  // Task Decomposer in Subject Card
  decomposerContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  decomposerToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  decomposerToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  decomposerToggleTitle: {
    color: '#0D9488',
    fontSize: 13,
    fontWeight: '700',
  },
  decomposerContent: {
    marginTop: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  decomposerTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 65,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  decomposerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#0D9488',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  decomposerActionBtnText: {
    color: '#0D9488',
    fontSize: 13,
    fontWeight: '700',
  },
});
