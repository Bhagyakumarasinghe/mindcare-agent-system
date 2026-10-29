import React, { useEffect } from 'react';
import { StatusBar, InteractionManager, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { requireOptionalNativeModule } from 'expo';
import AppNavigator from './src/navigation/AppNavigator';

// Suppress deprecated InteractionManager console noise and warnings
LogBox.ignoreLogs([
  'InteractionManager.runAfterInteractions',
  'InteractionManager.runAfterInteractions is deprecated',
  'Animated: `useNativeDriver`'
]);

// Resilient, zero-warning replacement for InteractionManager using requestIdleCallback / setTimeout
if (typeof InteractionManager !== 'undefined') {
  InteractionManager.runAfterInteractions = (task) => {
    let cancelFn = () => {};
    const promise = new Promise((resolve) => {
      const schedule = typeof requestIdleCallback !== 'undefined'
        ? requestIdleCallback
        : (callback) => setTimeout(callback, 0);

      const cancel = typeof cancelIdleCallback !== 'undefined'
        ? cancelIdleCallback
        : clearTimeout;

      const handle = schedule(() => {
        try {
          if (typeof task === 'function') {
            resolve(task());
          } else {
            resolve();
          }
        } catch (e) {
          resolve();
        }
      });

      cancelFn = () => cancel(handle);
    });

    return {
      then: (onFulfilled, onRejected) => promise.then(onFulfilled, onRejected),
      done: (...args) => {
        if (typeof promise.done === 'function') promise.done(...args);
      },
      cancel: cancelFn
    };
  };
}

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