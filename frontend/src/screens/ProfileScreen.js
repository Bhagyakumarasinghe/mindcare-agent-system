import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  Alert, ActivityIndicator, RefreshControl, Image, Modal, TextInput, StatusBar 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { 
  User, FileText, 
  Camera, ChevronRight, LogOut, ShieldCheck 
} from 'lucide-react-native';

// API Services & Clinical Report Pipeline
import { 
  getUserProfile, 
  getUserAnalytics,
  logoutUser, 
  updateProfile 
} from '../api/authService';
import { exportClinicalPDF } from '../utils/clinicalReportPdf';
import { getActivityStats, computeWeeklyStressTrend, clearLegacyGlobalStorage } from '../utils/activityTracker';
import { invalidateAnalyticsCache } from './AnalyticsScreen';

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState({
    id: '',
    name: 'Student',
    email: '',
    avatar: 'S',
    stats: { days: '1', entries: '0', stress: '--' },
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [profileImage, setProfileImage] = useState(null);

  // Edit Profile Modal States
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [newName, setNewName] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
      loadStoredProfileImage();
    }, [])
  );

  const loadStoredProfileImage = async () => {
    try {
      const savedImage = await AsyncStorage.getItem('user_profile_image');
      if (savedImage) setProfileImage(savedImage);
    } catch (e) {
      console.warn('Image loading notice:', e?.message || e);
    }
  };

  const fetchUserData = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        navigation.replace('Login');
        return;
      }

      // Read cached profile first for instant rendering
      let cachedProfData = null;
      try {
        const cached = await AsyncStorage.getItem('@mindcare_cached_profile');
        if (cached) {
          cachedProfData = JSON.parse(cached);
        }
      } catch {
        // ignore
      }

      const activeUserId = cachedProfData?.id || cachedProfData?.user_id || '';

      const [profileRes, analyticsRes, biometricsRaw] = await Promise.allSettled([
        getUserProfile(),
        getUserAnalytics(),
        activeUserId
          ? AsyncStorage.getItem(`@mindcare_latest_biometrics_${activeUserId}`)
          : Promise.resolve(null),
      ]);

      const userData = profileRes.status === 'fulfilled' ? profileRes.value.data : (cachedProfData || {});
      const analyticsData = analyticsRes.status === 'fulfilled' 
        ? (analyticsRes.value?.data?.data || analyticsRes.value?.data) 
        : null;

      let latestBio = null;
      if (biometricsRaw.status === 'fulfilled' && biometricsRaw.value) {
        try { latestBio = JSON.parse(biometricsRaw.value); } catch {}
      }

      const initials = userData.name
        ? userData.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
        : 'U';

      // 1. Calculate Real Days Active from unique activity dates
      const uniqueDays = new Set();
      if (analyticsData?.history && Array.isArray(analyticsData.history)) {
        analyticsData.history.forEach((h) => {
          if (h.date) {
            const d = new Date(String(h.date).split('.')[0].replace('Z', ''));
            if (!isNaN(d.getTime())) uniqueDays.add(d.toDateString());
          }
        });
      }
      if (analyticsData?.recent_mood_logs && Array.isArray(analyticsData.recent_mood_logs)) {
        analyticsData.recent_mood_logs.forEach((m) => {
          const rawD = m.date || m.timestamp;
          if (rawD) {
            const d = new Date(String(rawD).split('.')[0].replace('Z', ''));
            if (!isNaN(d.getTime())) uniqueDays.add(d.toDateString());
          }
        });
      }
      if (latestBio) {
        const rawD = latestBio.date || latestBio.timestamp;
        if (rawD) {
          const d = new Date(String(rawD).split('.')[0].replace('Z', ''));
          if (!isNaN(d.getTime())) uniqueDays.add(d.toDateString());
        }
      }

      // Neutral default: display 1 day if new or 0 distinct entries
      const daysActiveCount = uniqueDays.size > 0 
        ? uniqueDays.size 
        : Number(userData.days_active || 1);

      // 2. Resolve Entries Logged from actual analytics
      let entriesCount = 0;
      if (analyticsData) {
        if (analyticsData.entries_count !== undefined && analyticsData.entries_count !== null) {
          entriesCount = Number(analyticsData.entries_count);
        } else if (analyticsData.total_entries !== undefined && analyticsData.total_entries !== null) {
          entriesCount = Number(analyticsData.total_entries);
        } else {
          const asmtCount = Number(analyticsData.total_assessments || (analyticsData.history || []).length || 0);
          const moodCount = Number(analyticsData.recent_mood_logs ? analyticsData.recent_mood_logs.length : 0);
          entriesCount = asmtCount + moodCount;
        }
      }
      if (entriesCount === 0 && userData.entries_count) {
        entriesCount = Number(userData.entries_count);
      }

      // 3. Resolve Avg Stress from real analytics & biometrics (honest neutral '--' for new users)
      let avgStressVal = '--';
      if (analyticsData && analyticsData.avg_stress !== undefined && analyticsData.avg_stress !== null) {
        const num = Number(analyticsData.avg_stress);
        if (!isNaN(num) && num > 0) {
          avgStressVal = num.toFixed(1);
        }
      }
      if (avgStressVal === '--' && latestBio) {
        const bioStress = latestBio.stress_score ?? latestBio.stress_level;
        if (bioStress !== undefined && bioStress !== null && !isNaN(Number(bioStress)) && Number(bioStress) > 0) {
          avgStressVal = Number(bioStress).toFixed(1);
        }
      }
      if (avgStressVal === '--' && userData.insights?.avg_stress) {
        const num = Number(userData.insights.avg_stress);
        if (!isNaN(num) && num > 0) {
          avgStressVal = num.toFixed(1);
        }
      }

      setUser({
        id: userData.id || userData.user_id || activeUserId,
        name: userData.name || userData.full_name || 'Student',
        email: userData.email || 'student@mindcare.edu',
        avatar: initials,
        stats: { 
          days: String(daysActiveCount), 
          entries: String(entriesCount), 
          stress: avgStressVal 
        }
      });
      if (userData.name || userData.full_name) {
        setNewName(userData.name || userData.full_name); 
      }
    } catch (error) {
      console.warn('Profile Fetch Note:', error?.message || error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserData();
  };

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Name cannot be empty.');
      return;
    }

    try {
      setLoading(true);
      await updateProfile({ name: newName.trim() });
      setEditModalVisible(false);
      fetchUserData();
      Alert.alert('Success', 'Profile updated successfully!');
    } catch {
      Alert.alert('Update Error', 'Failed to update profile name.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to log out of MindCare?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await logoutUser();
            } catch {
              // Proceed with local logout regardless of network hiccups
            }
            await clearLegacyGlobalStorage();
            try { invalidateAnalyticsCache(); } catch {}
            await AsyncStorage.multiRemove(['userToken', '@mindcare_cached_profile']);
            navigation.replace('Login');
          } 
        }
      ]
    );
  };

  // Android-Safe Clinical PDF Report Export (Identical to AnalyticsScreen)
  const handleExportData = async () => {
    if (isExporting) return;
    try {
      setIsExporting(true);

      // Fetch fresh analytics payload for report generation
      let analyticsPayload = null;
      try {
        const aRes = await getUserAnalytics();
        analyticsPayload = aRes?.data?.data || aRes?.data || null;
      } catch (err) {
        console.warn('Analytics report fetch note:', err?.message || err);
      }

      // Gather live activity stats
      const actStats = await getActivityStats(user?.id);

      // Read latest local biometrics if any
      let localBio = null;
      try {
        if (user?.id) {
          const bioRaw = await AsyncStorage.getItem(`@mindcare_latest_biometrics_${user.id}`);
          if (bioRaw) localBio = JSON.parse(bioRaw);
        }
      } catch {
        // ignore
      }

      const dynamicStress =
        user?.stats?.stress && user.stats.stress !== '--'
          ? Number(user.stats.stress)
          : analyticsPayload?.avg_stress ?? (localBio?.stress_score ?? 4.0);

      const dynamicSleep =
        localBio?.sleep_hours !== undefined
          ? Number(localBio.sleep_hours)
          : analyticsPayload?.avg_sleep ?? 7.0;

      const primaryTrigger =
        analyticsPayload?.common_trigger || 'General Academic Studies';

      const weeklyMetrics = computeWeeklyStressTrend(
        analyticsPayload?.history,
        analyticsPayload?.recent_mood_logs,
        localBio
      );

      const combinedData = {
        ...(analyticsPayload || {}),
        user_name: user?.name || 'Student',
        patient_id: analyticsPayload?.patient_id || 'MC-10492',
        avg_stress: dynamicStress,
        avg_sleep: dynamicSleep,
        study_hours: analyticsPayload?.study_hours ?? 5.5,
        common_trigger: primaryTrigger,
        primary_stress_vector: primaryTrigger,
        trigger_percentage: analyticsPayload?.trigger_percentage || '40%',
        variance: analyticsPayload?.variance ?? 0,
        is_baseline: analyticsPayload?.is_baseline ?? true,
        recent_mood_logs: analyticsPayload?.recent_mood_logs || [],
        weekly_metrics: weeklyMetrics,
        mood_distribution: [],
        stress_factors: [],
        activity_stats: actStats,
        activity_summary: {
          mood_count: Number(user?.stats?.entries || 0),
          support_count: analyticsPayload?.total_chats ?? 0,
          assessment_count: analyticsPayload?.total_assessments ?? (analyticsPayload?.history?.length || 0),
          relaxation_count: actStats.relaxSessions || (analyticsPayload?.total_relaxations ?? 0),
          study_sessions: actStats.studySessions || 0,
          study_minutes: actStats.studyMinutes || (actStats.studySessions * 25),
        },
      };

      await exportClinicalPDF(combinedData, setIsExporting);
    } catch (error) {
      const msg = error?.message || '';
      if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('dismiss')) {
        console.warn('PDF export error:', error);
        Alert.alert('Export Notice', 'Unable to complete PDF export: ' + msg);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (!result.canceled) {
      const selectedUri = result.assets[0].uri;
      setProfileImage(selectedUri);
      await AsyncStorage.setItem('user_profile_image', selectedUri);
    }
  };

  const MenuOption = ({ icon: Icon, title, color = '#0F172A', showArrow = true, onPress, children }) => (
    <TouchableOpacity style={styles.menuOption} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuLeft}>
        <View style={styles.menuIconBg}>
          <Icon size={19} color={color === '#0F172A' ? '#0D9488' : color} strokeWidth={2.2} />
        </View>
        <Text style={[styles.menuTitle, { color }]}>{title}</Text>
      </View>
      {showArrow ? <ChevronRight size={18} color="#94A3B8" strokeWidth={2.2} /> : children}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#EDF5F4" translucent={false} />
      {/* Signature Ambient Translucent Mint-Teal & Soft Aqua Background Circles */}
      <View pointerEvents="none" style={styles.ambientOrbTop} />
      <View pointerEvents="none" style={styles.ambientOrbMiddle} />
      <View pointerEvents="none" style={styles.ambientOrbBottom} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0D9488']} />}
        >
          {/* Header Row (Clean without redundant settings gear icon) */}
          <View style={styles.headerRow}>
            <Text style={styles.headerText}>Profile</Text>
          </View>

          {/* User Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarText}>{user?.avatar || 'U'}</Text>
                )}
              </View>
              <TouchableOpacity style={styles.cameraIcon} onPress={pickImage} activeOpacity={0.8}>
                <Camera size={13} color="#FFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.name || 'Student'}</Text>
              <Text style={styles.userEmail}>{user?.email || 'student@mindcare.edu'}</Text>
              <View style={styles.verifiedBadge}>
                <ShieldCheck size={12} color="#0F766E" style={{ marginRight: 4 }} />
                <Text style={styles.verifiedText}>Verified Clinical Account</Text>
              </View>
            </View>
          </View>

          {/* Section 1: Account Management */}
          <Text style={styles.sectionTitle}>ACCOUNT MANAGEMENT</Text>
          <View style={styles.sectionCard}>
            <MenuOption icon={User} title="Edit Profile" onPress={() => setEditModalVisible(true)} />
          </View>

          {/* Section 2: Reports & Session */}
          <Text style={styles.sectionTitle}>REPORTS & SESSION</Text>
          <View style={styles.sectionCard}>
            <MenuOption 
              icon={FileText} 
              title={isExporting ? 'Generating Summary...' : 'Export Clinical Summary'} 
              onPress={handleExportData} 
            />
            <MenuOption icon={LogOut} title="Logout" color="#EF4444" onPress={handleLogout} />
          </View>
        </ScrollView>

        {/* --- EDIT NAME MODAL --- */}
        <Modal visible={isEditModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Update Full Name</Text>
              <TextInput 
                style={styles.input} 
                value={newName} 
                onChangeText={setNewName}
                placeholder="Enter your name"
                autoFocus={true}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleUpdateName} style={styles.updateBtn}>
                  <Text style={styles.updateBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#EDF5F4' 
  },
  safeArea: { 
    flex: 1 
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#EDF5F4' 
  },
  content: { 
    paddingHorizontal: 20, 
    paddingTop: 16, 
    paddingBottom: 120 
  },
  // Signature Ambient Background Circles (Matching HomeScreen.js & RelaxScreen.js)
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
    bottom: 100,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
  },
  headerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 20, 
    alignItems: 'center' 
  },
  headerText: { 
    fontSize: 26, 
    fontWeight: '800', 
    color: '#0F172A',
    letterSpacing: -0.4 
  },
  profileCard: { 
    backgroundColor: 'rgba(255, 255, 255, 0.94)', 
    padding: 20, 
    borderRadius: 24, 
    flexDirection: 'row', 
    alignItems: 'center', 
    elevation: 3, 
    shadowColor: '#64748B', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.08, 
    shadowRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    marginBottom: 24
  },
  avatarContainer: { position: 'relative', marginRight: 18 },
  avatar: { 
    width: 76, 
    height: 76, 
    borderRadius: 38, 
    backgroundColor: '#0D9488', 
    justifyContent: 'center', 
    alignItems: 'center', 
    overflow: 'hidden' 
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: 38 },
  avatarText: { color: '#FFFFFF', fontSize: 26, fontWeight: '800' },
  cameraIcon: { 
    position: 'absolute', 
    bottom: 0, 
    right: 0, 
    backgroundColor: '#0F766E', 
    padding: 7, 
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF'
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 19, fontWeight: '800', color: '#0F172A' },
  userEmail: { color: '#64748B', fontSize: 13, marginTop: 2 },
  verifiedBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F0FDFA', 
    paddingHorizontal: 9, 
    paddingVertical: 4, 
    borderRadius: 10, 
    marginTop: 6, 
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#CCFBF1'
  },
  verifiedText: { color: '#0F766E', fontSize: 11, fontWeight: '700' },
  sectionTitle: { fontSize: 11.5, fontWeight: '800', color: '#64748B', marginBottom: 10, marginLeft: 4, letterSpacing: 0.8 },
  sectionCard: { 
    backgroundColor: 'rgba(255, 255, 255, 0.94)', 
    borderRadius: 22, 
    paddingHorizontal: 16, 
    marginBottom: 20, 
    borderWidth: 1.5, 
    borderColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8
  },
  menuOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  menuLeft: { flexDirection: 'row', alignItems: 'center' },
  menuIconBg: { backgroundColor: '#F0FDFA', padding: 10, borderRadius: 14, marginRight: 14, borderWidth: 1, borderColor: '#CCFBF1' },
  menuTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#FFFFFF', padding: 24, borderRadius: 24, elevation: 10 },
  modalTitle: { fontSize: 19, fontWeight: '800', color: '#0F172A', marginBottom: 16 },
  input: { borderBottomWidth: 2, borderBottomColor: '#0D9488', marginBottom: 25, padding: 10, fontSize: 16, color: '#0F172A' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  cancelBtn: { marginRight: 22 },
  cancelBtnText: { color: '#64748B', fontWeight: '600', fontSize: 15 },
  updateBtn: { backgroundColor: '#0D9488', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 14 },
  updateBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 }
});
