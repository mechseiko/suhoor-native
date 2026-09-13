import React from 'react'
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useTheme } from '../context/ThemeContext'
import { brand } from '../theme'
import { Text } from './ui'

export const AuthWrapper = ({
  children,
  title,
  subtitle,
  error,
  bottomTitle,
  bottomsubTitle,
  onBottomPress,
  onBackPress,
}) => {
  const { colors = {} } = useTheme()

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background || '#FFFFFF' }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.container}>
          {/* Back Button */}
          {onBackPress ? (
            <TouchableOpacity
              onPress={onBackPress}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={[
                styles.backBtn,
                { backgroundColor: colors.surfaceVariant || '#F3F4F6' },
              ]}
            >
              <Ionicons
                name="arrow-back"
                size={20}
                color={colors.text || '#111827'}
              />
            </TouchableOpacity>
          ) : null}

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header: Logo beside Titles */}
            <View style={styles.header}>
              <Image
                source={require('../assets/icon-nobg.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <View style={styles.titleGroup}>
                <Text
                  variant="h1"
                  style={[styles.title, { color: colors.text || '#111827' }]}
                >
                  {title}
                </Text>
                {subtitle ? (
                  <Text
                    variant="body"
                    tone="secondary"
                    style={[styles.subtitle, { color: colors.textSecondary || '#6B7280' }]}
                  >
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Error Banner */}
            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons
                  name="alert-circle"
                  size={20}
                  color="#DC2626"
                  style={{ marginRight: 10 }}
                />
                <Text
                  style={styles.errorText}
                >
                  {error}
                </Text>
              </View>
            ) : null}

            {/* Main Form Fields & CTA */}
            <View style={styles.formArea}>{children}</View>

            {/* Bottom Switcher Link */}
            {bottomTitle ? (
              <View style={styles.bottomRow}>
                <Text
                  variant="body"
                  style={[styles.bottomTitle, { color: colors.textSecondary || '#6B7280' }]}
                >
                  {bottomTitle}{' '}
                </Text>
                <TouchableOpacity onPress={onBottomPress} hitSlop={10}>
                  <Text
                    variant="label"
                    style={{ color: brand.secondary, fontWeight: '700', fontSize: 14 }}
                  >
                    {bottomsubTitle}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 70,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
    columnGap: 16,
  },
  logo: {
    width: 56,
    height: 56,
  },
  titleGroup: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    maxWidth: 220,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    flex: 1,
    color: '#B91C1C',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  formArea: {
    width: '100%',
    rowGap: 16,
  },
  bottomRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingTop: 8,
  },
  bottomTitle: {
    fontSize: 14,
  },
})

export default AuthWrapper
