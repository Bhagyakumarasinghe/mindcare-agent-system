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
  Camera, ChevronRight, LogOut 
} from 'lucide-react-native';

// API Services
import { 
  getUserProfile, 
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

      const response = await getUserProfile();
      const userData = response.data;
      
      const initials = userData.name
        ? userData.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
        : 'U';

      setUser({
        name: userData.name,
        email: userData.email,
        avatar: initials,
        stats: { 
          days: userData.days_active || '1', 
          entries: userData.entries_count || '0', 
          stress: userData.insights?.avg_stress || '0.0' 
        }
      });
      setNewName(userData.name); 
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
      const response = await updateProfile({ name: newName.trim() });
      
      if (response.data.status === "success") {
        setUser(prev => ({ ...prev, name: newName.trim() }));
        setEditModalVisible(false);
        Alert.alert("Success", "Profile updated successfully!");
      }
    } catch (error) {
      console.error("Update Error:", error.response?.data);
      Alert.alert("Update Failed", "Could not update profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to exit?", [
      { text: "Cancel" },
      { text: "Logout", onPress: async () => {
        try {
          await logoutUser();
        } catch (e) {
          console.log("Logout error:", e);
        } finally {
          await AsyncStorage.removeItem('userToken');
          navigation.replace('Login');
        }
      }, style: 'destructive' }
    ]);
  };

  const handleExportData = async () => {
    setLoading(true);
    try {
      const response = await exportData();
      const exportInfo = response.data;

      const htmlContent = `
        <html>
          <body style="font-family: sans-serif; padding: 40px; color: #333;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #4F75FF; margin-bottom: 5px;">MindCare Health Summary</h1>
                <p style="color: #666;">Professional Behavioral Analytics Report</p>
            </div>
            <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                <p><strong>User Name:</strong> ${user?.name}</p>
                <p><strong>Report Date:</strong> ${exportInfo.export_date || new Date().toLocaleDateString()}</p>
                <p><strong>Average Stress Score:</strong> <span style="color: #4F75FF; font-weight: bold;">${exportInfo.data?.avg_stress || 'N/A'}</span></p>
            </div>
            <hr border="0" style="border-top: 1px solid #eee; margin: 20px 0;"/>
            <h3>Mental Health History</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
              <thead>
                <tr style="background: #4F75FF; color: white; text-align: left;">
                  <th style="padding: 12px; border: 1px solid #ddd;">Date</th>
                  <th style="padding: 12px; border: 1px solid #ddd;">Score</th>
                  <th style="padding: 12px; border: 1px solid #ddd;">Notes</th>
                </tr>
              </thead>
              <tbody>
                ${exportInfo.data?.history?.map(item => `
                  <tr>
                    <td style="padding: 12px; border: 1px solid #ddd;">${new Date(item.date).toLocaleDateString()}</td>
                    <td style="padding: 12px; border: 1px solid #ddd;">${item.score}/10</td>
                    <td style="padding: 12px; border: 1px solid #ddd; color: #666;">Recorded via MindCare Agent</td>
                  </tr>
                `).join('') || '<tr><td colspan="3" style="text-align:center; padding:20px;">No records found</td></tr>'}
              </tbody>
            </table>
            <div style="margin-top: 40px; font-size: 12px; color: #999; text-align: center;">
                <p>© 2026 MindCare AI System - Generated by ${user?.name}</p>
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri);
    } catch (error) {
      Alert.alert("Export Failed", "Could not generate report.");
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

  const MenuOption = ({ icon: Icon, title, color = "#1F2937", showArrow = true, onPress, children }) => (
    <TouchableOpacity style={styles.menuOption} onPress={onPress}>
      <View style={styles.menuLeft}>
        <View style={styles.menuIconBg}><Icon size={20} color={color} /></View>
        <Text style={[styles.menuTitle, { color: color }]}>{title}</Text>
      </View>
      {showArrow ? <ChevronRight size={20} color="#CBD5E1" /> : children}
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7D9CFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerText}>Profile</Text>
          <TouchableOpacity style={styles.settingsBtn}>
            <Settings size={22} color="#64748B" />
          </TouchableOpacity>
        </View>

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
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumText}>Verified Account</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatBox value={user?.stats.days} label="Days Active" />
          <StatBox value={user?.stats.entries} label="Entries" />
          <StatBox value={user?.stats.stress} label="Avg Stress" />
        </View>

        <Text style={styles.sectionTitle}>ACCOUNT MANAGEMENT</Text>
        <View style={styles.sectionCard}>
          <MenuOption icon={User} title="Edit Profile" onPress={() => setEditModalVisible(true)} />
          <MenuOption icon={Bell} title="Notifications" showArrow={false}>
            <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} />
          </MenuOption>
        </View>

        <Text style={styles.sectionTitle}>REPORTS & EXIT</Text>
        <View style={styles.sectionCard}>
          <MenuOption icon={FileText} title="Export Health Summary" onPress={handleExportData} />
          <MenuOption icon={LogOut} title="Logout" color="#EF4444" onPress={handleLogout} />
        </View>
      </ScrollView>

      {/* --- EDIT NAME MODAL --- */}
      <Modal visible={isEditModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Name</Text>
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
                <Text style={styles.updateBtnText}>Update</Text>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25, alignItems: 'center' },
  headerText: { fontSize: 28, fontWeight: 'bold', color: '#1E293B' },
  settingsBtn: { padding: 8, backgroundColor: '#FFF', borderRadius: 12 },
  profileCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 28, flexDirection: 'row', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 },
  avatarContainer: { position: 'relative', marginRight: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#7D9CFF', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%', borderRadius: 40 },
  avatarText: { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  cameraIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#1E293B', padding: 8, borderRadius: 15 },
  userInfo: { flex: 1 },
  userName: { fontSize: 20, fontWeight: 'bold', color: '#1E293B' },
  userEmail: { color: '#64748B', fontSize: 14 },
  premiumBadge: { backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginTop: 5, alignSelf: 'flex-start' },
  premiumText: { color: '#22C55E', fontSize: 11, fontWeight: '600' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 25 },
  statBox: { backgroundColor: '#FFF', padding: 18, borderRadius: 24, width: '31%', alignItems: 'center', elevation: 1 },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#1E293B' },
  statLabel: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#94A3B8', marginBottom: 12, marginLeft: 5, letterSpacing: 1 },
  sectionCard: { backgroundColor: '#FFF', borderRadius: 24, paddingHorizontal: 15, marginBottom: 25, elevation: 1 },
  menuOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18 },
  menuLeft: { flexDirection: 'row', alignItems: 'center' },
  menuIconBg: { backgroundColor: '#F1F5F9', padding: 10, borderRadius: 14, marginRight: 15 },
  menuTitle: { fontSize: 16, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#FFF', padding: 25, borderRadius: 24, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1E293B', marginBottom: 15 },
  input: { borderBottomWidth: 2, borderBottomColor: '#7D9CFF', marginBottom: 25, padding: 10, fontSize: 16, color: '#1E293B' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  cancelBtn: { marginRight: 25 },
  cancelBtnText: { color: '#64748B', fontWeight: '600', fontSize: 15 },
  updateBtn: { backgroundColor: '#7D9CFF', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 14 },
  updateBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 }
});