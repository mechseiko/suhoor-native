import React, { useEffect, useState } from "react";
import { Platform, StatusBar, View, LogBox } from "react-native";

import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { ThemeProvider } from "./context/ThemeContext";
import { LanguageProvider } from "./context/LanguageContext";
import { AlarmProvider } from "./context/AlarmContext";
import { NetworkProvider } from "./context/NetworkContext";
import AlarmOverlay from "./components/AlarmOverlay";
import RootNavigator from "./navigation/RootNavigator";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { configureNotifications } from "./services/notifications";
import FastingNotificationsManager from "./components/FastingNotificationsManager";
import NetworkStatusNotification from "./components/NetworkStatusNotification";

// Suppress known third-party web deprecation warnings (react-native-web & @react-navigation)
LogBox.ignoreLogs([
  "props.pointerEvents is deprecated",
  '"shadow*" style props are deprecated',
]);

// Seeds Quicksand as the default family on the base Text/TextInput, for the
// screens that still import them straight from react-native.
import "./theme/globalTextFont";

// Starts i18next before the first render, so the tree never paints untranslated
// keys. Language detection itself is async (AsyncStorage), which LanguageProvider
// waits on via `isLoadingLocale`.
import "./i18n";

// Import global CSS for NativeWind
import "./global.css";

// Web-specific viewport meta tag
if (Platform.OS === "web") {
  const meta = document.createElement("meta");
  meta.name = "viewport";
  meta.content =
    "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no";
  document.head.appendChild(meta);
}

import LogoLoader from "./components/LogoLoader";

export default function App() {
  // Configure push notifications on app start
  useEffect(() => {
    configureNotifications();
  }, []);

  // On web, skip SafeAreaProvider to avoid layout issues
  if (Platform.OS === "web") {
    return (
      <AuthProvider>
        <NetworkProvider>
          <SocketProvider>
            <ThemeProvider>
              <LanguageProvider>
                <AlarmProvider>
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: "#FFFFFF",
                      height: "100vh",
                      width: "100vw",
                    }}
                  >
                    <RootNavigator />
                    <AlarmOverlay />
                    <FastingNotificationsManager />
                    <NetworkStatusNotification />
                    <StatusBar barStyle="default" />
                  </View>
                </AlarmProvider>
              </LanguageProvider>
            </ThemeProvider>
          </SocketProvider>
        </NetworkProvider>
      </AuthProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NetworkProvider>
          <SocketProvider>
            <ThemeProvider>
              <LanguageProvider>
                <AlarmProvider>
                  <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
                    <RootNavigator />
                    <AlarmOverlay />
                    <FastingNotificationsManager />
                    <NetworkStatusNotification />
                    <StatusBar barStyle="default" />
                  </View>
                </AlarmProvider>
              </LanguageProvider>
            </ThemeProvider>
          </SocketProvider>
        </NetworkProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
