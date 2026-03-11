import React from 'react';
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
import Meditation from '../screens/Meditation';
import WeeklyReportScreen from '../screens/WeeklyReportScreen';
import EditProfileScreen from '../screens/EditProfile'; // අලුතින් එක් කළා

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#4F75FF',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: { 
          height: 70, 
          paddingBottom: 10, 
          backgroundColor: '#FFFFFF', 
          position: 'absolute',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        },
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Home') return <Home color={color} size={size} />;
          if (route.name === 'Chat') return <MessageCircle color={color} size={size} />;
          if (route.name === 'Analytics') return <BarChart2 color={color} size={size} />;
          if (route.name === 'Relax') return <Wind color={color} size={size} />;
          if (route.name === 'Profile') return <User color={color} size={size} />;
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
      <Stack.Screen name="BreathingExercise" component={BreathingExercise} />
      <Stack.Screen name="FocusTimer" component={FocusTimer} />
      <Stack.Screen name="Journaling" component={Journaling} />
      <Stack.Screen name="Meditation" component={Meditation} />
      <Stack.Screen name="WeeklyReport" component={WeeklyReportScreen} /> 
      
      {/* Profile Management */}
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen} 
        options={{ headerShown: true, title: 'Edit Profile' }} 
      />
    </Stack.Navigator>
  );
}