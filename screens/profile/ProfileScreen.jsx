import React, { useState } from 'react'
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
  Modal,
  Pressable,
} from 'react-native'
import { Text } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../context/LanguageContext'
import { db } from '../../config/firebase'
import { doc, updateDoc } from 'firebase/firestore'
import {
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendEmailVerification,
} from 'firebase/auth'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { Colors } from '../../constants/Colors'
import { COLLECTIONS } from '../../config/firestoreSchema'
import Toast from '../../components/Toast'
import LanguageSelector from '../../components/LanguageSelector'

const APP_VERSION = '1.12.0'

export const ProfileScreen = () => {
  const { currentUser, userProfile, logout, deleteAccount } = useAuth()
  const { colors, themeMode, setThemeMode, isDark } = useTheme()
  const { t, isRTL } = useLanguage()

  const [activeTab, setActiveTab] = useState('profile') // 'profile' | 'security' | 'preferences' | 'about'
  const [displayName, setDisplayName] = useState(
    userProfile?.display_name || ''
  )
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Settings updating indicator
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false)
  const [isResendingVerification, setIsResendingVerification] = useState(false)

  // Toast notifications state
  const [toastVisible, setToastVisible] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState('info')

  // Delete account modal state
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [deleteEmailInput, setDeleteEmailInput] = useState('')
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)

  const showToast = (msg, type) => {
    setToastMessage(msg)
    setToastType(type)
    setToastVisible(true)
  }

  const handleUpdateProfile = async () => {
    if (!currentUser) return
    if (displayName.trim().length < 3 || displayName.trim().length > 15) {
      showToast(t('profile.displayNameLengthError'), 'error')
      return
    }

    setIsSavingProfile(true)
    try {
      const userRef = doc(db, COLLECTIONS.profiles, currentUser.uid)
      await updateDoc(userRef, { display_name: displayName.trim() })
      await updateProfile(currentUser, { displayName: displayName.trim() })
      showToast(t('profile.updateSuccess'), 'success')
    } catch (err) {
      console.error(err)
      showToast(t('profile.updateError'), 'error')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handlePasswordChange = async () => {
    if (!currentUser) return
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast(t('profile.fillAllPasswordFields'), 'error')
      return
    }

    if (newPassword !== confirmPassword) {
      showToast(t('profile.newPasswordMismatch'), 'error')
      return
    }

    if (newPassword.length < 6) {
      showToast(t('profile.newPasswordTooShort'), 'error')
      return
    }

    setIsChangingPassword(true)
    try {
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword
      )
      await reauthenticateWithCredential(currentUser, credential)
      await updatePassword(currentUser, newPassword)
      showToast(t('profile.passwordChanged'), 'success')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      console.error(err)
      if (err.code === 'auth/wrong-password') {
        showToast(t('profile.wrongCurrentPassword'), 'error')
      } else {
        showToast(t('profile.passwordChangeError'), 'error')
      }
    } finally {
      setIsChangingPassword(false)
    }
  }

  const toggleFastingSetting = async (key, currentValue) => {
    if (!currentUser) return
    setIsUpdatingSettings(true)
    try {
      const userRef = doc(db, COLLECTIONS.profiles, currentUser.uid)
      if (key.includes('.')) {
        const [parent, child] = key.split('.')
        await updateDoc(userRef, {
          [`${parent}.${child}`]: !currentValue,
        })
      } else {
        await updateDoc(userRef, {
          [`fastingDefaults.${key}`]: !currentValue,
        })
      }
      showToast('Setting updated', 'success')
    } catch (err) {
      console.error('Error updating setting:', err)
      showToast(t('profile.settingUpdateError'), 'error')
    } finally {
      setIsUpdatingSettings(false)
    }
  }

  const handleLogout = () => {
    const confirmLogout = async () => {
      try {
        await logout()
      } catch (error) {
        console.error('Logout failed:', error)
        showToast(t('auth.logoutError'), 'error')
      }
    }

    if (Platform.OS === 'web') {
      confirmLogout()
      return
    }

    Alert.alert(t('settings.logout'), t('profile.logoutConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.logout'),
        style: 'destructive',
        onPress: confirmLogout,
      },
    ])
  }

  const runDeleteAccount = async typedEmail => {
    if (typedEmail?.trim() !== currentUser?.email) {
      showToast(t('profile.emailMismatch'), 'error')
      return
    }

    setIsDeletingAccount(true)
    try {
      await deleteAccount()
      setDeleteModalVisible(false)
      setDeleteEmailInput('')
      showToast(t('profile.accountDeleted'), 'success')
    } catch (error) {
      console.error(error)
      if (error.code === 'auth/requires-recent-login') {
        showToast(t('profile.requiresRecentLogin'), 'error')
      } else {
        showToast(t('profile.deleteAccountError'), 'error')
      }
    } finally {
      setIsDeletingAccount(false)
    }
  }

  const handleDeleteAccount = () => {
    setDeleteModalVisible(true)
  }

  const confirmDeleteAccount = () => {
    runDeleteAccount(deleteEmailInput)
  }

  const handleResendVerification = async () => {
    if (!currentUser || currentUser.emailVerified) return
    setIsResendingVerification(true)
    try {
      await sendEmailVerification(currentUser, {
        url: 'https://suhoor-group.web.app/login',
        handleCodeInApp: true,
      })
      showToast('Verification email sent! Check your inbox.', 'success')
    } catch (err) {
      console.error('Error sending verification email:', err)
      showToast('Unable to send email right now. Please try again.', 'error')
    } finally {
      setIsResendingVerification(false)
    }
  }

  const isVerified = userProfile?.isVerified || currentUser?.emailVerified
  const initial = (displayName || currentUser?.email || 'U')
    .charAt(0)
    .toUpperCase()

  const createdDate = currentUser?.metadata?.creationTime
    ? new Date(currentUser.metadata.creationTime).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : userProfile?.created_at
      ? new Date(userProfile.created_at).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        })
      : 'Recent Member'

  // Themed styles
  const themedStyles = {
    screen: {
      backgroundColor: colors.background,
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    cardTitle: {
      color: colors.text,
    },
    label: {
      color: colors.text,
    },
    inputContainer: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    disabledInput: {
      backgroundColor: colors.surfaceVariant,
      borderColor: colors.border,
    },
    input: {
      color: colors.text,
      textAlign: isRTL ? 'right' : 'left',
    },
    sectionInfo: {
      color: colors.textSecondary,
    },
    settingLabel: {
      color: colors.text,
    },
    settingSub: {
      color: colors.textSecondary,
    },
    supportLabel: {
      color: colors.text,
    },
    supportValue: {
      color: colors.textSecondary,
    },
    versionText: {
      color: colors.textSecondary,
    },
  }

  return (
    <View style={[styles.screen, themedStyles.screen]}>
      <Toast
        message={toastMessage}
        type={toastType}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Avatar Header Banner */}
        <View style={styles.headerBanner}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.headerName}>{displayName || 'Member'}</Text>
              {isVerified ? (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.verifiedBadge, styles.unverifiedBadge]}
                  onPress={handleResendVerification}
                  disabled={isResendingVerification}
                  activeOpacity={0.7}
                >
                  <Ionicons name="alert-circle" size={12} color="#F59E0B" />
                  <Text style={[styles.verifiedText, styles.unverifiedText]}>
                    {isResendingVerification ? 'Sending...' : 'Unverified • Resend'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.headerEmail}>{currentUser?.email}</Text>
            <View style={styles.memberSinceBadge}>
              <Ionicons name="calendar-outline" size={13} color={Colors.secondary} />
              <Text style={styles.memberSinceText}>Member since {createdDate}</Text>
            </View>
          </View>
        </View>

        {/* Segmented Tab Navigation */}
        <View style={[styles.segmentContainer, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(61, 31, 148, 0.08)' }]}>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === 'profile' 
                ? [styles.segmentBtnActive, { backgroundColor: colors.primary }] 
                : styles.segmentBtnInactive,
            ]}
            onPress={() => setActiveTab('profile')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="person-outline"
              size={15}
              color={activeTab === 'profile' ? colors.white : isDark ? colors.text : colors.text}
            />
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'profile' ? colors.white : isDark ? colors.text : colors.text },
              ]}
            >
              Profile
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === 'security' 
                ? [styles.segmentBtnActive, { backgroundColor: colors.primary }] 
                : styles.segmentBtnInactive,
            ]}
            onPress={() => setActiveTab('security')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={15}
              color={activeTab === 'security' ? colors.white : isDark ? colors.text : colors.text}
            />
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'security' ? colors.white : isDark ? colors.text : colors.text },
              ]}
            >
              Security
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === 'preferences' 
                ? [styles.segmentBtnActive, { backgroundColor: colors.primary }] 
                : styles.segmentBtnInactive,
            ]}
            onPress={() => setActiveTab('preferences')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="options-outline"
              size={15}
              color={activeTab === 'preferences' ? colors.white : isDark ? colors.text : colors.text}
            />
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'preferences' ? colors.white : isDark ? colors.text : colors.text },
              ]}
            >
              Preferences
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === 'about' 
                ? [styles.segmentBtnActive, { backgroundColor: colors.primary }] 
                : styles.segmentBtnInactive,
            ]}
            onPress={() => setActiveTab('about')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="information-circle-outline"
              size={15}
              color={activeTab === 'about' ? colors.white : isDark ? colors.text : colors.text}
            />
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'about' ? colors.white : isDark ? colors.text : colors.text },
              ]}
            >
              Help
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab 1: Profile */}
        {activeTab === 'profile' && (
          <View>
            <View style={[styles.card, themedStyles.card]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, themedStyles.cardTitle]}>
                  {t('profile.accountInformation')}
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, themedStyles.label]}>
                  {t('settings.emailAddress')}
                </Text>
                <View
                  style={[
                    styles.inputContainer,
                    styles.disabledInput,
                    themedStyles.disabledInput,
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={colors.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, themedStyles.input]}
                    value={currentUser?.email || ''}
                    editable={false}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, themedStyles.label]}>
                  {t('auth.displayName')}
                </Text>
                <View
                  style={[styles.inputContainer, themedStyles.inputContainer]}
                >
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={colors.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, themedStyles.input]}
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder={t('profile.enterDisplayName')}
                    placeholderTextColor={colors.textSecondary}
                    maxLength={15}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: Colors.primary },
                ]}
                onPress={handleUpdateProfile}
                disabled={isSavingProfile}
              >
                {isSavingProfile ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons
                      name="save-outline"
                      size={18}
                      color={Colors.white}
                    />
                    <Text style={styles.primaryButtonText}>
                      {t('profile.updateProfile')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.logoutBannerBtn}
              onPress={handleLogout}
            >
              <Ionicons
                name="log-out-outline"
                size={18}
                color={Colors.primary}
              />
              <Text style={styles.logoutBannerText}>
                {t('settings.logout')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tab 2: Security */}
        {activeTab === 'security' && (
          <View>
            <View style={[styles.card, themedStyles.card]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, themedStyles.cardTitle]}>
                  {t('settings.security')}
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, themedStyles.label]}>
                  {t('profile.currentPassword')}
                </Text>
                <View
                  style={[styles.inputContainer, themedStyles.inputContainer]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={colors.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, themedStyles.input]}
                    secureTextEntry={!showCurrentPassword}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder={t('profile.enterCurrentPassword')}
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    <Ionicons
                      name={
                        showCurrentPassword ? 'eye-off-outline' : 'eye-outline'
                      }
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, themedStyles.label]}>
                  {t('profile.newPassword')}
                </Text>
                <View
                  style={[styles.inputContainer, themedStyles.inputContainer]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={colors.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, themedStyles.input]}
                    secureTextEntry={!showNewPassword}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder={t('profile.enterNewPassword')}
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowNewPassword(!showNewPassword)}
                  >
                    <Ionicons
                      name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, themedStyles.label]}>
                  {t('profile.confirmNewPassword')}
                </Text>
                <View
                  style={[styles.inputContainer, themedStyles.inputContainer]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={colors.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, themedStyles.input]}
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder={t('profile.confirmNewPasswordPlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Ionicons
                      name={
                        showConfirmPassword ? 'eye-off-outline' : 'eye-outline'
                      }
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: Colors.primary },
                ]}
                onPress={handlePasswordChange}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={18}
                      color={Colors.white}
                    />
                    <Text style={styles.primaryButtonText}>
                      {t('settings.changePassword')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Danger Zone */}
            <View style={[styles.card, styles.dangerCard]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: Colors.red }]}>
                  {t('settings.deleteAccount')}
                </Text>
              </View>
              <Text style={styles.dangerSubtext}>
                Permanently delete your account and all associated data.
              </Text>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDeleteAccount}
              >
                <Ionicons name="trash-outline" size={18} color={Colors.red} />
                <Text style={styles.deleteButtonText}>
                  {t('settings.deleteAccount')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Tab 3: Preferences */}
        {activeTab === 'preferences' && (
          <View>
            {/* Fasting Defaults */}
            <View style={[styles.card, themedStyles.card]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, themedStyles.cardTitle]}>
                  {t('settings.fastingDefaults')}
                </Text>
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingTextContainer}>
                  <Text
                    style={[styles.settingLabel, themedStyles.settingLabel]}
                  >
                    {t('settings.sunnahDays')}
                  </Text>
                  <Text style={[styles.settingSub, themedStyles.settingSub]}>
                    {t('settings.sunnahDaysDesc')}
                  </Text>
                </View>
                <Switch
                  value={userProfile?.fastingDefaults?.sunnah ?? true}
                  onValueChange={() =>
                    toggleFastingSetting(
                      'sunnah',
                      userProfile?.fastingDefaults?.sunnah ?? true
                    )
                  }
                  disabled={isUpdatingSettings}
                  trackColor={{ false: Colors.muted, true: Colors.primary }}
                  thumbColor={Colors.white}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingTextContainer}>
                  <Text
                    style={[styles.settingLabel, themedStyles.settingLabel]}
                  >
                    {t('settings.whiteDays')}
                  </Text>
                  <Text style={[styles.settingSub, themedStyles.settingSub]}>
                    {t('settings.whiteDaysDesc')}
                  </Text>
                </View>
                <Switch
                  value={userProfile?.fastingDefaults?.whiteDays ?? true}
                  onValueChange={() =>
                    toggleFastingSetting(
                      'whiteDays',
                      userProfile?.fastingDefaults?.whiteDays ?? true
                    )
                  }
                  disabled={isUpdatingSettings}
                  trackColor={{ false: Colors.muted, true: Colors.primary }}
                  thumbColor={Colors.white}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingTextContainer}>
                  <Text
                    style={[styles.settingLabel, themedStyles.settingLabel]}
                  >
                    {t('settings.ramadan')}
                  </Text>
                  <Text style={[styles.settingSub, themedStyles.settingSub]}>
                    {t('settings.ramadanDesc')}
                  </Text>
                </View>
                <Switch
                  value={userProfile?.fastingDefaults?.ramadan ?? true}
                  onValueChange={() =>
                    toggleFastingSetting(
                      'ramadan',
                      userProfile?.fastingDefaults?.ramadan ?? true
                    )
                  }
                  disabled={isUpdatingSettings}
                  trackColor={{ false: Colors.muted, true: Colors.primary }}
                  thumbColor={Colors.white}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingTextContainer}>
                  <Text
                    style={[styles.settingLabel, themedStyles.settingLabel]}
                  >
                    {t('settings.dhulHijjah')}
                  </Text>
                  <Text style={[styles.settingSub, themedStyles.settingSub]}>
                    {t('settings.dhulHijjahDesc')}
                  </Text>
                </View>
                <Switch
                  value={userProfile?.fastingDefaults?.dhulHijjah ?? true}
                  onValueChange={() =>
                    toggleFastingSetting(
                      'dhulHijjah',
                      userProfile?.fastingDefaults?.dhulHijjah ?? true
                    )
                  }
                  disabled={isUpdatingSettings}
                  trackColor={{ false: Colors.muted, true: Colors.primary }}
                  thumbColor={Colors.white}
                />
              </View>
            </View>

            {/* Audio & Notifications */}
            <View style={[styles.card, themedStyles.card]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, themedStyles.cardTitle]}>
                  {t('settings.preferences')}
                </Text>
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingTextContainer}>
                  <Text
                    style={[styles.settingLabel, themedStyles.settingLabel]}
                  >
                    {t('settings.notificationSounds')}
                  </Text>
                  <Text style={[styles.settingSub, themedStyles.settingSub]}>
                    {t('settings.notificationSoundsDesc')}
                  </Text>
                </View>
                <Switch
                  value={userProfile?.preferences?.soundEnabled ?? true}
                  onValueChange={() =>
                    toggleFastingSetting(
                      'preferences.soundEnabled',
                      userProfile?.preferences?.soundEnabled ?? true
                    )
                  }
                  disabled={isUpdatingSettings}
                  trackColor={{ false: Colors.muted, true: Colors.primary }}
                  thumbColor={Colors.white}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingTextContainer}>
                  <Text
                    style={[styles.settingLabel, themedStyles.settingLabel]}
                  >
                    {t('settings.buzzAlerts')}
                  </Text>
                  <Text style={[styles.settingSub, themedStyles.settingSub]}>
                    {t('settings.buzzAlertsDesc')}
                  </Text>
                </View>
                <Switch
                  value={userProfile?.preferences?.buzzNotifications ?? true}
                  onValueChange={() =>
                    toggleFastingSetting(
                      'preferences.buzzNotifications',
                      userProfile?.preferences?.buzzNotifications ?? true
                    )
                  }
                  disabled={isUpdatingSettings}
                  trackColor={{ false: Colors.muted, true: Colors.primary }}
                  thumbColor={Colors.white}
                />
              </View>
            </View>

            {/* Language Selection */}
            <View style={[styles.card, themedStyles.card]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, themedStyles.cardTitle]}>
                  {t('settings.language')}
                </Text>
              </View>
              <LanguageSelector />
            </View>
          </View>
        )}

        {/* Tab 4: About */}
        {activeTab === 'about' && (
          <View>
            <View style={[styles.card, themedStyles.card]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, themedStyles.cardTitle]}>
                  {t('profile.supportAndLinks')}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.supportLink}
                onPress={() => Linking.openURL('mailto:suhoorapp@gmail.com')}
              >
                <View style={styles.supportLeft}>
                  <Ionicons name="mail" size={20} color={Colors.primary} />
                  <Text
                    style={[styles.supportLabel, themedStyles.supportLabel]}
                  >
                    {t('profile.supportEmail')}
                  </Text>
                </View>
                <Text style={[styles.supportValue, themedStyles.supportValue]}>
                  suhoorapp@gmail.com
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.supportLink, styles.lastSupportLink]}
                onPress={() =>
                  Linking.openURL(
                    'https://mechseiko.com/contact?from=suhoor'
                  )
                }
              >
                <View style={styles.supportLeft}>
                  <Ionicons
                    name="code-slash"
                    size={20}
                    color={Colors.primary}
                  />
                  <Text
                    style={[styles.supportLabel, themedStyles.supportLabel]}
                  >
                    {t('profile.developerProfile')}
                  </Text>
                </View>
                <Text style={[styles.supportValue, themedStyles.supportValue]}>
                  mechseiko
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.versionText, themedStyles.versionText]}>
              {t('settings.appVersion', { version: APP_VERSION })}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setDeleteModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={32} color={Colors.red} />
              <Text style={styles.modalTitle}>{t('settings.deleteAccount')}</Text>
            </View>

            <Text style={styles.modalWarningText}>
              {t('profile.deleteAccountWarning')}
            </Text>

            <Text style={styles.modalInputLabel}>
              {t('profile.confirmDeletionMessage')}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={deleteEmailInput}
              onChangeText={setDeleteEmailInput}
              placeholder={currentUser?.email}
              placeholderTextColor={Colors.gray}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setDeleteModalVisible(false)
                  setDeleteEmailInput('')
                }}
                disabled={isDeletingAccount}
              >
                <Text style={styles.modalCancelButtonText}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalDeleteButton]}
                onPress={confirmDeleteAccount}
                disabled={isDeletingAccount}
              >
                {isDeletingAccount ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={styles.modalDeleteButtonText}>
                    {t('profile.deletePermanently')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  headerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    gap: 14,
  },
  avatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.secondary,
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
  },
  headerEmail: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
    gap: 3,
  },
  unverifiedBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#34D399',
  },
  unverifiedText: {
    color: '#FBBF24',
  },
  memberSinceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: 'fit-content',
    marginTop: 6,
  },
  memberSinceText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(61, 31, 148, 0.08)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  segmentBtnActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentBtnInactive: {
    backgroundColor: 'transparent',
  },
  segmentText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  segmentTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(61, 31, 148, 0.05)',
  },
  dangerCard: {
    borderColor: 'rgba(239, 68, 68, 0.2)',
    backgroundColor: 'rgba(239, 68, 68, 0.02)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.muted,
    paddingBottom: 10,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.muted,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: Colors.white,
  },
  disabledInput: {
    backgroundColor: Colors.lightGray,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.dark,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 4,
    gap: 6,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.04)',
  },
  settingTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark,
  },
  settingSub: {
    fontSize: 11,
    color: Colors.gray,
    marginTop: 2,
  },
  supportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.04)',
  },
  lastSupportLink: {
    borderBottomWidth: 0,
  },
  supportLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  supportLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark,
  },
  supportValue: {
    fontSize: 12,
    color: Colors.gray,
  },
  logoutBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(61, 31, 148, 0.2)',
    backgroundColor: 'rgba(61, 31, 148, 0.05)',
    gap: 6,
    marginTop: 4,
  },
  logoutBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  dangerSubtext: {
    fontSize: 12,
    color: Colors.gray,
    marginBottom: 12,
    lineHeight: 18,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.red,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    gap: 6,
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.red,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 11,
    color: Colors.gray,
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark,
  },
  modalWarningText: {
    fontSize: 14,
    color: Colors.gray,
    lineHeight: 20,
    marginBottom: 20,
  },
  modalInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark,
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.muted,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.dark,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: Colors.lightGray,
  },
  modalCancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark,
  },
  modalDeleteButton: {
    backgroundColor: Colors.red,
  },
  modalDeleteButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
})

export default ProfileScreen
