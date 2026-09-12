import React from 'react'
import { ScrollView, View, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../../context/ThemeContext'
import Text from './Text'

/**
 * Standard screen frame: the canvas colour, the page gutter, and an optional
 * title row.
 *
 * The web's `DashboardLayout` gives every page a `px-4 md:px-8 py-3` gutter, a
 * sticky `text-xl font-bold` title, and a faint `bg-gray-50/30` content canvas
 * with white cards floating on it. On mobile the sticky chrome is the tab bar
 * and the native header, so what carries over is the gutter, the canvas, and
 * the title's weight and size — not a re-created sidebar.
 */
export const Screen = ({
  title,
  subtitle,
  action,
  scroll = true,
  refreshControl,
  contentStyle,
  children,
}) => {
  const { colors } = useTheme()

  const header = (title || subtitle || action) && (
    <View className="flex-row items-start justify-between gap-3">
      <View className="flex-1">
        {title && <Text variant="h1">{title}</Text>}
        {subtitle && (
          <Text variant="body" tone="secondary" className="mt-1">
            {subtitle}
          </Text>
        )}
      </View>
      {action}
    </View>
  )

  const body = (
    <>
      {header}
      {children}
    </>
  )

  // On web, use regular View instead of SafeAreaView
  const Container = Platform.OS === 'web' ? View : SafeAreaView

  return (
    <Container
      {...(Platform.OS !== 'web' && { edges: ['top', 'left', 'right'] })}
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      {scroll ? (
        <ScrollView
          contentContainerClassName="gap-5 p-4 pb-10"
          contentContainerStyle={contentStyle}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {body}
        </ScrollView>
      ) : (
        <View className="flex-1 gap-5 p-4 pb-10" style={contentStyle}>
          {body}
        </View>
      )}
    </Container>
  )
}

export default Screen
