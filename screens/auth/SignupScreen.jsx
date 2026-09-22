import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, Linking } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import AuthWrapper from "../../components/AuthWrapper";
import { Button, Input, Text } from "../../components/ui";
import { db, auth } from "../../config/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { reload, sendEmailVerification } from "firebase/auth";
import { validatePassword } from "../../utils/passwordUtils";
import { detectUserCountry } from "../../utils/country";

export const SignupScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showVerificationScreen, setShowVerificationScreen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verificationChecking, setVerificationChecking] = useState(false);
  const [notice, setNotice] = useState("");
  const { signup } = useAuth();

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setResendCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const resendVerification = async () => {
    if (resendCooldown > 0 || !auth.currentUser) return;
    setError("");
    setNotice("");
    try {
      await sendEmailVerification(auth.currentUser, {
        url: "https://suhoor-group.web.app/login",
        handleCodeInApp: true,
      });
      setResendCooldown(30);
      setNotice(t("auth.verificationResent"));
    } catch (emailErr) {
      setError(
        emailErr?.code === "auth/too-many-requests"
          ? t("auth.verificationTooMany")
          : t("auth.verificationSendError")
      );
    }
  };

  const checkVerification = async () => {
    if (!auth.currentUser) return;
    setVerificationChecking(true);
    setError("");
    setNotice("");
    try {
      await reload(auth.currentUser);
      if (auth.currentUser.emailVerified) {
        setNotice(t("auth.verifiedSuccess"));
      } else {
        setError(t("auth.notVerifiedYet"));
      }
    } catch (checkErr) {
      setError(t("auth.verificationCheckError"));
    } finally {
      setVerificationChecking(false);
    }
  };

  const handleSignup = async () => {
    setError("");

    if (!email || !password || !confirmPassword) {
      setError(t("auth.fillAllFields"));
      return;
    }

    if (!acceptedTerms) {
      setError(t("auth.agreeTermsError"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    const passCheck = validatePassword(password);
    if (!passCheck.isValid) {
      setError(t(passCheck.errorKey));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError(t("auth.invalidEmail"));
      return;
    }

    setLoading(true);

    try {
      const userCountry = await detectUserCountry();

      // 1. Sign up user in Firebase Auth
      const userCredential = await signup(email.trim(), password);
      const user = userCredential.user;

      // 2. Get alarm PIN and fasting defaults from AsyncStorage (set during onboarding)
      let alarmPin = "";
      let fastingDefaults = {
        sunnah: true,
        whiteDays: true,
        ramadan: true,
      };

      try {
        alarmPin = (await AsyncStorage.getItem("suhoor_alarm_pin")) || "";
        const storedDefaults = await AsyncStorage.getItem(
          "onboarding_fasting_defaults"
        );
        if (storedDefaults) {
          fastingDefaults = JSON.parse(storedDefaults);
        }
      } catch (storageErr) {
        console.log("Error reading from AsyncStorage:", storageErr);
      }

      // 3. Create User Profile document in Firestore
      await setDoc(doc(db, "profiles", user.uid), {
        uid: user.uid,
        email: email.trim(),
        display_name: email.trim().split("@")[0],
        isVerified: false,
        country: userCountry,
        pin: alarmPin, // Save the alarm PIN from onboarding
        createdAt: serverTimestamp(),
        fastingDefaults,
        preferences: {
          soundEnabled: true,
          buzzNotifications: true,
        },
      });

      // Triggers the one-time tab tour when the new user first enters the app
      try {
        await AsyncStorage.setItem("suhoor-tab-tour-pending", "true");
      } catch (tourFlagErr) {
        console.log("Error setting tab tour flag:", tourFlagErr);
      }

      // 3. Send Firebase email verification (built-in Firebase syntax)
      try {
        await sendEmailVerification(user, {
          url: "https://suhoor-group.web.app/login",
          handleCodeInApp: true,
        });
        setResendCooldown(30);
      } catch (emailErr) {
        console.log("Firebase verification email error:", emailErr);
        setError(t("auth.verificationSignupFail"));
      }

      // Show verification screen instead of auto-navigating to home
      setUserEmail(email.trim());
      setShowVerificationScreen(true);
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError(t("auth.emailInUse"));
      } else {
        setError(t("auth.signupError"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthWrapper
      title={
        showVerificationScreen
          ? t("auth.checkYourEmail")
          : t("auth.createAccount")
      }
      subtitle={
        showVerificationScreen
          ? t("auth.verificationEmailSent")
          : t("auth.signupSubtitle")
      }
      error={error}
      bottomTitle={
        showVerificationScreen
          ? t("auth.backToLogin")
          : t("auth.alreadyHaveAccount")
      }
      bottomsubTitle={
        showVerificationScreen ? t("auth.login") : t("auth.login")
      }
      onBottomPress={() => navigation.navigate("Login")}
      onBackPress={() =>
        showVerificationScreen
          ? navigation.navigate("Login")
          : navigation.goBack()
      }
    >
      {showVerificationScreen ? (
        <>
        <View
          style={{
            backgroundColor: "#ECFDF5",
            borderColor: "#A7F3D0",
            borderWidth: 1,
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
            alignItems: "center",
          }}
        >
          <Ionicons
            name="mail-outline"
            size={48}
            color="#059669"
            style={{ marginBottom: 12 }}
          />
          <Text
            style={{
              color: "#065F46",
              fontSize: 16,
              fontWeight: "600",
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            {t("auth.verificationEmailSentTo")}
          </Text>
          <Text
            style={{
              color: "#065F46",
              fontSize: 18,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            {userEmail}
          </Text>
        </View>

        {notice ? (
          <Text
            style={{
              color: "#059669",
              fontSize: 14,
              fontWeight: "600",
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            {notice}
          </Text>
        ) : null}

        <Button
          title={
            resendCooldown > 0
              ? t("auth.resendIn", { seconds: resendCooldown })
              : t("auth.resendVerification")
          }
          onPress={resendVerification}
          disabled={resendCooldown > 0}
          variant="outline"
        />

        <Button
          title={t("auth.checkVerification")}
          onPress={checkVerification}
          loading={verificationChecking}
          variant="primary"
          style={{ marginTop: 12, borderRadius: 8 }}
        />
        </>
      ) : (
        <>
          <Input
            label={t("settings.emailAddress")}
            icon="mail-outline"
            placeholder="your@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label={t("auth.password")}
            icon="lock-closed-outline"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            hint={t("auth.passwordHint")}
            secure
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label={t("auth.confirmPassword")}
            icon="lock-closed-outline"
            placeholder="••••••••"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secure
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View
            style={{
              marginTop: 4,
              marginBottom: 24,
              flexDirection: "row",
              alignItems: "center",
              columnGap: 12,
              paddingEnd: 16,
            }}
          >
            <TouchableOpacity
              onPress={() => setAcceptedTerms(!acceptedTerms)}
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                borderWidth: 2,
                alignItems: "center",
                justifyContent: "center",
                borderColor: acceptedTerms ? colors.primary : "#E5E7EB",
                backgroundColor: acceptedTerms ? colors.primary : "transparent",
              }}
            >
              {acceptedTerms && (
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              )}
            </TouchableOpacity>
            <Text
              variant="caption"
              tone="secondary"
              style={{
                flex: 1,
                fontSize: 13,
                lineHeight: 16,
                color: "#6B7280",
              }}
            >
              {t("auth.agreeTermsText")}{" "}
              <Text
                style={{
                  color: colors.primary,
                  textDecorationLine: "underline",
                }}
                onPress={() =>
                  Linking.openURL("https://suhoor-group.web.app/terms")
                }
              >
                {t("nav.terms")}
              </Text>{" "}
              {t("common.and")}{" "}
              <Text
                style={{
                  color: colors.primary,
                  textDecorationLine: "underline",
                }}
                onPress={() =>
                  Linking.openURL("https://suhoor-group.web.app/privacy")
                }
              >
                {t("nav.privacy")}
              </Text>
              .
            </Text>
          </View>

          <Button
            title={t("auth.signup")}
            onPress={handleSignup}
            loading={loading}
            variant="primary"
            style={{ borderRadius: 8 }}
          />
        </>
      )}
    </AuthWrapper>
  );
};

export default SignupScreen;
