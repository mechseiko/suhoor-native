import React from 'react'
import { View } from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useLanguage } from '../../context/LanguageContext'
import { useTheme } from '../../context/ThemeContext'
import { radius, spacing } from '../../theme'
import { Screen, Text } from '../../components/ui'

/**
 * Temporary closed-testing destination for the Groups tab. The existing groups
 * stack and data remain untouched, making the feature safe to restore later.
 */
export const GroupsComingSoonScreen = () => {
  const { colors } = useTheme()
  const { t } = useLanguage()

  return (
    <Screen
      scroll={false}
      contentStyle={{ alignItems: 'center', justifyContent: 'center', paddingBottom: 96 }}
    >
      <View
        style={{
          alignItems: 'center',
          maxWidth: 320,
          paddingHorizontal: spacing.lg,
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${colors.primary}14`,
            marginBottom: spacing.lg,
          }}
        >
          <Ionicons name="people-outline" size={34} color={colors.primary} />
        </View>
        <Text variant="h1" style={{ color: colors.text, textAlign: 'center' }}>
          {t('groups.comingSoonTitle')}
        </Text>
        <Text
          variant="body"
          tone="secondary"
          style={{ marginTop: spacing.sm, textAlign: 'center', lineHeight: 22 }}
        >
          {t('groups.comingSoonDescription')}
        </Text>
      </View>
    </Screen>
  )
}

export default GroupsComingSoonScreen
