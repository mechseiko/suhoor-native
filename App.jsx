import React, { useEffect } from 'react'
import { Platform, StatusBar, View, StyleSheet } from 'react-native'
import { useFonts } from 'expo-font'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { ThemeProvider } from './context/ThemeContext'
import { LanguageProvider } from './context/LanguageContext'
import { AlarmProvider } from './context/AlarmContext'
import AlarmOverlay from './components/AlarmOverlay'
import RootNavigator from './navigation/RootNavigator'
import { fontAssets } from './theme/fonts'
import { Svg, G, Path } from 'react-native-svg'
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated'
import { configureNotifications } from './services/notifications'
import FastingNotificationsManager from './components/FastingNotificationsManager'

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

const LogoLoader = () => (
  <View style={{ flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
    <Animated.View 
      entering={FadeIn.duration(800)}
      style={{ alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View 
        entering={FadeIn.duration(1200).delay(200)}
        style={{ transform: [{ scale: 0.8 }] }}
      >
        <Svg width={120} height={120} viewBox="0 0 359 356">
          <G transform="translate(0, 356) scale(0.1, -0.1)" fill="#f9a826">
            <Path d="M1828 3465 c-1 -2 -55 -5 -118 -6 -726 -17 -1397 -567 -1573 -1289-80 -332 -69 -635 38 -955 162 -488 555 -895 1030 -1068 236 -86 324 -101 600-101 211 1 240 3 350 27 461 100 833 359 1092 760 202 312 298 689 264 1040-25 264 -71 428 -189 667 -64 131 -213 335 -307 421 -16 15 -55 51 -85 79 -76-71 -272 201 -387 256 -190 91 -406 149 -598 160 -49 3 -95 7 -102 9 -6 2 -13-2 -15 0z"/>
          </G>
        </Svg>
      </Animated.View>
    </Animated.View>
  </View>
);

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
        <SocketProvider>
          <ThemeProvider>
            <LanguageProvider>
              <AlarmProvider>
                <View style={{ flex: 1, backgroundColor: '#FFFFFF', height: '100vh', width: '100vw' }}>
                  <RootNavigator />
                  <AlarmOverlay />
                  <FastingNotificationsManager />
                  <StatusBar barStyle="default" />
                </View>
              </AlarmProvider>
            </LanguageProvider>
          </ThemeProvider>
        </SocketProvider>
      </AuthProvider>
    )
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SocketProvider>
          <ThemeProvider>
            <LanguageProvider>
              <AlarmProvider>
                <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
                  <RootNavigator />
                  <AlarmOverlay />
                  <FastingNotificationsManager />
                  <StatusBar barStyle="default" />
                </View>
              </AlarmProvider>
            </LanguageProvider>
          </ThemeProvider>
        </SocketProvider>
      </AuthProvider>
    </SafeAreaProvider>
  )
}
