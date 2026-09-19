import React, { useEffect, useRef } from 'react'
import {
  Alert,
  Animated,
  Dimensions,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import { useGamification } from '../hooks/useGamification'
import { brand, neutral, radius } from '../theme'
import { Badge, Text } from './ui'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 340)

export const ProfileSidebar = ({ visible, onClose, navigation }) => {
  const { currentUser, userProfile, logout } = useAuth()
  const { colors, isDark, setThemeMode, themeMode } = useTheme()
  const { t } = useLanguage()
  const { stats, currentLevel } = useGamification()

  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 260,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 220,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start()
    }
  }, [visible])

  if (!visible) return null

  const displayName =
    userProfile?.display_name ||
    currentUser?.displayName ||
    currentUser?.email?.split('@')[0] ||
    'User'
  const userInitial = displayName.charAt(0).toUpperCase()
  const email = currentUser?.email || ''

  const handleLogout = () => {
    Alert.alert(t('profile.logout', 'Log Out'), t('profile.logoutConfirmMessage', 'Are you sure you want to log out?'), [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      {
        text: t('profile.logout', 'Log Out'),
        style: 'destructive',
        onPress: async () => {
          onClose()
          await logout()
        },
      },
    ])
  }

  const navigateTo = (tabName, screenName) => {
    onClose()
    if (navigation) {
      if (screenName) {
        navigation.navigate(tabName, { screen: screenName })
      } else {
        navigation.navigate(tabName)
      }
    }
  }

  const toggleTheme = () => {
    const nextMode = isDark ? 'light' : 'dark'
    setThemeMode(nextMode)
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Sliding Drawer */}
        <Animated.View
          style={[
            styles.drawer,
            {
              width: DRAWER_WIDTH,
              backgroundColor: colors.surface || '#FFFFFF',
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          {/* Drawer Header */}
          <View style={[styles.header, { borderBottomColor: colors.border || '#E5E7EB' }]}>
            <View style={styles.userRow}>
              <View style={[styles.avatarCircle, { backgroundColor: brand.primary }]}>
                <Text style={styles.avatarInitial}>{userInitial}</Text>
              </View>
              <View style={styles.userMeta}>
                <Text variant="h3" numberOfLines={1} style={{ color: colors.text || '#111827' }}>
                  {displayName}
                </Text>
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {email}
                </Text>
                <View style={{ marginTop: 4, flexDirection: 'row' }}>
                  <Badge
                    label={`Lv. ${currentLevel.level} • ${currentLevel.name}`}
                    tone="secondary"
                    bordered
                  />
                </View>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textSecondary || '#6B7280'} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Menu List */}
            <View style={styles.menuSection}>
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => navigateTo('LeaderboardTab')}
              >
                <View style={[styles.menuIconBox, { backgroundColor: 'rgba(168, 85, 247, 0.12)' }]}>
                  <Ionicons name="trophy-outline" size={18} color="#A855F7" />
                </View>
                <Text variant="body" style={styles.menuLabel}>
                  {t('nav.leaderboard', 'Leaderboard')}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary || '#9CA3AF'} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => navigateTo('MilestonesTab')}
              >
                <View style={[styles.menuIconBox, { backgroundColor: 'rgba(249, 115, 22, 0.12)' }]}>
                  <Ionicons name="ribbon-outline" size={18} color="#F97316" />
                </View>
                <Text variant="body" style={styles.menuLabel}>
                  {t('nav.milestones', 'Milestones')}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary || '#9CA3AF'} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => {
                  onClose()
                  Linking.openURL('https://play.google.com/store/apps/details?id=com.mechseiko.suhoor')
                }}
              >
                <View style={[styles.menuIconBox, { backgroundColor: 'rgba(34, 197, 94, 0.12)' }]}>
                  <Ionicons name="star-outline" size={18} color="#22C55E" />
                </View>
                <Text variant="body" style={styles.menuLabel}>
                  {t('profile.rateUs', 'Rate on Play Store')}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary || '#9CA3AF'} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuRow}
                onPress={toggleTheme}
              >
                <View style={[styles.menuIconBox, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
                  <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={18} color="#6366F1" />
                </View>
                <Text variant="body" style={styles.menuLabel}>
                  {isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
                </Text>
                {/* <Badge label={isDark ? 'Dark' : 'Light'} tone="primary" /> */}
              </TouchableOpacity>
            </View>

            {/* Logout Row */}
            <View style={[styles.logoutSection, { borderTopColor: colors.border || '#E5E7EB' }]}>
              <TouchableOpacity
                style={[
                  styles.logoutBtn,
                  {
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.05)',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : '#FCA5A5',
                    borderRadius: 10,
                  },
                ]}
                onPress={handleLogout}
              >
                <Ionicons name="log-out-outline" size={20} color={isDark ? '#F87171' : '#EF4444'} />
                <Text style={[styles.logoutText, { color: isDark ? '#F87171' : '#EF4444' }]}>
                  {t('profile.logout', 'Log Out')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Version */}
            <View style={styles.versionSection}>
              <Text style={styles.versionText}>v1.0.4</Text>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  drawer: {
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 16,
    zIndex: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    rowGap: 12,
    flex: 1,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  userMeta: {
    flex: 1,
  },
  closeBtn: {
    padding: 6,
    marginLeft: 8,
  },
  scrollContent: {
    padding: 20,
  },
  statsCard: {
    borderRadius: radius.xl || 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
  },
  dividerVertical: {
    width: 1,
    height: 32,
  },
  menuSection: {
    columnGap: 4,
    rowGap: 4,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  menuIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  logoutSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    rowGap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '700',
  },
  versionSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
  },
  versionText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
})

export default ProfileSidebar
