import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Switch, 
  Alert, 
  ActivityIndicator,
  RefreshControl,
  Image 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import { 
  User, 
  Settings, 
  Bell, 
  ShieldCheck, 
  FileText, 
  Trash2, 
  Camera, 
  ChevronRight,
  LogOut
} from 'lucide-react-native';

// API Services
import { 
  getUserProfile, 
  logoutUser, 
  exportData, 
  deleteAccount,
  updateNotificationSettings 
} from '../api/authService';

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [profileImage, setProfileImage] = useState(null);

  // Sync data every time the screen comes into focus
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
      console.error("Failed to load image", e);
    }
  };

  const fetchUserData = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        const response = await getUserProfile(token);
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
            stress: userData.avg_stress || '0.0' 
          }
        });
        
        setNotificationsEnabled(userData.notifications_enabled);
      } else {
        navigation.replace('Login');
      }
    } catch (error) {
      console.error("Profile Fetch Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'MindCare needs permission to access your gallery to upload a photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], // මෙතන තමයි deprecated warning එක ආපු තැන නිවැරදි කළේ
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      const selectedUri = result.assets[0].uri;
      setProfileImage(selectedUri);
      await AsyncStorage.setItem('user_profile_image', selectedUri);
      Alert.alert("Success", "Profile picture updated!");
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserData();
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Logout", 
        onPress: async () => {
          try {
            await logoutUser();
            await AsyncStorage.removeItem('userToken');
            navigation.replace('Login');
          } catch (e) {
            await AsyncStorage.removeItem('userToken');
            navigation.replace('Login');
          }
        }, 
        style: 'destructive' 
      }
    ]);
  };

  // Helper Components
  const StatBox = ({ label, value }) => (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const MenuOption = ({ icon: Icon, title, color = "#1F2937", showArrow = true, onPress, children }) => (
    <TouchableOpacity style={styles.menuOption} onPress={onPress}>
      <View style={styles.menuLeft}>
        <View style={styles.menuIconBg}>
          <Icon size={20} color={color} />
        </View>
        <Text style={[styles.menuTitle, { color: color }]}>{title}</Text>
      </View>
      {showArrow ? <ChevronRight size={20} color="#CBD5E1" /> : children}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7D9CFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7D9CFF" />}
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
               <Text style={styles.premiumText}>Active User</Text>
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
          <MenuOption icon={User} title="Edit Profile" onPress={() => {}} />
          <MenuOption icon={Bell} title="Notifications" showArrow={false}>
            <Switch 
              value={notificationsEnabled} 
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: "#E2E8F0", true: "#7D9CFF" }}
              thumbColor={"#FFF"}
            />
          </MenuOption>
          <MenuOption icon={ShieldCheck} title="Privacy Settings" onPress={() => {}} />
        </View>

        <Text style={styles.sectionTitle}>DATA & SUPPORT</Text>
        <View style={styles.sectionCard}>
          <MenuOption icon={FileText} title="Export My Data" onPress={() => {}} />
          <MenuOption icon={LogOut} title="Logout" color="#64748B" onPress={handleLogout} />
        </View>

        <TouchableOpacity style={styles.deleteBtn} onPress={() => {}}>
           <Trash2 size={18} color="#EF4444" style={{marginRight: 8}} />
           <Text style={styles.deleteText}>Delete Account</Text>
        </TouchableOpacity>
        
        <Text style={styles.versionText}>MindCare v1.0.2</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  headerText: { fontSize: 28, fontWeight: 'bold', color: '#1E293B' },
  settingsBtn: { padding: 8, backgroundColor: '#FFF', borderRadius: 12, elevation: 1 },
  profileCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 28, flexDirection: 'row', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  avatarContainer: { position: 'relative', marginRight: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#7D9CFF', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  cameraIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#1E293B', padding: 8, borderRadius: 15, borderWidth: 3, borderColor: '#FFF' },
  userInfo: { flex: 1 },
  userName: { fontSize: 20, fontWeight: 'bold', color: '#1E293B' },
  userEmail: { fontSize: 14, color: '#64748B', marginVertical: 4 },
  premiumBadge: { backgroundColor: '#F0FDF4', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start', marginTop: 5 },
  premiumText: { color: '#22C55E', fontSize: 11, fontWeight: '700' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 25 },
  statBox: { backgroundColor: '#FFF', padding: 18, borderRadius: 24, width: '31%', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05 },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#1E293B' },
  statLabel: { fontSize: 11, color: '#94A3B8', marginTop: 4, textAlign: 'center' },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#94A3B8', marginBottom: 12, marginLeft: 10, letterSpacing: 1 },
  sectionCard: { backgroundColor: '#FFF', borderRadius: 24, paddingHorizontal: 15, marginBottom: 25, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05 },
  menuOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  menuLeft: { flexDirection: 'row', alignItems: 'center' },
  menuIconBg: { backgroundColor: '#F1F5F9', padding: 10, borderRadius: 14, marginRight: 15 },
  menuTitle: { fontSize: 16, fontWeight: '500' },
  deleteBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 15, marginTop: 10 },
  deleteText: { color: '#EF4444', fontWeight: 'bold', fontSize: 15 },
  versionText: { textAlign: 'center', color: '#CBD5E1', fontSize: 12, marginTop: 20 }
});