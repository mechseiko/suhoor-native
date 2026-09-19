import React, { useState, useEffect } from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

export const LogoLoader = () => {
  const [messageIndex, setMessageIndex] = useState(0)
  const loadingMessages = [
    'Loading...',
    'Fetching your fasting times',
    'Fetching your data',
    'Bundling your experience...',
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % loadingMessages.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [loadingMessages.length])

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
