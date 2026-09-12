import React from 'react'
import { Text, View, TouchableOpacity, ActivityIndicator } from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'

/**
 * Language switcher for the mobile app — the counterpart to the web app's
 * src/components/LanguageSelector.jsx.
 *
 * Reads the language list from config/languages.js via useLanguage, so it never
 * names a language itself. Each row is rendered with its own `writingDirection`
 * so Arabic and Urdu endonyms read correctly even while the surrounding layout
 * is still LTR.
 */
export const LanguageSelector = () => {
  const { colors } = useTheme()
  const {
    locale,
    languages,
    changeLanguage,
    t,
    isLoadingLocale,
    needsRestartForRtl,
  } = useLanguage()

  if (isLoadingLocale) {
    return (
      <View className="items-center py-5">
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    )
  }

  return (
    <View>
      {languages.map((lang, index) => {
        const isActive = lang.code === locale
        const isLast = index === languages.length - 1

        return (
          <TouchableOpacity
            key={lang.code}
            onPress={() => changeLanguage(lang.code)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive }}
            className={`flex-row items-center justify-between border-b py-3 ${isLast ? 'border-b-0' : ''}`}
            style={{ borderBottomColor: colors.border }}
          >
            <View className="flex-1 pe-4">
              <Text
                style={[
                  { fontSize: 15, fontWeight: '600' },
                  { color: isActive ? colors.primary : colors.text },
                  { writingDirection: lang.dir },
                ]}
              >
                {lang.nativeName}
              </Text>
              <Text
                className="mt-0.5 text-xs"
                style={{ color: colors.textSecondary }}
              >
                {lang.name}
              </Text>
            </View>

            {isActive ? (
              <Ionicons
                name="checkmark-circle"
                size={22}
                color={colors.primary}
              />
            ) : (
              <Ionicons name="ellipse-outline" size={22} color={colors.muted} />
            )}
          </TouchableOpacity>
        )
      })}

      {needsRestartForRtl && (
        <View
          className="mt-3 flex-row items-start gap-2 rounded-[10px] p-3"
          style={{ backgroundColor: colors.surfaceVariant }}
        >
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={colors.secondary}
          />
          <Text
            className="flex-1 text-xs leading-4.25"
            style={{ color: colors.textSecondary }}
          >
            {t(
              'settings.restartForRtl',
              'Restart the app to finish switching the layout direction.'
            )}
          </Text>
        </View>
      )}
    </View>
  )
}

export default LanguageSelector
