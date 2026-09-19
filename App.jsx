import React, { useEffect, useState } from 'react'
import { Platform, StatusBar, View, StyleSheet, Text, ActivityIndicator, LogBox } from 'react-native'
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

// Suppress known third-party web deprecation warnings (react-native-web & @react-navigation)
LogBox.ignoreLogs([
  'props.pointerEvents is deprecated',
  '"shadow*" style props are deprecated',
])

if (typeof console !== 'undefined') {
  const isIgnoredWarning = (msg) => {
    if (typeof msg !== 'string') return false
    return (
      msg.includes('props.pointerEvents is deprecated') ||
      msg.includes('"shadow*" style props are deprecated') ||
      (msg.includes('pointerEvents') && msg.includes('deprecated')) ||
      (msg.includes('shadow*') && msg.includes('boxShadow'))
    )
  }

  const origWarn = console.warn
  console.warn = (...args) => {
    if (isIgnoredWarning(args[0])) return
    origWarn(...args)
  }

  const origError = console.error
  console.error = (...args) => {
    if (isIgnoredWarning(args[0])) return
    origError(...args)
  }
}

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

import LogoLoader from './components/LogoLoader'

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
