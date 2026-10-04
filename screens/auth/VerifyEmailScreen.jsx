import React, { useEffect, useState } from "react";
import { View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { reload, sendEmailVerification } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import { COLLECTIONS } from "../../config/firestoreSchema";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import AuthWrapper from "../../components/AuthWrapper";
import { Button, Text } from "../../components/ui";

const VerifyEmailScreen = ({ navigation, route }) => {
  const { t } = useLanguage();
  const { currentUser, logout } = useAuth();
  const userEmail =
    route?.params?.email || currentUser?.email || auth.currentUser?.email || "";

  const [resendCooldown, setResendCooldown] = useState(30);
  const [checking, setChecking] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(
      () => setResendCooldown((v) => Math.max(0, v - 1)),
      1000
    );
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
      setNotice(t("auth.verificationResent", "Verification email sent!"));
    } catch (e) {
      setError(
        e?.code === "auth/too-many-requests"
          ? t("auth.verificationTooMany", "Too many requests. Please wait a moment.")
          : t("auth.verificationSendError", "Failed to send verification email.")
      );
    }
  };

  const handleCheckVerification = async () => {
    if (checking) return;
    setChecking(true);
    setError("");
    setNotice("");

    try {
      if (auth.currentUser) {
        await reload(auth.currentUser);
        let verified = auth.currentUser.emailVerified;

        if (!verified && auth.currentUser.uid) {
          try {
            const profileSnap = await getDoc(
              doc(db, COLLECTIONS.profiles || "profiles", auth.currentUser.uid)
            );
            if (profileSnap.exists() && profileSnap.data()?.isVerified) {
              verified = true;
            }
          } catch (_) {}
        }

        if (verified) {
          setIsVerified(true);
          setNotice(
            t(
              "auth.verificationSuccess",
              "Email verified successfully! You can now log in."
            )
          );
          return;
        }
      }
      setError(
        t(
          "auth.verificationNotYet",
          "Email not verified yet. Please check your inbox and tap the link first."
        )
      );
    } catch (err) {
      console.warn("Verification check failed:", err);
      setError(
        t(
          "auth.verificationCheckError",
          "Unable to confirm verification right now. Please try again."
        )
      );
    } finally {
      setChecking(false);
    }
  };

  const handleBackToLogin = async () => {
    try {
      await logout();
    } catch (_) {}
    try {
      navigation.navigate("Login");
    } catch (_) {}
  };

  return (
    <AuthWrapper
      title={isVerified ? t("auth.verifiedTitle", "Email Verified!") : t("auth.checkYourEmail", "Check Your Email")}
      subtitle=""
      error={error}
    >
      {/* Status card */}
      <View
        style={{
          backgroundColor: isVerified ? "#F0FDF4" : "#ECFDF5",
          borderColor: isVerified ? "#86EFAC" : "#A7F3D0",
          borderWidth: 1,
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
          alignItems: "center",
        }}
      >
        <Ionicons
          name={isVerified ? "checkmark-circle" : "mail-outline"}
          size={52}
          color={isVerified ? "#16A34A" : "#059669"}
          style={{ marginBottom: 14 }}
        />
        <Text
          style={{
            color: isVerified ? "#15803D" : "#065F46",
            fontSize: 15,
            fontWeight: "600",
            textAlign: "center",
            marginBottom: 6,
          }}
        >
          {isVerified
            ? t("auth.emailVerifiedSuccess", "Your email has been verified!")
            : t("auth.verificationEmailSentTo", "Verification email sent to")}
        </Text>
        {userEmail ? (
          <Text
            style={{
              color: isVerified ? "#166534" : "#065F46",
              fontSize: 16,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            {userEmail.split("@")[0].slice(0, 3)}******@{userEmail.split("@")[1]}
          </Text>
        ) : null}
      </View>

      {/* Instruction text */}
      <Text
        style={{
          color: "#6B7280",
          fontSize: 13,
          textAlign: "center",
          marginBottom: 20,
          lineHeight: 20,
        }}
      >
        {isVerified
          ? t("auth.loginPrompt", "Please log in with your credentials to access your account.")
          : t(
              "auth.verificationInstructions",
              "Check your email, click the verification link, then tap below to confirm."
            )}
      </Text>

      {/* Main Action Button */}
      {isVerified ? (
        <Button
          title={t("auth.backToLogin", "Back to Login")}
          onPress={handleBackToLogin}
          variant="primary"
          icon="log-in-outline"
          iconPosition="start"
          style={{ borderRadius: 8 }}
        />
      ) : (
        <Button
          title={
            checking
              ? t("auth.checking", "Checking...")
              : t("auth.iveVerifiedMyEmail", "I've Verified My Email")
          }
          onPress={handleCheckVerification}
          loading={checking}
          variant="primary"
          icon="checkmark-outline"
          iconPosition="start"
          style={{ borderRadius: 8 }}
        />
      )}

      {/* Resend button (only shown when not yet verified) */}
      {!isVerified && (
        <Button
          title={
            resendCooldown > 0
              ? t("auth.resendIn", { seconds: resendCooldown }) || `Resend in ${resendCooldown}s`
              : t("auth.resendVerification", "Resend Verification Email")
          }
          onPress={resendVerification}
          disabled={resendCooldown > 0 || checking}
          variant="outline"
          style={{ marginTop: 12 }}
        />
      )}
    </AuthWrapper>
  );
};

export default VerifyEmailScreen;
