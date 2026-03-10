import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { getUserProfile } from '../api/authService'; // ඔයාගේ API service එක

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      // මෙතනදී backend එකෙන් දත්ත ලබා ගැනීම සිදු කරනවා
      // const response = await getUserProfile();
      // setUser(response.data);
      
      // දැනට dummy data පාවිච්චි කරමු
      setTimeout(() => {
        setUser({
          name: 'Sarah Chen',
          email: 'sarah.chen@university.edu',
          avatar: 'SC',
          stats: { days: '28', entries: '156', stress: '5.4' }
        });
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", onPress: () => console.log("User Logged Out"), style: 'destructive' }
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7D9CFF" />
      </View>
    );
  }

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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.headerText}>Profile</Text>
          <TouchableOpacity style={styles.settingsBtn}>
             <Settings size={22} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
               <Text style={styles.avatarText}>{user?.avatar}</Text>
            </View>
            <TouchableOpacity style={styles.cameraIcon}>
              <Camera size={14} color="#FFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <View style={styles.premiumBadge}>
               <Text style={styles.premiumText}>Premium Member</Text>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatBox value={user?.stats.days} label="Days Active" />
          <StatBox value={user?.stats.entries} label="Entries" />
          <StatBox value={user?.stats.stress} label="Avg Stress" />
        </View>

        {/* Account Section */}
        <Text style={styles.sectionTitle}>ACCOUNT MANAGEMENT</Text>
        <View style={styles.sectionCard}>
          <MenuOption 
            icon={User} 
            title="Edit Profile" 
            onPress={() => navigation.navigate('EditProfile')} 
          />
          <MenuOption icon={Bell} title="Notifications" showArrow={false}>
            <Switch 
              value={notificationsEnabled} 
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: "#E2E8F0", true: "#7D9CFF" }}
              thumbColor={"#FFF"}
            />
          </MenuOption>
          <MenuOption icon={ShieldCheck} title="Privacy Settings" />
        </View>

        {/* Support & Data Section */}
        <Text style={styles.sectionTitle}>DATA & SUPPORT</Text>
        <View style={styles.sectionCard}>
          <MenuOption icon={FileText} title="Export My Data" />
          <MenuOption icon={LogOut} title="Logout" color="#64748B" onPress={handleLogout} />
        </View>

        {/* Danger Zone */}
        <TouchableOpacity style={styles.deleteBtn}>
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
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#7D9CFF', justifyContent: 'center', alignItems: 'center' },
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