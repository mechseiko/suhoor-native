import React, { useState } from "react";
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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import {
  clearUserLocation,
  getCurrentCoordinates,
  saveUserLocation,
} from "../../utils/location";
import { useLanguage } from "../../context/LanguageContext";
import { db } from "../../config/firebase";
import { doc, updateDoc } from "firebase/firestore";
import {
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendEmailVerification,
} from "firebase/auth";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Colors } from "../../constants/Colors";
import { COLLECTIONS } from "../../config/firestoreSchema";
import Toast from "../../components/Toast";
import LanguageSelector from "../../components/LanguageSelector";

const APP_VERSION = "1.0.8";

const ProfileScreen = () => {
  const { currentUser, userProfile, logout, deleteAccount } = useAuth();
  const { colors, themeMode, setThemeMode, isDark } = useTheme();
  const { t, isRTL } = useLanguage();

  const [activeTab, setActiveTab] = useState("profile"); // 'profile' | 'security' | 'preferences' | 'about'
  const [displayName, setDisplayName] = useState(
    userProfile?.display_name || ""
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Settings updating indicator
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);

  // Toast notifications state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("info");

  // Delete account modal state
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteEmailInput, setDeleteEmailInput] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Alarm PIN state
  const [alarmPin, setAlarmPin] = useState(["", "", "", ""]);
  const [pinError, setPinError] = useState("");
  const [isSavingPin, setIsSavingPin] = useState(false);
  const pinRefs = [
    React.useRef(),
    React.useRef(),
    React.useRef(),
    React.useRef(),
  ];

  // Location selector state
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [locationResults, setLocationResults] = useState([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(
    userProfile?.preferences?.defaultLocation || null
  );

  const showToast = (msg, type) => {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
  };

  // Load current alarm PIN from profile
  React.useEffect(() => {
    if (userProfile?.pin) {
      const pinDigits = userProfile.pin.split("");
      setAlarmPin(pinDigits.length === 4 ? pinDigits : ["", "", "", ""]);
    }
  }, [userProfile]);

  const searchLocation = React.useCallback(
    async (query) => {
      if (!query || query.length < 3) {
        setLocationResults([]);
        return;
      }

      setIsSearchingLocation(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query
          )}&limit=10&addressdetails=1&accept-language=en`,
          { headers: { Accept: "application/json" } }
        );
        const data = await response.json();
        const results = data.map((item) => ({
          name: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        }));
        setLocationResults(results);
      } catch (err) {
        console.error("Error searching location:", err);
        showToast(t("profile.locationSearchError", "Failed to search location"), "error");
      } finally {
        setIsSearchingLocation(false);
      }
    },
    [showToast]
  );

  // Sync selected location with profile
  React.useEffect(() => {
    if (userProfile?.preferences?.defaultLocation) {
      setSelectedLocation(userProfile.preferences.defaultLocation);
    } else {
      setSelectedLocation(null);
    }
  }, [userProfile?.preferences?.defaultLocation]);

  // Debounced location search
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (locationSearch.length >= 3) {
        searchLocation(locationSearch);
      } else {
        setLocationResults([]);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [locationSearch, searchLocation]);

  // Handle PIN digit changes
  const handlePinDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const next = [...alarmPin];
    next[index] = digit;
    setAlarmPin(next);
    setPinError("");
    if (digit && index < 3) {
      pinRefs[index + 1]?.current?.focus();
    }
  };

  const handlePinKeyPress = (index, e) => {
    if (e.nativeEvent?.key === "Backspace" && !alarmPin[index] && index > 0) {
      pinRefs[index - 1]?.current?.focus();
    }
  };

  // Save alarm PIN
  const handleSavePin = async () => {
    if (!currentUser) return;
    const pinStr = alarmPin.join("");
    if (pinStr.length < 4 || alarmPin.some((d) => d === "")) {
      setPinError("Please enter all 4 digits of your PIN.");
      return;
    }

    setIsSavingPin(true);
    try {
      // Save to Firestore
      const userRef = doc(db, COLLECTIONS.profiles, currentUser.uid);
      await updateDoc(userRef, { pin: pinStr });

      // Save to AsyncStorage for alarm overlay
      await AsyncStorage.setItem("suhoor_alarm_pin", pinStr);

      showToast("Alarm PIN updated successfully!", "success");
      setPinError("");
    } catch (err) {
      console.error("Error saving PIN:", err);
      showToast(t("profile.pinUpdateError", "Failed to update PIN. Please try again."), "error");
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!currentUser) return;
    if (displayName.trim().length < 3 || displayName.trim().length > 15) {
      showToast(t("profile.displayNameLengthError"), "error");
      return;
    }

    setIsSavingProfile(true);
    try {
      const userRef = doc(db, COLLECTIONS.profiles, currentUser.uid);
      await updateDoc(userRef, { display_name: displayName.trim() });
      await updateProfile(currentUser, { displayName: displayName.trim() });
      showToast(t("profile.updateSuccess"), "success");
    } catch (err) {
      console.error(err);
      showToast(t("profile.updateError"), "error");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentUser) return;
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast(t("profile.fillAllPasswordFields"), "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast(t("profile.newPasswordMismatch"), "error");
      return;
    }

    if (newPassword.length < 6) {
      showToast(t("profile.newPasswordTooShort"), "error");
      return;
    }

    setIsChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword
      );
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      showToast(t("profile.passwordChanged"), "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/wrong-password") {
        showToast(t("profile.wrongCurrentPassword"), "error");
      } else {
        showToast(t("profile.passwordChangeError"), "error");
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSelectLocation = async (location) => {
    if (!currentUser) return;
    setIsUpdatingSettings(true);
    try {
      const userRef = doc(db, COLLECTIONS.profiles, currentUser.uid);
      const savedLocation = {
        lat: location.lat,
        lng: location.lng,
        name: location.name,
      };
      await updateDoc(userRef, {
        "preferences.defaultLocation": savedLocation,
      });
      await saveUserLocation(savedLocation);
      setSelectedLocation(location);
      setShowLocationModal(false);
      setLocationSearch("");
      setLocationResults([]);
      showToast(t("profile.defaultLocationUpdated", "Default location updated"), "success");
    } catch (err) {
      console.error("Error updating location:", err);
      showToast(t("profile.locationUpdateError", "Failed to update location"), "error");
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    setIsUpdatingSettings(true);
    try {
      await clearUserLocation();
      const result = await getCurrentCoordinates(currentUser?.uid);
      if (!result.coordinates || result.source !== "gps") {
        showToast(
          "Could not detect your current location. Enable location services and try again.",
          "error"
        );
        return;
      }
      const current = {
        ...result.coordinates,
        name: t("profile.currentDeviceLocation", "Current device location"),
      };
      await updateDoc(doc(db, "profiles", currentUser.uid), {
        "preferences.defaultLocation": current,
      });
      await saveUserLocation(current);
      setSelectedLocation(current);
      setShowLocationModal(false);
      showToast(t("profile.currentLocationSaved", "Current location saved"), "success");
    } catch (err) {
      console.error("Error detecting current location:", err);
      showToast("Could not detect your current location", "error");
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleClearLocation = async () => {
    if (!currentUser) return;
    setIsUpdatingSettings(true);
    try {
      const userRef = doc(db, COLLECTIONS.profiles, currentUser.uid);
      await updateDoc(userRef, {
        "preferences.defaultLocation": null,
      });
      setSelectedLocation(null);
      showToast(t("profile.defaultLocationCleared", "Default location cleared"), "success");
    } catch (err) {
      console.error("Error clearing location:", err);
      showToast(t("profile.locationClearError", "Failed to clear location"), "error");
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleLogout = () => {
    const confirmLogout = async () => {
      try {
        await logout();
      } catch (error) {
        console.error("Logout failed:", error);
        showToast(t("auth.logoutError"), "error");
      }
    };

    if (Platform.OS === "web") {
      confirmLogout();
      return;
    }

    Alert.alert(t("settings.logout"), t("profile.logoutConfirmMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.logout"),
        style: "destructive",
        onPress: confirmLogout,
      },
    ]);
  };

  const runDeleteAccount = async (typedEmail) => {
    if (typedEmail?.trim() !== currentUser?.email) {
      showToast(t("profile.emailMismatch"), "error");
      return;
    }

    setIsDeletingAccount(true);
    try {
      await deleteAccount();
      setDeleteModalVisible(false);
      setDeleteEmailInput("");
      showToast(t("profile.accountDeleted"), "success");
    } catch (error) {
      console.error(error);
      if (error.code === "auth/requires-recent-login") {
        showToast(t("profile.requiresRecentLogin"), "error");
      } else {
        showToast(t("profile.deleteAccountError"), "error");
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleDeleteAccount = () => {
    setDeleteModalVisible(true);
  };

  const confirmDeleteAccount = () => {
    runDeleteAccount(deleteEmailInput);
  };

  const handleResendVerification = async () => {
    if (!currentUser || currentUser.emailVerified) return;
    setIsResendingVerification(true);
    try {
      await sendEmailVerification(currentUser, {
        url: "https://suhoor-group.web.app/login",
        handleCodeInApp: true,
      });
      showToast("Verification email sent! Check your inbox.", "success");
    } catch (err) {
      console.error("Error sending verification email:", err);
      showToast("Unable to send email right now. Please try again.", "error");
    } finally {
      setIsResendingVerification(false);
    }
  };

  const isVerified = userProfile?.isVerified || currentUser?.emailVerified;
  const initial = (displayName || currentUser?.email || "U")
    .charAt(0)
    .toUpperCase();

  const createdDate = currentUser?.metadata?.creationTime
    ? new Date(currentUser.metadata.creationTime).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : userProfile?.created_at
    ? new Date(userProfile.created_at).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : "Recent Member";

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
      textAlign: isRTL ? "right" : "left",
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
    searchInput: {
      backgroundColor: colors.surface,
      color: colors.text,
    },
    locationResultText: {
      color: colors.text,
    },
    noResultsText: {
      color: colors.textSecondary,
    },
    settingButton: {
      backgroundColor: colors.surfaceVariant,
    },
  };

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
              <Text style={styles.headerName}>
                {displayName || t("common.member", "Member")}
              </Text>
              {isVerified ? (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                  <Text style={styles.verifiedText}>
                    {t("profile.verified", "Verified")}
                  </Text>
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
                    {isResendingVerification
                      ? t("profile.resending", "Sending...")
                      : t("profile.unverified", "Unverified • Resend")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.headerEmail}>{currentUser?.email}</Text>
            <View style={styles.memberSinceBadge}>
              <Ionicons
                name="calendar-outline"
                size={13}
                color={Colors.secondary}
              />
              <Text style={styles.memberSinceText}>
                {t(
                  "profile.memberSince",
                  { date: createdDate },
                  `Member since ${createdDate}`
                )}
              </Text>
            </View>
          </View>
        </View>

        {/* Segmented Tab Navigation */}
        <View
          style={[
            styles.segmentContainer,
            {
              backgroundColor: isDark
                ? "rgba(255, 255, 255, 0.08)"
                : "rgba(61, 31, 148, 0.08)",
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === "profile"
                ? [styles.segmentBtnActive, { backgroundColor: colors.primary }]
                : styles.segmentBtnInactive,
            ]}
            onPress={() => setActiveTab("profile")}
            activeOpacity={0.8}
          >
            <Ionicons
              name="person-outline"
              size={15}
              color={
                activeTab === "profile"
                  ? colors.white
                  : isDark
                  ? colors.text
                  : colors.text
              }
            />
            <Text
              style={[
                styles.segmentText,
                {
                  color:
                    activeTab === "profile"
                      ? colors.white
                      : isDark
                      ? colors.text
                      : colors.text,
                },
              ]}
            >
              {t("settings.profile", "Profile")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === "security"
                ? [styles.segmentBtnActive, { backgroundColor: colors.primary }]
                : styles.segmentBtnInactive,
            ]}
            onPress={() => setActiveTab("security")}
            activeOpacity={0.8}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={15}
              color={
                activeTab === "security"
                  ? colors.white
                  : isDark
                  ? colors.text
                  : colors.text
              }
            />
            <Text
              style={[
                styles.segmentText,
                {
                  color:
                    activeTab === "security"
                      ? colors.white
                      : isDark
                      ? colors.text
                      : colors.text,
                },
              ]}
            >
              {t("settings.security", "Security")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === "preferences"
                ? [styles.segmentBtnActive, { backgroundColor: colors.primary }]
                : styles.segmentBtnInactive,
            ]}
            onPress={() => setActiveTab("preferences")}
            activeOpacity={0.8}
          >
            <Ionicons
              name="options-outline"
              size={15}
              color={
                activeTab === "preferences"
                  ? colors.white
                  : isDark
                  ? colors.text
                  : colors.text
              }
            />
            <Text
              style={[
                styles.segmentText,
                {
                  color:
                    activeTab === "preferences"
                      ? colors.white
                      : isDark
                      ? colors.text
                      : colors.text,
                },
              ]}
            >
              {t("settings.preferences", "Preferences")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === "about"
                ? [styles.segmentBtnActive, { backgroundColor: colors.primary }]
                : styles.segmentBtnInactive,
            ]}
            onPress={() => setActiveTab("about")}
            activeOpacity={0.8}
          >
            <Ionicons
              name="information-circle-outline"
              size={15}
              color={
                activeTab === "about"
                  ? colors.white
                  : isDark
                  ? colors.text
                  : colors.text
              }
            />
            <Text
              style={[
                styles.segmentText,
                {
                  color:
                    activeTab === "about"
                      ? colors.white
                      : isDark
                      ? colors.text
                      : colors.text,
                },
              ]}
            >
              {t("settings.help", "Help")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab 1: Profile */}
        {activeTab === "profile" && (
          <View>
            <View style={[styles.card, themedStyles.card]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, themedStyles.cardTitle]}>
                  {t("profile.accountInformation")}
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, themedStyles.label]}>
                  {t("settings.emailAddress")}
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
                    value={currentUser?.email || ""}
                    editable={false}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, themedStyles.label]}>
                  {t("auth.displayName")}
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
                    placeholder={t("profile.enterDisplayName")}
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
                      {t("profile.updateProfile")}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.logoutBannerBtn,
                {
                  borderColor: isDark ? "rgba(239, 68, 68, 0.4)" : "#FCA5A5",
                  backgroundColor: isDark
                    ? "rgba(239, 68, 68, 0.12)"
                    : "rgba(239, 68, 68, 0.05)",
                },
              ]}
              onPress={handleLogout}
            >
              <Ionicons
                name="log-out-outline"
                size={18}
                color={isDark ? "#F87171" : "#DC2626"}
              />
              <Text
                style={[
                  styles.logoutBannerText,
                  { color: isDark ? "#F87171" : "#DC2626" },
                ]}
              >
                {t("settings.logout")}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tab 2: Security */}
        {activeTab === "security" && (
          <View>
            <View style={[styles.card, themedStyles.card]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, themedStyles.cardTitle]}>
                  {t("settings.security")}
                </Text>
              </View>

              {/* Alarm PIN Section */}
              <View style={{ marginBottom: 32 }}>
                <Text
                  style={[
                    styles.label,
                    themedStyles.label,
                    { marginBottom: 8 },
                  ]}
                >
                  {t("profile.alarmPin", "Alarm PIN")}
                </Text>
                <Text
                  style={[
                    styles.dangerSubtext,
                    { color: colors.textSecondary, marginBottom: 16 },
                  ]}
                >
                  {t(
                    "profile.alarmPinDescription",
                    { pin: alarmPin.join("") },
                    `Set a 4-digit PIN to dismiss your Suhoor alarm. This ensures you're truly awake when stopping the alarm. Your current pin is: ${alarmPin.join(
                      ""
                    )}`
                  )}
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "center",
                    columnGap: 12,
                    marginBottom: 16,
                  }}
                >
                  {alarmPin.map((digit, i) => (
                    <TextInput
                      key={i}
                      ref={pinRefs[i]}
                      value={digit}
                      onChangeText={(val) => handlePinDigitChange(i, val)}
                      onKeyPress={(e) => handlePinKeyPress(i, e)}
                      keyboardType="number-pad"
                      maxLength={1}
                      secureTextEntry
                      style={{
                        width: 56,
                        height: 64,
                        textAlign: "center",
                        fontSize: 28,
                        fontWeight: "900",
                        borderWidth: 2,
                        borderColor: digit
                          ? isDark
                            ? colors.secondary
                            : Colors.primary
                          : colors.border,
                        borderRadius: 12,
                        backgroundColor: digit
                          ? isDark
                            ? "rgba(249, 168, 38, 0.12)"
                            : "rgba(21,12,51,0.04)"
                          : colors.surfaceVariant,
                        color: isDark ? colors.secondary : Colors.primary,
                      }}
                    />
                  ))}
                </View>

                {pinError ? (
                  <Text
                    style={[
                      styles.dangerSubtext,
                      {
                        color: Colors.red,
                        marginBottom: 12,
                        textAlign: "center",
                      },
                    ]}
                  >
                    {pinError}
                  </Text>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    { backgroundColor: Colors.primary },
                  ]}
                  onPress={handleSavePin}
                  disabled={isSavingPin}
                >
                  {isSavingPin ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <>
                      <Ionicons
                        name="lock-closed-outline"
                        size={18}
                        color={Colors.white}
                      />
                      <Text style={styles.primaryButtonText}>
                        {t("profile.saveAlarmPin", "Save Alarm PIN")}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.sectionDivider} />

              <View style={styles.inputGroup}>
                <Text style={[styles.label, themedStyles.label]}>
                  {t("profile.currentPassword")}
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
                    placeholder={t("profile.enterCurrentPassword")}
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    <Ionicons
                      name={
                        showCurrentPassword ? "eye-off-outline" : "eye-outline"
                      }
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, themedStyles.label]}>
                  {t("profile.newPassword")}
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
                    placeholder={t("profile.enterNewPassword")}
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowNewPassword(!showNewPassword)}
                  >
                    <Ionicons
                      name={showNewPassword ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, themedStyles.label]}>
                  {t("profile.confirmNewPassword")}
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
                    placeholder={t("profile.confirmNewPasswordPlaceholder")}
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Ionicons
                      name={
                        showConfirmPassword ? "eye-off-outline" : "eye-outline"
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
                      {t("settings.changePassword")}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Danger Zone */}
            <View style={[styles.card, styles.dangerCard]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: Colors.red }]}>
                  {t("settings.deleteAccount")}
                </Text>
              </View>
              <Text style={styles.dangerSubtext}>
                {t("profile.deleteAccountWarning")}
              </Text>

              <TouchableOpacity
                style={styles.dangerButton}
                onPress={handleDeleteAccount}
              >
                <Ionicons name="trash-outline" size={18} color={Colors.white} />
                <Text style={styles.dangerButtonText}>
                  {t("settings.deleteAccount")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Tab 3: Preferences */}
        {activeTab === "preferences" && (
          <View>
            <View style={[styles.card, themedStyles.card]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, themedStyles.cardTitle]}>
                  {t("settings.appearance")}
                </Text>
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text
                    style={[styles.settingLabel, themedStyles.settingLabel]}
                  >
                    {t("profile.themeMode", "Theme Mode")}
                  </Text>
                  <Text style={[styles.settingSub, themedStyles.settingSub]}>
                    {t(
                      "profile.themeModeSub",
                      "Choose light, dark, or system default"
                    )}
                  </Text>
                </View>
                <View style={styles.themeSelector}>
                  {["system", "light", "dark"].map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      style={[
                        styles.themeOptionBtn,
                        themedStyles.settingButton,
                        themeMode === mode && {
                          backgroundColor: Colors.primary,
                        },
                      ]}
                      onPress={() => setThemeMode(mode)}
                    >
                      <Text
                        style={[
                          styles.themeOptionText,
                          {
                            color:
                              themeMode === mode ? Colors.white : colors.text,
                          },
                        ]}
                      >
                        {t(
                          `theme.${mode}`,
                          mode.charAt(0).toUpperCase() + mode.slice(1)
                        )}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.sectionDivider} />

              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, themedStyles.cardTitle]}>
                  {t("settings.language", "Language")}
                </Text>
              </View>
              <LanguageSelector />

              <View style={styles.sectionDivider} />

              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, themedStyles.cardTitle]}>
                  {t("profile.locationPreferences", "Location Preferences")}
                </Text>
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text
                    style={[styles.settingLabel, themedStyles.settingLabel]}
                  >
                    {t("profile.defaultLocation", "Default Location")}
                  </Text>
                  <Text style={[styles.settingSub, themedStyles.settingSub]}>
                    {selectedLocation
                      ? selectedLocation.name
                      : t(
                          "profile.locationNotSet",
                          "Not set (using device GPS)"
                        )}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {selectedLocation && (
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        { backgroundColor: colors.surfaceVariant },
                      ]}
                      onPress={handleClearLocation}
                      disabled={isUpdatingSettings}
                    >
                      <Ionicons
                        name="close-outline"
                        size={18}
                        color={colors.text}
                      />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      { backgroundColor: Colors.primary },
                    ]}
                    onPress={() => setShowLocationModal(true)}
                    disabled={isUpdatingSettings}
                  >
                    <Ionicons
                      name="location-outline"
                      size={18}
                      color={Colors.white}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Tab 4: About & Support */}
        {activeTab === "about" && (
          <View>
            <View style={[styles.card, themedStyles.card]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, themedStyles.cardTitle]}>
                  {t("profile.aboutApp", "About App")}
                </Text>
              </View>

              <View style={styles.supportRow}>
                <Text style={[styles.supportLabel, themedStyles.supportLabel]}>
                  {t("profile.appName", "App Name")}
                </Text>
                <Text style={[styles.supportValue, themedStyles.supportValue]}>
                  {t("profile.appValue", "Suhoor: Alarm & Group Wake-Ups")}
                </Text>
              </View>

              <View style={styles.supportRow}>
                <Text style={[styles.supportLabel, themedStyles.supportLabel]}>
                  {t("profile.version", "Version")}
                </Text>
                <Text style={[styles.supportValue, themedStyles.supportValue]}>
                  {APP_VERSION}
                </Text>
              </View>

              <View style={styles.sectionDivider} />

              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, themedStyles.cardTitle]}>
                  {t("profile.supportResources", "Support & Resources")}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.supportLinkRow}
                onPress={() =>
                  Linking.openURL("https://suhoor-group.web.app/privacy")
                }
              >
                <View style={styles.supportLinkInfo}>
                  <Ionicons
                    name="shield-outline"
                    size={20}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[styles.supportLabel, themedStyles.supportLabel]}
                  >
                    {t("profile.privacyPolicy", "Privacy Policy")}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward-outline"
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.supportLinkRow}
                onPress={() =>
                  Linking.openURL("https://suhoor-group.web.app/terms")
                }
              >
                <View style={styles.supportLinkInfo}>
                  <Ionicons
                    name="document-text-outline"
                    size={20}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[styles.supportLabel, themedStyles.supportLabel]}
                  >
                    {t("profile.termsOfService", "Terms of Service")}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward-outline"
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.supportLinkRow}
                onPress={() =>
                  Linking.openURL("mailto:support@suhoor-group.com")
                }
              >
                <View style={styles.supportLinkInfo}>
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[styles.supportLabel, themedStyles.supportLabel]}
                  >
                    {t("profile.contactSupport", "Contact Support")}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward-outline"
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setDeleteModalVisible(false)}
        >
          <Pressable style={[styles.modalContent, themedStyles.card]}>
            <Text style={[styles.modalTitle, { color: Colors.red }]}>
              {t("settings.deleteAccount")}
            </Text>
            <Text style={[styles.modalSub, themedStyles.sectionInfo]}>
              {t("profile.deleteAccountWarning")}
            </Text>

            <Text style={[styles.label, themedStyles.label, { marginTop: 16 }]}>
              {t(
                "profile.typeEmailToConfirm",
                { email: currentUser?.email },
                `Type your email (${currentUser?.email}) to confirm:`
              )}
            </Text>
            <View
              style={[
                styles.inputContainer,
                themedStyles.inputContainer,
                { marginTop: 8 },
              ]}
            >
              <TextInput
                style={[styles.input, themedStyles.input]}
                value={deleteEmailInput}
                onChangeText={setDeleteEmailInput}
                placeholder={currentUser?.email}
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  { backgroundColor: colors.surfaceVariant },
                ]}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={{ color: colors.text }}>{t("common.cancel")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: Colors.red }]}
                onPress={confirmDeleteAccount}
                disabled={isDeletingAccount}
              >
                {isDeletingAccount ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={{ color: Colors.white, fontWeight: "bold" }}>
                    {t("settings.deleteAccount")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Location Search Modal */}
      <Modal
        visible={showLocationModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLocationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              themedStyles.card,
              { maxHeight: "80%" },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, themedStyles.cardTitle]}>
                {t("profile.selectDefaultLocation", "Select Default Location")}
              </Text>
              <TouchableOpacity onPress={() => setShowLocationModal(false)}>
                <Ionicons name="close-outline" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, { marginBottom: 12 }]}
              onPress={handleUseCurrentLocation}
              disabled={isUpdatingSettings}
            >
              <Ionicons name="locate-outline" size={18} color={Colors.white} />
              <Text style={styles.primaryButtonText}>
                {isUpdatingSettings
                  ? "Detecting location..."
                  : "Use current location"}
              </Text>
            </TouchableOpacity>

            <View
              style={[
                styles.inputContainer,
                themedStyles.inputContainer,
                { marginBottom: 16 },
              ]}
            >
              <Ionicons
                name="search-outline"
                size={20}
                color={colors.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, themedStyles.input]}
                value={locationSearch}
                onChangeText={setLocationSearch}
                placeholder={t(
                  "profile.searchCityPlaceholder",
                  "Search city, region..."
                )}
                placeholderTextColor={colors.textSecondary}
              />
              {isSearchingLocation && (
                <ActivityIndicator size="small" color={Colors.primary} />
              )}
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              {locationResults.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.locationItem}
                  onPress={() => handleSelectLocation(item)}
                >
                  <Ionicons
                    name="location-outline"
                    size={18}
                    color={Colors.primary}
                  />
                  <Text
                    style={[
                      styles.locationItemText,
                      themedStyles.locationResultText,
                    ]}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              ))}
              {!isSearchingLocation &&
                locationSearch.length >= 3 &&
                locationResults.length === 0 && (
                  <Text style={[styles.noResults, themedStyles.noResultsText]}>
                    {t("profile.noLocationsFound", "No locations found")}
                  </Text>
                )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    padding: 16,
  },
  headerBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(61, 31, 148, 0.05)",
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.white,
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  headerName: {
    fontSize: 18,
    fontWeight: "bold",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  unverifiedBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#10B981",
  },
  unverifiedText: {
    color: "#F59E0B",
  },
  headerEmail: {
    fontSize: 13,
    color: Colors.gray,
    marginVertical: 2,
  },
  memberSinceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  memberSinceText: {
    fontSize: 11,
    color: Colors.secondary,
  },
  segmentContainer: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  segmentBtnActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentBtnInactive: {
    backgroundColor: "transparent",
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "600",
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  disabledInput: {
    opacity: 0.7,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: "100%",
    fontSize: 14,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 10,
    gap: 8,
    marginTop: 8,
  },
  primaryButtonText: {
    color: Colors.white,
    fontWeight: "bold",
    fontSize: 14,
  },
  logoutBannerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 8,
    marginTop: 8,
  },
  logoutBannerText: {
    color: Colors.primary,
    fontWeight: "bold",
    fontSize: 14,
  },
  dangerCard: {
    borderColor: "rgba(239, 68, 68, 0.3)",
    backgroundColor: "rgba(239, 68, 68, 0.02)",
  },
  dangerSubtext: {
    fontSize: 12,
    color: Colors.gray,
    marginBottom: 16,
    lineHeight: 18,
  },
  dangerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.red,
    height: 44,
    borderRadius: 10,
    gap: 8,
  },
  dangerButtonText: {
    color: Colors.white,
    fontWeight: "bold",
    fontSize: 14,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "rgba(150, 150, 150, 0.15)",
    marginVertical: 16,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  settingInfo: {
    flex: 1,
    paddingRight: 12,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  settingSub: {
    fontSize: 12,
    marginTop: 2,
  },
  themeSelector: {
    flexDirection: "row",
    gap: 6,
  },
  themeOptionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  themeOptionText: {
    fontSize: 12,
    fontWeight: "500",
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  supportRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  supportLabel: {
    fontSize: 14,
  },
  supportValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  supportLinkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  supportLinkInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  modalSub: {
    fontSize: 13,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 20,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  locationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(150, 150, 150, 0.1)",
    gap: 8,
  },
  locationItemText: {
    fontSize: 13,
    flex: 1,
  },
  noResults: {
    textAlign: "center",
    paddingVertical: 16,
    fontSize: 13,
  },
});

export default ProfileScreen;
