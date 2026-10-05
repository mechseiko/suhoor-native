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

import { useFonts } from "expo-font";
import { fontAssets } from "./theme/fonts";
import LogoLoader from "./components/LogoLoader";

// Web-specific viewport meta tag & fonts
if (Platform.OS === "web" && typeof document !== "undefined") {
  const meta = document.createElement("meta");
  meta.name = "viewport";
  meta.content =
    "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no";
  document.head.appendChild(meta);

  const fontLink = document.createElement("link");
  fontLink.rel = "stylesheet";
  fontLink.href =
    "https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap";
  document.head.appendChild(fontLink);

  const style = document.createElement("style");
  style.textContent = `
    @font-face { font-family: 'Quicksand-Regular'; src: local('Quicksand'), url('https://fonts.gstatic.com/s/quicksand/v31/6xK-dSZaM9iE8KbpRA_LJ3z8mH9BOJvgkP8o58a-wg.woff2') format('woff2'); font-weight: 400; font-style: normal; }
    @font-face { font-family: 'Quicksand-Medium'; src: local('Quicksand Medium'), url('https://fonts.gstatic.com/s/quicksand/v31/6xK-dSZaM9iE8KbpRA_LJ3z8mH9BOJvgkM0o58a-wg.woff2') format('woff2'); font-weight: 500; font-style: normal; }
    @font-face { font-family: 'Quicksand-SemiBold'; src: local('Quicksand SemiBold'), url('https://fonts.gstatic.com/s/quicksand/v31/6xK-dSZaM9iE8KbpRA_LJ3z8mH9BOJvgkCEv58a-wg.woff2') format('woff2'); font-weight: 600; font-style: normal; }
    @font-face { font-family: 'Quicksand-Bold'; src: local('Quicksand Bold'), url('https://fonts.gstatic.com/s/quicksand/v31/6xK-dSZaM9iE8KbpRA_LJ3z8mH9BOJvgkP8o58a-wg.woff2') format('woff2'); font-weight: 700; font-style: normal; }
    @font-face { font-family: 'SpaceGrotesk-Regular'; src: local('Space Grotesk'), url('https://fonts.gstatic.com/s/spacegrotesk/v16/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj52mXc.woff2') format('woff2'); font-weight: 400; font-style: normal; }
    @font-face { font-family: 'SpaceGrotesk-Medium'; src: local('Space Grotesk Medium'), url('https://fonts.gstatic.com/s/spacegrotesk/v16/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj52mXc.woff2') format('woff2'); font-weight: 500; font-style: normal; }
    @font-face { font-family: 'SpaceGrotesk-SemiBold'; src: local('Space Grotesk SemiBold'), url('https://fonts.gstatic.com/s/spacegrotesk/v16/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj52mXc.woff2') format('woff2'); font-weight: 600; font-style: normal; }
    @font-face { font-family: 'SpaceGrotesk-Bold'; src: local('Space Grotesk Bold'), url('https://fonts.gstatic.com/s/spacegrotesk/v16/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj52mXc.woff2') format('woff2'); font-weight: 700; font-style: normal; }
  `;
  document.head.appendChild(style);
}

export default function App() {
  const [fontsLoaded] = useFonts(fontAssets);

  // Configure push notifications on app start
  useEffect(() => {
    configureNotifications();
  }, []);

  if (!fontsLoaded && Platform.OS === "web") {
    return <LogoLoader />;
  }

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
