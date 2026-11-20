import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, 
  Alert, ActivityIndicator, RefreshControl, Image, Modal, TextInput 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import { 
  User, Settings, Bell, FileText, 
  Camera, ChevronRight, LogOut, ShieldCheck 
} from 'lucide-react-native';

// API Services
import { 
  getUserProfile, 
  getUserAnalytics,
  logoutUser, 
  exportData,
  updateProfile 
} from '../api/authService';

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
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
      console.error("Image loading error:", e);
    }
  };

  const fetchUserData = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        navigation.replace('Login');
        return;
      }

      const [profileRes, analyticsRes] = await Promise.allSettled([
        getUserProfile(),
        getUserAnalytics(),
      ]);

      const userData = profileRes.status === 'fulfilled' ? profileRes.value.data : {};
      const analyticsData = analyticsRes.status === 'fulfilled' 
        ? (analyticsRes.value?.data?.data || analyticsRes.value?.data) 
        : null;

      const initials = userData.name
        ? userData.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
        : 'U';

      // 1. Resolve Entries Logged from actual analytics endpoint
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

      // 2. Resolve Avg Stress from actual analytics endpoint
      let avgStressVal = '0.0';
      if (analyticsData && analyticsData.avg_stress !== undefined && analyticsData.avg_stress !== null) {
        const num = Number(analyticsData.avg_stress);
        if (!isNaN(num) && num > 0) {
          avgStressVal = num.toFixed(1);
        }
      }
      if (avgStressVal === '0.0' && userData.insights?.avg_stress) {
        const num = Number(userData.insights.avg_stress);
        if (!isNaN(num) && num > 0) {
          avgStressVal = num.toFixed(1);
        }
      }

      // Fallback to cached latest assessment if available
      if (avgStressVal === '0.0' || entriesCount === 0) {
        try {
          const cached = await AsyncStorage.getItem('mindcare_latest_assessment');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (avgStressVal === '0.0' && (parsed?.pss_score || parsed?.predicted_stress_score)) {
              const s = Number(parsed.pss_score || parsed.predicted_stress_score);
              if (!isNaN(s)) avgStressVal = s.toFixed(1);
            }
            if (entriesCount === 0) {
              entriesCount = 1;
            }
          }
        } catch (e) {
          // ignore
        }
      }

      setUser({
        name: userData.name || 'Student',
        email: userData.email || '',
        avatar: initials,
        stats: { 
          days: userData.days_active || '1', 
          entries: String(entriesCount), 
          stress: avgStressVal 
        }
      });
      if (userData.name) {
        setNewName(userData.name); 
      }
    } catch (error) {
      console.error("Profile Fetch Error:", error);
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
      Alert.alert("Error", "Name cannot be empty.");
      return;
    }

    try {
      setLoading(true);
      await updateProfile({ name: newName.trim() });
      setEditModalVisible(false);
      fetchUserData();
      Alert.alert("Success", "Profile updated successfully!");
    } catch (error) {
      Alert.alert("Update Error", "Failed to update profile name.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      "Confirm Logout",
      "Are you sure you want to log out of MindCare?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Logout", 
          style: "destructive", 
          onPress: async () => {
            try {
              await logoutUser();
            } catch (e) {
              // Proceed with local logout regardless of network
            }
            await AsyncStorage.multiRemove(['userToken', '@mindcare_cached_profile']);
            navigation.replace('Login');
          } 
        }
      ]
    );
  };

  const handleExportData = async () => {
    try {
      setLoading(true);
      const res = await exportData();
      const exportInfo = res.data;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 30px; color: #1E293B; background: #F8FAFC; }
              .header { text-align: center; border-bottom: 3px solid #0D9488; padding-bottom: 20px; margin-bottom: 25px; }
              .title { color: #0D9488; font-size: 26px; font-weight: bold; margin-bottom: 4px; }
              .card { background: #FFFFFF; border: 1px solid #E2E8F0; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; background: #FFF; border-radius: 8px; overflow: hidden; }
              th { background: #0F766E; color: white; padding: 12px; text-align: left; }
              td { padding: 12px; border-bottom: 1px solid #E2E8F0; }
              .footer { text-align: center; margin-top: 35px; font-size: 11px; color: #94A3B8; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">MindCare Clinical Health Summary</div>
              <p style="color: #64748B; text-transform: uppercase; letter-spacing: 1px; font-size: 11px;">Professional Behavioral Analytics Record</p>
            </div>
            <div class="card">
              <p><strong>Patient / User:</strong> ${user?.name}</p>
              <p><strong>Export Timestamp:</strong> ${exportInfo.export_date || new Date().toLocaleDateString()}</p>
              <p><strong>Mean Stress Level:</strong> <span style="color: #0D9488; font-weight: bold;">${exportInfo.data?.avg_stress || 'N/A'}/10</span></p>
            </div>
            <h3 style="color: #0F766E;">Longitudinal Mental Health Observations</h3>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Stress Rating</th>
                  <th>Clinical Context</th>
                </tr>
              </thead>
              <tbody>
                ${exportInfo.data?.history?.map(item => `
                  <tr>
                    <td>${new Date(item.date).toLocaleDateString()}</td>
                    <td><strong>${item.score}/10</strong></td>
                    <td style="color: #64748B;">Recorded via MindCare Clinical Engine</td>
                  </tr>
                `).join('') || '<tr><td colspan="3" style="text-align:center; padding:20px; color:#64748B;">No records found</td></tr>'}
              </tbody>
            </table>
            <div class="footer">
              <p>© 2026 MindCare Clinical System • Generated securely for ${user?.name}</p>
            </div>
          </body>
        </html>
      `;

      await Print.printAsync({ html: htmlContent });
    } catch (error) {
      const msg = error?.message || '';
      if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('dismiss')) {
        console.error("Export error:", error);
        Alert.alert("Export Failed", "Could not generate clinical health summary: " + msg);
      }
    } finally {
      setLoading(false);
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

  const StatBox = ({ label, value }) => (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const MenuOption = ({ icon: Icon, title, color = "#1E293B", showArrow = true, onPress, children }) => (
    <TouchableOpacity style={styles.menuOption} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuLeft}>
        <View style={styles.menuIconBg}><Icon size={20} color={color === "#1E293B" ? "#0D9488" : color} /></View>
        <Text style={[styles.menuTitle, { color }]}>{title}</Text>
      </View>
      {showArrow ? <ChevronRight size={20} color="#94A3B8" /> : children}
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0D9488" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0D9488"]} />}
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerText}>Profile</Text>
          <TouchableOpacity style={styles.settingsBtn}>
            <Settings size={22} color="#0D9488" />
          </TouchableOpacity>
        </View>

        {/* User Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>{user?.avatar}</Text>
              )}
            </View>
            <TouchableOpacity style={styles.cameraIcon} onPress={pickImage}>
              <Camera size={14} color="#FFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <View style={styles.verifiedBadge}>
              <ShieldCheck size={12} color="#0F766E" style={{ marginRight: 4 }} />
              <Text style={styles.verifiedText}>Verified Clinical Account</Text>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatBox value={user?.stats.days} label="Days Active" />
          <StatBox value={user?.stats.entries} label="Entries Logged" />
          <StatBox value={user?.stats.stress} label="Avg Stress" />
        </View>

        {/* Section 1: Account Management */}
        <Text style={styles.sectionTitle}>ACCOUNT MANAGEMENT</Text>
        <View style={styles.sectionCard}>
          <MenuOption icon={User} title="Edit Profile" onPress={() => setEditModalVisible(true)} />
          <MenuOption icon={Bell} title="Notifications" showArrow={false}>
            <Switch 
              value={notificationsEnabled} 
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#E2E8F0', true: '#0D9488' }}
              thumbColor={notificationsEnabled ? '#FFFFFF' : '#F8FAFC'}
            />
          </MenuOption>
        </View>

        {/* Section 2: Reports & Exit */}
        <Text style={styles.sectionTitle}>REPORTS & SESSION</Text>
        <View style={styles.sectionCard}>
          <MenuOption icon={FileText} title="Export Clinical Summary" onPress={handleExportData} />
          <MenuOption icon={LogOut} title="Logout" color="#EF4444" onPress={handleLogout} />
        </View>
      </ScrollView>

      {/* --- EDIT NAME MODAL --- */}
      <Modal visible={isEditModalVisible} transparent animationType="fade">
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, alignItems: 'center' },
  headerText: { fontSize: 26, fontWeight: '800', color: '#1E293B' },
  settingsBtn: { padding: 9, backgroundColor: '#E6F4F1', borderRadius: 14 },
  profileCard: { 
    backgroundColor: '#FFFFFF', 
    padding: 20, 
    borderRadius: 24, 
    flexDirection: 'row', 
    alignItems: 'center', 
    elevation: 2, 
    shadowColor: '#0F172A', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
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
  userName: { fontSize: 19, fontWeight: '800', color: '#1E293B' },
  userEmail: { color: '#64748B', fontSize: 13, marginTop: 2 },
  verifiedBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#E6F4F1', 
    paddingHorizontal: 9, 
    paddingVertical: 4, 
    borderRadius: 10, 
    marginTop: 6, 
    alignSelf: 'flex-start' 
  },
  verifiedText: { color: '#0F766E', fontSize: 11, fontWeight: '700' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 22 },
  statBox: { 
    backgroundColor: '#FFFFFF', 
    padding: 16, 
    borderRadius: 20, 
    width: '31%', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#E2E8F0',
    elevation: 1 
  },
  statValue: { fontSize: 20, fontWeight: '800', color: '#0F766E' },
  statLabel: { fontSize: 11, color: '#64748B', marginTop: 4, fontWeight: '600' },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#64748B', marginBottom: 12, marginLeft: 5, letterSpacing: 0.8 },
  sectionCard: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 22, 
    paddingHorizontal: 16, 
    marginBottom: 22, 
    borderWidth: 1, 
    borderColor: '#E2E8F0',
    elevation: 1 
  },
  menuOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  menuLeft: { flexDirection: 'row', alignItems: 'center' },
  menuIconBg: { backgroundColor: '#E6F4F1', padding: 10, borderRadius: 14, marginRight: 14 },
  menuTitle: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#FFFFFF', padding: 24, borderRadius: 24, elevation: 10 },
  modalTitle: { fontSize: 19, fontWeight: '800', color: '#1E293B', marginBottom: 16 },
  input: { borderBottomWidth: 2, borderBottomColor: '#0D9488', marginBottom: 25, padding: 10, fontSize: 16, color: '#1E293B' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  cancelBtn: { marginRight: 22 },
  cancelBtnText: { color: '#64748B', fontWeight: '600', fontSize: 15 },
  updateBtn: { backgroundColor: '#0D9488', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 14 },
  updateBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 }
});