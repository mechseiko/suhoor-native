import React, { useState, useEffect, useRef } from 'react'
import { View, Text, ActivityIndicator, Image, Animated, Platform } from 'react-native'

const isNative = Platform.OS !== 'web'

export const LogoLoader = () => {
  const [messageIndex, setMessageIndex] = useState(0)
  const outerOpacity = useRef(new Animated.Value(0)).current
  const innerOpacity = useRef(new Animated.Value(0)).current

  const loadingMessages = [
    'Checking your alarms...',
    'Pulling your fasting times...',
    'Bundling your experience...',
    'Loading your groups...',
    'Preparing your data...',
    'Getting your crossed milestones...',
  ]

  useEffect(() => {
    // Fade outer in over 800ms
    Animated.timing(outerOpacity, {
      toValue: 1,
      duration: 800,
      useNativeDriver: isNative,
    }).start()

    // Fade inner in over 1200ms with 200ms delay
    Animated.timing(innerOpacity, {
      toValue: 1,
      duration: 1200,
      delay: 200,
      useNativeDriver: isNative,
    }).start()

    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % loadingMessages.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ alignItems: 'center', justifyContent: 'center', opacity: outerOpacity }}>
        <Image
          source={require('../assets/icon-nobg.png')}
          style={{ width: 100, height: 100, marginBottom: 24 }}
          resizeMode="contain"
        />
        <Animated.View style={{ alignItems: 'center', justifyContent: 'center', opacity: innerOpacity }}>
          <ActivityIndicator size="large" color="#6366F1" style={{ marginBottom: 20 }} />
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: '#374151',
              fontFamily: 'Quicksand-Regular',
              textAlign: 'center',
            }}
          >
            {loadingMessages[messageIndex]}
          </Text>
        </Animated.View>
      </Animated.View>
    </View>
  )
}

export default LogoLoader
