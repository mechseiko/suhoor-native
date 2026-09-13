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
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        columnGap: 12,
        marginBottom: 8,
      }}
    >
      <View style={{ flex: 1 }}>
        {title && <Text variant="h1">{title}</Text>}
        {subtitle && (
          <Text variant="body" tone="secondary" style={{ marginTop: 4 }}>
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

  const containerPaddingStyle = {
    padding: 16,
    paddingBottom: 40,
    rowGap: 18,
  }

  return (
    <Container
      {...(Platform.OS !== 'web' && { edges: ['top', 'left', 'right'] })}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={[containerPaddingStyle, contentStyle]}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {body}
        </ScrollView>
      ) : (
        <View
          style={[{ flex: 1 }, containerPaddingStyle, contentStyle]}
        >
          {body}
        </View>
      )}
    </Container>
  )
}

export default Screen
