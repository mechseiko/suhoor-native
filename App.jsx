import React, { useEffect, useState } from 'react'
import { Platform, StatusBar, View, StyleSheet, Text, ActivityIndicator } from 'react-native'
import { useFonts } from 'expo-font'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { ThemeProvider } from './context/ThemeContext'
import { LanguageProvider } from './context/LanguageContext'
import { AlarmProvider } from './context/AlarmContext'
import { NetworkProvider } from './context/NetworkContext'
import AlarmOverlay from './components/AlarmOverlay'
import RootNavigator from './navigation/RootNavigator'
import { fontAssets } from './theme/fonts'
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated'
import { configureNotifications } from './services/notifications'
import FastingNotificationsManager from './components/FastingNotificationsManager'
import NetworkStatusNotification from './components/NetworkStatusNotification'

// Polyfill for random values (needed for Firebase/Socket.IO in React Native)
import 'react-native-get-random-values'

// Seeds Quicksand as the default family on the base Text/TextInput, for the
// screens that still import them straight from react-native.
import './theme/globalTextFont'

// Starts i18next before the first render, so the tree never paints untranslated
// keys. Language detection itself is async (AsyncStorage), which LanguageProvider
// waits on via `isLoadingLocale`.
import './i18n'

// Import global CSS for NativeWind
import './global.css'

// Configure dark mode for Expo Web
if (StyleSheet.setFlag) {
  StyleSheet.setFlag('darkMode', 'class')
}

// Web-specific viewport meta tag
if (Platform.OS === 'web') {
  const meta = document.createElement('meta')
  meta.name = 'viewport'
  meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'
  document.head.appendChild(meta)
}

const LogoLoader = () => {
  const [messageIndex, setMessageIndex] = useState(0)
  const loadingMessages = [
    'Loading...',
    'Fetching your fasting times',
    'Fetching your data',
    'Bundling your experience...'
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View 
        entering={FadeIn.duration(800)}
        style={{ alignItems: 'center', justifyContent: 'center' }}
      >
        <Animated.View 
          entering={FadeIn.duration(1200).delay(200)}
          style={{ alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator size="large" color="#6366F1" style={{ marginBottom: 20 }} />
          <Text style={{ 
            fontSize: 16, 
            fontWeight: '600', 
            color: '#374151',
            fontFamily: 'Quicksand-Regular',
            textAlign: 'center'
          }}>
            {loadingMessages[messageIndex]}
          </Text>
        </Animated.View>
      </Animated.View>
    </View>
  )
}

export default function App() {
  // Registers the eight Quicksand / Space Grotesk faces with the native font
  // manager. Until this resolves every `fontFamily` in the theme names a family
  // Android has never heard of, so hold the first paint rather than flashing the
  // whole app in the system face and reflowing.
  const [fontsLoaded, fontError] = useFonts(fontAssets)

  // Configure push notifications on app start
  useEffect(() => {
    configureNotifications()
  }, [])

  if (!fontsLoaded && !fontError) {
    return <LogoLoader />
  }

  if (fontError && __DEV__) {
    console.warn('[fonts] Failed to load the brand faces:', fontError)
  }

  // On web, skip SafeAreaProvider to avoid layout issues
  if (Platform.OS === 'web') {
    return (
      <AuthProvider>
        <NetworkProvider>
          <SocketProvider>
            <ThemeProvider>
              <LanguageProvider>
                <AlarmProvider>
                  <View style={{ flex: 1, backgroundColor: '#FFFFFF', height: '100vh', width: '100vw' }}>
                    <RootNavigator />
                    <AlarmOverlay />
                    <FastingNotificationsManager />
                    <NetworkStatusNotification />
                    <StatusBar barStyle="default" />
                  </View>
                </AlarmProvider>
              </LanguageProvider>
            </ThemeProvider>
          </SocketProvider>
        </NetworkProvider>
      </AuthProvider>
    )
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NetworkProvider>
          <SocketProvider>
            <ThemeProvider>
              <LanguageProvider>
                <AlarmProvider>
                  <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
                    <RootNavigator />
                    <AlarmOverlay />
                    <FastingNotificationsManager />
                    <NetworkStatusNotification />
                    <StatusBar barStyle="default" />
                  </View>
                </AlarmProvider>
              </LanguageProvider>
            </ThemeProvider>
          </SocketProvider>
        </NetworkProvider>
      </AuthProvider>
    </SafeAreaProvider>
  )
}
