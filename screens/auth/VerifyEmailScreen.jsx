import React, { useEffect, useState } from "react";
import { View, Platform } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { reload, sendEmailVerification } from "firebase/auth";
import { auth } from "../../config/firebase";
import { useLanguage } from "../../context/LanguageContext";
import AuthWrapper from "../../components/AuthWrapper";
import { Button, Text } from "../../components/ui";

const VerifyEmailScreen = ({ navigation, route }) => {
  const { t } = useLanguage();
  const userEmail = route?.params?.email || auth.currentUser?.email || "";

  const [resendCooldown, setResendCooldown] = useState(30);
  const [verificationChecking, setVerificationChecking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const currentUser = auth.currentUser;
const isVerified = currentUser?.emailVerified ?? false;

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setResendCooldown((v) => Math.max(0, v - 1));
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
        // Refresh the page to trigger RootNavigator to redirect to home
        if (Platform.OS === 'web') {
          window.location.reload();
        }
      } else {
        setError(t("auth.notVerifiedYet"));
      }
    } catch {
      setError(t("auth.verificationCheckError"));
    } finally {
      setVerificationChecking(false);
    }
  };

  return (
    <AuthWrapper
      title={t("auth.checkYourEmail")}
      subtitle=""
      error={error}
    >
      {currentUser && !isVerified && (<View
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
          {userEmail.split("@")[0].slice(0, 3)}******@{userEmail.split("@")[1]}
        </Text>
      </View>)}

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

      {currentUser && !isVerified && (
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
      )}

      <Button
        title={isVerified ? "Continue to App" : t("auth.checkVerification")}
        onPress={isVerified ? () => {
          if (Platform.OS === 'web') {
            window.location.reload();
          } else {
            navigation.reset({
              index: 0,
              routes: [{ name: 'HomeTab' }],
            });
          }
        } : checkVerification}
        loading={verificationChecking}
        variant="primary"
        style={{ marginTop: 12, borderRadius: 8 }}
      />
    </AuthWrapper>
  );
};

export default VerifyEmailScreen;
