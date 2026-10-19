import React, { useEffect, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { View, Platform, StyleSheet } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import AuthStack from './AuthStack'
import TabNavigator from './TabNavigator'
import AppTour from '../components/AppTour'
import LogoLoader from '../components/LogoLoader'
import NewUserSplash from '../components/NewUserSplash'
import { db } from '../config/firebase'
import { COLLECTIONS } from '../config/firestoreSchema'
import { doc, getDoc } from 'firebase/firestore'
import { navigationRef } from '../services/NavigationService'
import { useLanguage } from '../context/LanguageContext'


// Remembers that verification was confirmed at least once, so an offline
// launch of an already-verified user gets straight into the app instead of
// being gated behind a Firestore check that cannot be answered without
// network (previously a failed check was treated as "not verified").
const VERIFIED_STORAGE_KEY = 'suhoor-was-verified'

const persistVerified = (uid) => {
  AsyncStorage.setItem(`${VERIFIED_STORAGE_KEY}_${uid}`, 'true').catch(() => {})
}

export const RootNavigator = () => {
  const { t } = useLanguage()
  const { currentUser, loading, userProfile } = useAuth()
  const { colors } = useTheme()
  const [onboardingComplete, setOnboardingComplete] = useState(null)
  const [isVerified, setIsVerified] = useState(false)
  const [checkingVerification, setCheckingVerification] = useState(false)
  const [loadTimedOut, setLoadTimedOut] = useState(false)
  const [showNewUserSplash, setShowNewUserSplash] = useState(null) // null = not yet determined
  const tabBarRef = useRef(null)

  useEffect(() => {
    let active = true
    AsyncStorage.getItem('suhoor-onboarding-complete')
      .then(value => {
        const completed = value === 'true'
        if (active) {
          setOnboardingComplete(completed)
          // Show the brand-new-user splash only when:
          //  1. Onboarding was never completed (fresh install)
          //  2. There is no currently signed-in user
          setShowNewUserSplash(!completed && !currentUser ? true : false)
        }
      })
      .catch(() => {
        if (active) {
          setOnboardingComplete(false)
          setShowNewUserSplash(!currentUser ? true : false)
        }
      })

    const timer = setTimeout(() => {
      if (active) {
        setOnboardingComplete(prev => (prev === null ? false : prev))
        setShowNewUserSplash(prev => (prev === null ? false : prev))
        setLoadTimedOut(true)
      }
    }, 4000)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    const checkVerification = async () => {
      if (!currentUser) {
        if (isMounted) {
          setIsVerified(false)
          setCheckingVerification(false)
        }
        return
      }

      // Check both Firebase Auth and Firestore profile
      const isAuthVerified = currentUser.emailVerified
      const isProfileVerified = userProfile?.isVerified || false

      if (isAuthVerified || isProfileVerified) {
        persistVerified(currentUser.uid)
        if (isMounted) {
          setIsVerified(true)
          setCheckingVerification(false)
        }
        return
      }

      // Neither source says verified. Honor the verification confirmed in a
      // previous session before hitting Firestore: getDoc cannot be answered
      // offline, and treating that failure as "not verified" locked verified
      // users out of the app whenever they opened it with no network.
      setCheckingVerification(true)
      try {
        const wasVerified =
          (await AsyncStorage.getItem(
            `${VERIFIED_STORAGE_KEY}_${currentUser.uid}`
          ).catch(() => null)) === 'true'
        if (wasVerified) {
          if (isMounted) {
            setIsVerified(true)
            setCheckingVerification(false)
          }
          return
        }

        const docPromise = getDoc(doc(db, COLLECTIONS.profiles, currentUser.uid))
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 3000)
        )
        const profileDoc = await Promise.race([docPromise, timeoutPromise]).catch(() => null)
        const profileData = profileDoc?.exists?.() ? profileDoc.data() : null

        if (profileData?.isVerified) {
          persistVerified(currentUser.uid)
        }
        if (isMounted) {
          setIsVerified(profileData?.isVerified || false)
        }
      } catch (err) {
        console.error('Error checking verification:', err)
        if (isMounted) setIsVerified(false)
      } finally {
        if (isMounted) {
          setCheckingVerification(false)
        }
      }
    }

    checkVerification()
    return () => {
      isMounted = false
    }
  }, [currentUser, userProfile])

  // Brand-new user: show the splash once, then dismiss into onboarding.
  // Only render when explicitly true — never during the null (undetermined) phase
  // to avoid a race condition where returning users briefly see the splash.
  if (showNewUserSplash === true) {
    return <NewUserSplash onFinish={() => setShowNewUserSplash(false)} />
  }

  // Still determining splash state — hold on LogoLoader
  if (showNewUserSplash === null) {
    return <LogoLoader />
  }

  if (!loadTimedOut && (loading || onboardingComplete === null || checkingVerification)) {
    return <LogoLoader />
  }

  const navContainerStyle = Platform.OS === 'web' ? {
    flex: 1,
    height: '100vh',
    width: '100vw',
  } : {}

  return (
    <NavigationContainer ref={navigationRef} style={navContainerStyle}>
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
