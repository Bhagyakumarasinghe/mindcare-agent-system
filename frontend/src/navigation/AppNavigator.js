import React from 'react';
import { View, Platform } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, MessageCircle, BarChart2, Wind, User } from 'lucide-react-native';

// Screens imports
import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import OTPScreen from '../screens/OTPScreen';
import HomeScreen from '../screens/HomeScreen';
import ChatScreen from '../screens/ChatScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import RelaxScreen from '../screens/RelaxScreen';
import MoodTrackingScreen from '../screens/MoodTrackingScreen';
import AssessmentScreen from '../screens/AssessmentScreen';

// Sub-Screens imports
import BreathingExercise from '../screens/BreathingExercise';
import FocusTimer from '../screens/FocusTimer';
import Journaling from '../screens/Journaling';
import JournalScreen from '../screens/JournalScreen';
import Meditation from '../screens/Meditation';
import MeditationScreen from '../screens/MeditationScreen';
import WeeklyReportScreen from '../screens/WeeklyReportScreen';
import EditProfileScreen from '../screens/EditProfile';
import AplusTrackScreen from '../screens/AplusTrackScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: '#0D9488',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          position: 'absolute',
          bottom: 16,
          left: 16,
          right: 16,
          height: 68,
          borderRadius: 28,
          backgroundColor: 'rgba(255, 255, 255, 0.94)',
          borderWidth: 1.5,
          borderColor: '#FFFFFF',
          paddingBottom: Platform.OS === 'ios' ? 12 : 8,
          paddingTop: 8,
          elevation: 10,
          shadowColor: '#64748B',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.2,
        },
        tabBarIcon: ({ color, focused, size }) => {
          let IconComponent;
          if (route.name === 'Home') IconComponent = Home;
          else if (route.name === 'Chat') IconComponent = MessageCircle;
          else if (route.name === 'Analytics') IconComponent = BarChart2;
          else if (route.name === 'Relax') IconComponent = Wind;
          else if (route.name === 'Profile') IconComponent = User;

          return (
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: focused ? '#CCFBF1' : 'transparent',
                borderRadius: 14,
                paddingHorizontal: 12,
                paddingVertical: 3,
              }}
            >
              <IconComponent color={color} size={20} strokeWidth={focused ? 2.5 : 2} />
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} />
      <Tab.Screen name="Relax" component={RelaxScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator 
      initialRouteName="Splash" 
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="OTP" component={OTPScreen} />
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="MoodTracking" component={MoodTrackingScreen} />
      <Stack.Screen name="Assessment" component={AssessmentScreen} /> 
      
      {/* Sub-Screens */}
      <Stack.Screen name="Breathing" component={BreathingExercise} />
      <Stack.Screen name="BreathingExercise" component={BreathingExercise} />
      <Stack.Screen name="BreathingScreen" component={BreathingExercise} />
      <Stack.Screen name="FocusTimer" component={FocusTimer} />
      <Stack.Screen name="FocusTimerScreen" component={FocusTimer} />
      <Stack.Screen name="Journaling" component={JournalScreen} />
      <Stack.Screen name="JournalScreen" component={JournalScreen} />
      <Stack.Screen name="ReflectiveJournalScreen" component={JournalScreen} />
      <Stack.Screen name="Meditation" component={MeditationScreen} />
      <Stack.Screen name="MeditationScreen" component={MeditationScreen} />
      <Stack.Screen name="GuidedMeditationScreen" component={MeditationScreen} />
      <Stack.Screen name="WeeklyReport" component={WeeklyReportScreen} /> 
      <Stack.Screen name="AplusTrack" component={AplusTrackScreen} /> 
      <Stack.Screen name="AplusTrackScreen" component={AplusTrackScreen} /> 
      <Stack.Screen name="SupportSanctuary" component={ChatScreen} /> 
      <Stack.Screen name="SupportSanctuaryScreen" component={ChatScreen} /> 
      
      {/* Profile Management */}
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen} 
        options={{ headerShown: true, title: 'Edit Profile' }} 
      />
    </Stack.Navigator>
  );
}