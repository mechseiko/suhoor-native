import React, { useEffect, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { View, Platform, StyleSheet } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import AuthStack from './AuthStack'
import TabNavigator from './TabNavigator'
import { AppTour } from '../components/AppTour'
import LogoLoader from '../components/LogoLoader'

export const RootNavigator = () => {
  const { currentUser, loading } = useAuth()
  const { colors } = useTheme()
  const [onboardingComplete, setOnboardingComplete] = useState(null)
  const tabBarRef = useRef(null)

  useEffect(() => {
    AsyncStorage.getItem('suhoor-onboarding-complete').then(value => {
      setOnboardingComplete(value === 'true')
    })
  }, [])

  if (loading || onboardingComplete === null) {
    return <LogoLoader />
  }

  const navContainerStyle = Platform.OS === 'web' ? {
    flex: 1,
    height: '100vh',
    width: '100vw',
  } : {}

  return (
    <NavigationContainer style={navContainerStyle}>
      <View style={styles.container}>
        {currentUser?.emailVerified ? (
          <AppTour tabBarRef={tabBarRef}>
            <TabNavigator tabBarRef={tabBarRef} />
          </AppTour>
        ) : (
          <AuthStack
            showOnboarding={!onboardingComplete}
            onCompleteOnboarding={async () => {
              await AsyncStorage.setItem('suhoor-onboarding-complete', 'true')
              setOnboardingComplete(true)
            }}
          />
        )}
      </View>
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      height: '100vh',
      width: '100vw',
    }),
  },
})

export default RootNavigator
