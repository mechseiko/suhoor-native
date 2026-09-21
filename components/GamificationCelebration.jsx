import React, { useEffect, useMemo, useRef } from 'react'
import { Animated, Dimensions, StyleSheet, View } from 'react-native'
import Toast from './Toast'

const COLORS = ['#F59E0B', '#10B981', '#6366F1', '#EC4899', '#14B8A6']
const PARTICLE_COUNT = 18

export default function GamificationCelebration({ celebration, onDismiss }) {
  const particles = useMemo(
    () => Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      rotate: new Animated.Value(0),
      left: (Dimensions.get('window').width / PARTICLE_COUNT) * index,
      color: COLORS[index % COLORS.length],
    })),
    [celebration]
  )
  const dismissTimer = useRef(null)

  useEffect(() => {
    if (!celebration) return undefined

    const animations = particles.map((particle, index) => Animated.parallel([
      Animated.timing(particle.y, {
        toValue: Dimensions.get('window').height * 0.62 + (index % 4) * 35,
        duration: 1700 + (index % 5) * 100,
        useNativeDriver: true,
      }),
      Animated.timing(particle.x, {
        toValue: (index % 2 ? 1 : -1) * (25 + (index % 6) * 12),
        duration: 1700,
        useNativeDriver: true,
      }),
      Animated.timing(particle.rotate, {
        toValue: 2 + (index % 3),
        duration: 1700,
        useNativeDriver: true,
      }),
    ]))

    particles.forEach(particle => {
      particle.y.setValue(-30)
      particle.x.setValue(0)
      particle.rotate.setValue(0)
    })
    Animated.stagger(35, animations).start()
    dismissTimer.current = setTimeout(onDismiss, 3200)

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
    }
  }, [celebration, onDismiss, particles])

  if (!celebration) return null

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((particle, index) => (
        <Animated.View
          key={index}
          style={[
            styles.particle,
            {
              left: particle.left,
              backgroundColor: particle.color,
              transform: [
                { translateX: particle.x },
                { translateY: particle.y },
                { rotate: particle.rotate.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '360deg'],
                }) },
              ],
            },
          ]}
        />
      ))}
      <View pointerEvents="auto" style={styles.toastContainer}>
        <Toast
          visible
          type="success"
          message={`Level up! Level ${celebration.level} · ${celebration.name}`}
          onDismiss={onDismiss}
          duration={3200}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    top: 0,
    width: 8,
    height: 12,
    borderRadius: 2,
  },
  toastContainer: {
    position: 'absolute',
    top: 46,
    left: 16,
    right: 16,
  },
})
