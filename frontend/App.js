import React, { useEffect } from 'react';
import { StatusBar, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { requireOptionalNativeModule } from 'expo';
import AppNavigator from './src/navigation/AppNavigator';

// Suppress console noise and warnings
LogBox.ignoreLogs([
  'InteractionManager.runAfterInteractions',
  'InteractionManager.runAfterInteractions is deprecated',
  'Animated: `useNativeDriver`'
]);

export default function App() {
  useEffect(() => {
    // Hide Expo Go floating dev menu / tools button overlay if available
    try {
      const DevMenuPreferences = requireOptionalNativeModule('DevMenuPreferences');
      DevMenuPreferences?.setPreferencesAsync?.({ showFloatingActionButton: false });
    } catch {
      // Ignore in non-dev or web environments
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}