import React, { useEffect, useRef } from 'react'
import { View, Text, Image, StyleSheet, Dimensions, Animated, Easing, Platform } from 'react-native'

const { width } = Dimensions.get('window')
const isNative = Platform.OS !== 'web'

/**
 * NewUserSplash
 * Smooth cascade effect: Logo slides from left, Text slides from right.
 */
const NewUserSplash = ({ onFinish, duration = 2400 }) => {
  // Animation values
  const logoOpacity = useRef(new Animated.Value(0)).current
  const logoTranslateX = useRef(new Animated.Value(-30)).current // Starts 30px to the left
  
  const textOpacity = useRef(new Animated.Value(0)).current
  const textTranslateX = useRef(new Animated.Value(30)).current // Starts 30px to the right
  
  const screenOpacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    // 1. Logo slides in from left
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: isNative,
      }),
      Animated.timing(logoTranslateX, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.back(1.2)), // Gentle wave-like settle
        useNativeDriver: isNative,
      }),
    ]).start()

    // 2. Text slides in from right (staggered by 150ms)
    const textTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: isNative,
        }),
        Animated.timing(textTranslateX, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.back(1.1)),
          useNativeDriver: isNative,
        }),
      ]).start()
    }, 150)

    // 3. Fade out the whole screen
    const fadeOutTimer = setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 450,
        easing: Easing.inOut(Easing.ease), // Smoother fade out
        useNativeDriver: isNative,
      }).start(({ finished }) => {
        if (finished && onFinish) {
          onFinish()
        }
      })
    }, Math.max(0, duration - 450))

    return () => {
      clearTimeout(textTimer)
      clearTimeout(fadeOutTimer)
    }
  }, [duration, onFinish, logoOpacity, logoTranslateX, textOpacity, textTranslateX, screenOpacity])

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      
      {/* Logo Wrapper - Slides from Left */}
      <Animated.View
        style={[
          styles.logoWrap,
          {
            opacity: logoOpacity,
            transform: [{ translateX: logoTranslateX }],
          },
        ]}
      >
        <Image
          source={require('../assets/icon-nobg.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Text Wrapper - Slides from Right */}
      <Animated.View
        style={[
          styles.bottomBrandWrap,
          {
            opacity: textOpacity,
            transform: [{ translateX: textTranslateX }],
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
    // No extra styles needed, the animation handles the position
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