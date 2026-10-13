import React, { useEffect, useRef } from 'react'
import { View, Text, Image, StyleSheet, Dimensions, Animated, Easing, Platform } from 'react-native'

const { width } = Dimensions.get('window')
const isNative = Platform.OS !== 'web'

/**
 * NewUserSplash
 * Shown once when a brand-new user opens the app for the very first time
 * (before they've gone through onboarding). Pure brand moment — white
 * background, logo fades in, then the whole screen fades out.
 *
 * Props:
 *   onFinish  — callback fired when the animation is complete
 *   duration  — total display duration in ms (default 2200)
 */
const NewUserSplash = ({ onFinish, duration = 2200 }) => {
  // Start with logo partially visible on frame 1 to eliminate any white lag
  const logoOpacity = useRef(new Animated.Value(0.2)).current
  const logoScale = useRef(new Animated.Value(0.88)).current
  const screenOpacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    // 1. Logo rapidly smooths to 100% opacity and scales in
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: isNative,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.back(1.1)),
        useNativeDriver: isNative,
      }),
    ]).start()

    // 2. After hold, entire screen fades out
    const timer = setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 400,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: isNative,
      }).start(({ finished }) => {
        if (finished && onFinish) {
          onFinish()
        }
      })
    }, Math.max(0, duration - 400))

    return () => clearTimeout(timer)
  }, [duration, onFinish, logoOpacity, logoScale, screenOpacity])

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      <Animated.View
        style={[
          styles.logoWrap,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <Image
          source={require('../assets/icon-nobg.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.bottomBrandWrap,
          {
            opacity: logoOpacity,
          },
        ]}
      >
        <Text style={styles.brandTitle}>Suhoor</Text>
        <Text style={styles.brandSubtitle}>Wake up for suhoor in groups</Text>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: width * 0.38,
    height: width * 0.38,
  },
  bottomBrandWrap: {
    position: 'absolute',
    bottom: 52,
    left: 20,
    right: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: 'Quicksand-SemiBold',
    letterSpacing: 2,
    color: '#150c33',
    textTransform: 'uppercase',
  },
  brandSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Quicksand-SemiBold',
    color: '#6B7280',
    marginTop: 4,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
})

export default NewUserSplash
