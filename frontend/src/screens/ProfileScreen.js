import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUserProfile } from '../api/authService';

export default function ProfileScreen() {
  const [user, setUser] = useState({ name: 'Loading...', email: '' });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Screen එක load වෙද්දී backend එකෙන් දත්ත ලබා ගැනීම
  useEffect(() => {
    // සටහන: මෙහිදී ඔයාගේ login එකේදී ලැබුණු Token එක පාවිච්චි කළ යුතුයි.
    // දැනට උදාහරණයක් ලෙස දත්ත පෙන්වමු.
  }, []);

  const StatBox = ({ label, value }) => (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const MenuOption = ({ icon, title, showArrow = true, children }) => (
    <TouchableOpacity style={styles.menuOption}>
      <View style={styles.menuLeft}>
        <View style={styles.menuIconBg}><Text>{icon}</Text></View>
        <Text style={styles.menuTitle}>{title}</Text>
      </View>
      {showArrow ? <Text style={styles.arrow}>〉</Text> : children}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Profile</Text>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}><Text style={styles.avatarText}>SC</Text></View>
            <TouchableOpacity style={styles.cameraIcon}><Text style={{fontSize: 10}}>📷</Text></TouchableOpacity>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>Sarah Chen</Text>
            <Text style={styles.userEmail}>sarah.chen@university.edu</Text>
            <View style={styles.premiumBadge}><Text style={styles.premiumText}>Premium Member</Text></View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatBox value="28" label="Days Active" />
          <StatBox value="156" label="Entries" />
          <StatBox value="5.4" label="Avg Stress" />
        </View>

        {/* Menu Sections */}
        <Text style={styles.sectionTitle}>ACCOUNT</Text>
        <View style={styles.sectionCard}>
          <MenuOption icon="👤" title="Edit Profile" />
          <MenuOption icon="🔔" title="Notifications" showArrow={false}>
            <Switch 
              value={notificationsEnabled} 
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: "#E2E8F0", true: "#6BCB77" }}
            />
          </MenuOption>
        </View>

        <Text style={styles.sectionTitle}>PRIVACY & SECURITY</Text>
        <View style={styles.sectionCard}>
          <MenuOption icon="🔒" title="Privacy Settings" />
        </View>

        <Text style={styles.sectionTitle}>DATA</Text>
        <View style={styles.sectionCard}>
          <MenuOption icon="📊" title="Export My Data" />
          <TouchableOpacity style={styles.deleteBtn}>
             <Text style={styles.deleteText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20 },
  header: { fontSize: 24, fontWeight: 'bold', color: '#1F2937', marginBottom: 25 },
  
  profileCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 24, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  avatarContainer: { position: 'relative', marginRight: 15 },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#818CF8', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  cameraIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#FFF', padding: 6, borderRadius: 12, elevation: 3 },
  
  userInfo: { flex: 1 },
  userName: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  userEmail: { fontSize: 14, color: '#6B7280', marginVertical: 4 },
  premiumBadge: { backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  premiumText: { color: '#22C55E', fontSize: 11, fontWeight: '600' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 25 },
  statBox: { backgroundColor: '#FFF', padding: 15, borderRadius: 20, width: '31%', alignItems: 'center', elevation: 2 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
  statLabel: { fontSize: 11, color: '#6B7280', marginTop: 4 },

  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#94A3B8', marginBottom: 10, marginLeft: 5 },
  sectionCard: { backgroundColor: '#FFF', borderRadius: 20, paddingHorizontal: 15, marginBottom: 20, elevation: 2 },
  menuOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  menuLeft: { flexDirection: 'row', alignItems: 'center' },
  menuIconBg: { backgroundColor: '#F1F5F9', padding: 8, borderRadius: 10, marginRight: 12 },
  menuTitle: { fontSize: 15, color: '#1F2937' },
  arrow: { color: '#CBD5E1', fontSize: 18 },

  deleteBtn: { paddingVertical: 15, alignItems: 'center' },
  deleteText: { color: '#EF4444', fontWeight: 'bold' }
});