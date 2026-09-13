import React, { useEffect, useMemo } from 'react'
import { Animated, Platform, StyleSheet, View } from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { radius } from '../theme'
import { Card, IconTile, Text } from './ui'

/**
 * Mirrors the web `StatsCard`, which is deliberately spare: a tinted icon tile,
 * then one big figure with its label set small and grey immediately after it
 * (`text-3xl font-bold` + an inline `text-sm text-gray-500`). The number is the
 * only large type on the card, and the subtitle is optional.
 *
 * `tone` maps to the web's `color` prop — blue/purple both resolved to primary
 * there, green to accent, orange to secondary.
 *
 * While `loading` is true the figure and its label are replaced by one pulsing
 * bar. A `0` is a real, meaningful count here ("no groups yet"), so rendering the
 * initial zero before the Firestore read lands states something false — offline,
 * where the read never resolves, it stated it indefinitely.
 */
export const StatsCard = ({
  icon,
  title,
  value,
  tone = 'primary',
  loading = false,
  style,
}) => (
  <Card style={[styles.card, style]}>
    <IconTile icon={icon} tone={tone} size={38} />

    {loading ? (
      <StatSkeleton />
    ) : (
      <View style={styles.textGroup}>
        <Text variant="display">{value}</Text>
        <Text
          variant="caption"
          tone="secondary"
          style={styles.title}
          numberOfLines={2}
        >
          {title}
        </Text>
      </View>
    )}
  </Card>
)

/**
 * One bar covering the height the figure and its label occupy together, so the
 * card doesn't resize when the real values arrive.
 */
const StatSkeleton = () => {
  const { colors } = useTheme()
  const glow = useMemo(() => new Animated.Value(0), [])

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 750,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 750,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    )
    pulse.start()
    return () => pulse.stop()
  }, [glow])

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[
        styles.skeleton,
        {
          backgroundColor: colors.surfaceVariant,
          // Opacity rather than colour so the pulse runs on the native driver.
          opacity: glow.interpolate({
            inputRange: [0, 1],
            outputRange: [0.45, 1],
          }),
        },
      ]}
    />
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '45%',
    rowGap: 12,
  },
  textGroup: {
    rowGap: 2,
  },
  title: {
    marginTop: -2,
  },
  skeleton: {
    // The display figure plus its caption line and the gap between them.
    height: 48,
    width: '100%',
    borderRadius: radius.lg,
  },
})

export default StatsCard
