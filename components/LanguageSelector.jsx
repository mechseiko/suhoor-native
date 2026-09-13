import React from 'react'
import { Text, View, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
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
      <View style={styles.loadingContainer}>
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
            style={[
              styles.langRow,
              { borderBottomColor: colors.border },
              isLast && styles.langRowLast,
            ]}
          >
            <View style={styles.langTextGroup}>
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
                style={[styles.langSubtitle, { color: colors.textSecondary }]}
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
          style={[styles.restartBanner, { backgroundColor: colors.surfaceVariant }]}
        >
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={colors.secondary}
          />
          <Text
            style={[styles.restartText, { color: colors.textSecondary }]}
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

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  langRowLast: {
    borderBottomWidth: 0,
  },
  langTextGroup: {
    flex: 1,
    paddingEnd: 16,
  },
  langSubtitle: {
    marginTop: 2,
    fontSize: 12,
  },
  restartBanner: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: 8,
    borderRadius: 10,
    padding: 12,
  },
  restartText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
})

export default LanguageSelector
