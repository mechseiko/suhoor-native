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
import { db } from '../config/firebase'
import { COLLECTIONS } from '../config/firestoreSchema'
import { doc, getDoc } from 'firebase/firestore'

export const RootNavigator = () => {
  const { currentUser, loading, userProfile } = useAuth()
  const { colors } = useTheme()
  const [onboardingComplete, setOnboardingComplete] = useState(null)
  const [isVerified, setIsVerified] = useState(false)
  const [checkingVerification, setCheckingVerification] = useState(false)
  const tabBarRef = useRef(null)

  useEffect(() => {
    AsyncStorage.getItem('suhoor-onboarding-complete').then(value => {
      setOnboardingComplete(value === 'true')
    })
  }, [])

  useEffect(() => {
    const checkVerification = async () => {
      if (!currentUser) {
        setIsVerified(false)
        return
      }

      // Check both Firebase Auth and Firestore profile
      const isAuthVerified = currentUser.emailVerified
      const isProfileVerified = userProfile?.isVerified || false
      
      // If Firebase says not verified, double-check Firestore
      if (!isAuthVerified && !isProfileVerified && currentUser.uid) {
        setCheckingVerification(true)
        try {
          const profileDoc = await getDoc(doc(db, COLLECTIONS.profiles, currentUser.uid))
          const profileData = profileDoc.exists() ? profileDoc.data() : null
          setIsVerified(profileData?.isVerified || false)
        } catch (err) {
          console.error('Error checking verification:', err)
          setIsVerified(false)
        } finally {
          setCheckingVerification(false)
        }
      } else {
        setIsVerified(isAuthVerified || isProfileVerified)
      }
    }

    checkVerification()
  }, [currentUser, userProfile])

  if (loading || onboardingComplete === null || checkingVerification) {
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
        {currentUser && isVerified ? (
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
