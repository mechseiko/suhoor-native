import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Dimensions,
  Image,
  Linking,
  NativeModules,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Geolocation from "@react-native-community/geolocation";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useLanguage } from "../../context/LanguageContext";
import { Button, Text } from "../../components/ui";
import { brand } from "../../theme";

const S1 = "The 100% Free Software";
const S2 = " that solves the problem of missing suhoor,";
const S3 = " for everyone.";
const FULL_TYPEWRITER_TEXT = S1 + S2 + S3;

/**
 * Step 1 Animated Hero:
 * Infinite typewriter animation of the core promise, with ambient color orbs,
 * color mixes, and generous vertical rhythm filling the screen height.
 */
const TypewriterHero = () => {
  const [charIndex, setCharIndex] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);

  // Ambient floating background orbs
  const orbScale1 = useRef(new Animated.Value(1)).current;
  const orbScale2 = useRef(new Animated.Value(1)).current;
  const orbOpacity = useRef(new Animated.Value(0.6)).current;

  // Typewriter effect: types out once, then stops
  useEffect(() => {
    if (charIndex < FULL_TYPEWRITER_TEXT.length) {
      const timer = setTimeout(() => {
        setCharIndex((prev) => prev + 1);
      }, 45);
      return () => clearTimeout(timer);
    }
  }, [charIndex]);

  // Blinking cursor
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 450);
    return () => clearInterval(cursorInterval);
  }, []);

  // Ambient background color animation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(orbScale1, {
            toValue: 1.25,
            duration: 3200,
            useNativeDriver: Platform.OS !== "web",
          }),
          Animated.timing(orbScale1, {
            toValue: 0.9,
            duration: 3200,
            useNativeDriver: Platform.OS !== "web",
          }),
        ]),
        Animated.sequence([
          Animated.timing(orbScale2, {
            toValue: 0.85,
            duration: 2800,
            useNativeDriver: Platform.OS !== "web",
          }),
          Animated.timing(orbScale2, {
            toValue: 1.2,
            duration: 2800,
            useNativeDriver: Platform.OS !== "web",
          }),
        ]),
        Animated.sequence([
          Animated.timing(orbOpacity, {
            toValue: 0.85,
            duration: 3000,
            useNativeDriver: Platform.OS !== "web",
          }),
          Animated.timing(orbOpacity, {
            toValue: 0.45,
            duration: 3000,
            useNativeDriver: Platform.OS !== "web",
          }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Pulse for hero emblem
  const emblemPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(emblemPulse, {
          toValue: 1.08,
          duration: 2000,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(emblemPulse, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: Platform.OS !== "web",
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Slice text segments for multi-color typography
  let t1 = "";
  let t2 = "";
  let t3 = "";

  if (charIndex <= S1.length) {
    t1 = S1.slice(0, charIndex);
  } else if (charIndex <= S1.length + S2.length) {
    t1 = S1;
    t2 = S2.slice(0, charIndex - S1.length);
  } else {
    t1 = S1;
    t2 = S2;
    t3 = S3.slice(0, charIndex - S1.length - S2.length);
  }

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
        width: "100%",
      }}
    >
      {/* Ambient background glow orbs */}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          {
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          },
        ]}
        pointerEvents="none"
      >
        {/* Warm amber orb */}
        <Animated.View
          style={{
            position: "absolute",
            width: 280,
            height: 280,
            borderRadius: 140,
            backgroundColor: "rgba(249, 168, 38, 0.12)",
            transform: [
              { scale: orbScale1 },
              { translateX: -50 },
              { translateY: -30 },
            ],
            opacity: orbOpacity,
          }}
        />
        {/* Soft mint/teal orb */}
        <Animated.View
          style={{
            position: "absolute",
            width: 250,
            height: 250,
            borderRadius: 125,
            backgroundColor: "rgba(0, 194, 168, 0.10)",
            transform: [
              { scale: orbScale2 },
              { translateX: 60 },
              { translateY: 40 },
            ],
            opacity: orbOpacity,
          }}
        />
        {/* Deep soft indigo orb */}
        <Animated.View
          style={{
            position: "absolute",
            width: 280,
            height: 300,
            borderRadius: 160,
            backgroundColor: "rgba(21, 12, 51, 0.04)",
            transform: [{ scale: orbScale1 }],
          }}
        />
      </View>

      {/* Typewriter Animated Text */}
      <View
        style={{
          minHeight: 160,
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          paddingHorizontal: 4,
        }}
      >
        <Text variant="hero" style={{ textAlign: "center" }}>
          <Text
            variant="inherit"
            style={{ color: brand.secondary, fontWeight: "700" }}
          >
            {t1}
          </Text>
          <Text
            variant="inherit"
            style={{ color: "#111827", fontWeight: "800" }}
          >
            {t2}
          </Text>
          <Text
            variant="inherit"
            style={{ color: brand.primary, fontWeight: "800" }}
          >
            {t3}
          </Text>
          <Text
            variant="inherit"
            style={{
              color: brand.secondary,
              opacity: cursorVisible ? 1 : 0,
            }}
          >
            |
          </Text>
        </Text>
      </View>
    </View>
  );
};

const NotificationPermissionStep = ({ onStatusChange }) => {
  const { t } = useLanguage();
  const [granted, setGranted] = useState(false);

  const checkStatus = async () => {
    try {
      if (Platform.OS === "android" && Platform.Version >= 33) {
        const res = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        setGranted(!!res);
        onStatusChange?.(!!res);
      } else if (Platform.OS === "android") {
        setGranted(true);
        onStatusChange?.(true);
      }
    } catch (e) {
      console.warn("Error checking notification permission", e);
    }
  };

  useEffect(() => {
    checkStatus();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        checkStatus();
      }
    });
    return () => sub.remove();
  }, []);

  const handleAction = async () => {
    try {
      if (Platform.OS === "android" && Platform.Version >= 33) {
        const res = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        if (res === PermissionsAndroid.RESULTS.GRANTED) {
          setGranted(true);
          onStatusChange?.(true);
          return;
        }
      }
      await Linking.openSettings();
    } catch (e) {
      Linking.openSettings().catch(() => {});
    }
  };

  return (
    <View
      style={{
        flex: 1,
        width: "100%",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 12,
      }}
    >
      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: 38,
          backgroundColor: "rgba(21, 12, 51, 0.07)",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <Ionicons
          name="notifications-outline"
          size={36}
          color={brand.primary}
        />
      </View>

      <Text variant="hero" style={{ textAlign: "center", marginBottom: 10 }}>
        <Text
          variant="inherit"
          style={{ color: brand.primary, fontWeight: "800" }}
        >
          Stay{" "}
        </Text>
        <Text
          variant="inherit"
          style={{ color: brand.secondary, fontWeight: "800" }}
        >
          Notified
        </Text>
      </Text>

      <Text
        style={{
          textAlign: "center",
          maxWidth: 310,
          lineHeight: 20,
          fontSize: 13,
          color: "#6B7280",
          fontFamily: "Quicksand-Regular",
          marginBottom: 24,
        }}
      >
        {t("onboarding.notificationPermission")}
      </Text>

      {/* Status Pill */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 20,
          backgroundColor: granted ? "#ECFDF5" : "#FFFBEB",
          borderWidth: 1,
          borderColor: granted ? "#10B981" : "#FCD34D",
          marginBottom: 26,
        }}
      >
        <Ionicons
          name={granted ? "checkmark-circle" : "alert-circle-outline"}
          size={16}
          color={granted ? "#059669" : "#D97706"}
          style={{ marginRight: 6 }}
        />
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: granted ? "#065F46" : "#B45309",
            fontFamily: "SpaceGrotesk-Bold",
          }}
        >
          {granted ? "Permission granted" : "Permission not granted"}
        </Text>
      </View>

      {/* Action Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleAction}
        style={{
          width: "100%",
          backgroundColor: granted ? "#10B981" : brand.primary,
          paddingVertical: 15,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          columnGap: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <Ionicons
          name={granted ? "checkmark-outline" : "notifications"}
          size={18}
          color="#FFFFFF"
        />
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 14,
            fontWeight: "800",
            letterSpacing: 0.8,
            fontFamily: "SpaceGrotesk-Bold",
          }}
        >
          GRANT PERMISSION
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const LocationPermissionStep = ({ onStatusChange }) => {
  const { t } = useLanguage();
  const [detected, setDetected] = useState(false);

  const checkStatus = async () => {
    try {
      if (Platform.OS === "android") {
        const fine = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        const coarse = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
        );
        if (!fine) {
          setDetected(false);
          onStatusChange?.(false);
          return;
        }

        Geolocation.getCurrentPosition(
          () => {
            setDetected(true);
            onStatusChange?.(true);
          },
          () => {
            setDetected(false);
            onStatusChange?.(false);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    } catch (e) {
      console.warn("Error checking location permission", e);
    }
  };

  useEffect(() => {
    checkStatus();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        checkStatus();
      }
    });
    return () => sub.remove();
  }, []);

  const handleAction = async () => {
    try {
      if (Platform.OS === "android") {
        const res = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]);
        const fine =
          res[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED;
        const coarse =
          res[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED;
        if (fine && coarse) {
          Geolocation.getCurrentPosition(
            () => {
              setDetected(true);
              onStatusChange?.(true);
            },
            () => {
              setDetected(false);
              onStatusChange?.(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
          return;
        }
      }
      await Linking.openSettings();
    } catch (e) {
      Linking.openSettings().catch(() => {});
    }
  };

  return (
    <View
      style={{
        flex: 1,
        width: "100%",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 12,
      }}
    >
      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: 38,
          backgroundColor: "rgba(21, 12, 51, 0.07)",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <Ionicons name="location-outline" size={36} color={brand.primary} />
      </View>

      <Text variant="hero" style={{ textAlign: "center", marginBottom: 10 }}>
        <Text
          variant="inherit"
          style={{ color: brand.primary, fontWeight: "800" }}
        >
          Precise{" "}
        </Text>
        <Text
          variant="inherit"
          style={{ color: brand.secondary, fontWeight: "800" }}
        >
          Location
        </Text>
      </Text>

      <Text
        variant="body"
        tone="secondary"
        style={{
          textAlign: "center",
          maxWidth: 320,
          lineHeight: 21,
          fontSize: 13,
          marginBottom: 24,
        }}
      >
        {t("onboarding.locationPermission")}
      </Text>

      {/* Status Pill */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 20,
          backgroundColor: detected ? "#ECFDF5" : "#FFFBEB",
          borderWidth: 1,
          borderColor: detected ? "#10B981" : "#FCD34D",
          marginBottom: 26,
        }}
      >
        <Ionicons
          name={detected ? "checkmark-circle" : "alert-circle-outline"}
          size={16}
          color={detected ? "#059669" : "#D97706"}
          style={{ marginRight: 6 }}
        />
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: detected ? "#065F46" : "#B45309",
            fontFamily: "SpaceGrotesk-Bold",
          }}
        >
          {detected ? "Location detected" : "Location not detected"}
        </Text>
      </View>

      {/* Action Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleAction}
        style={{
          width: "100%",
          backgroundColor: detected ? "#10B981" : brand.primary,
          paddingVertical: 15,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          columnGap: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <Ionicons
          name={detected ? "checkmark-outline" : "navigate-outline"}
          size={18}
          color="#FFFFFF"
        />
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 14,
            fontWeight: "800",
            letterSpacing: 0.8,
            fontFamily: "SpaceGrotesk-Bold",
          }}
        >
          GRANT LOCATION PERMISSION
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const BatteryOptimizationStep = ({ onStatusChange }) => {
  const { t } = useLanguage();
  const [disabled, setDisabled] = useState(false);

  const checkStatus = async () => {
    if (Platform.OS !== "android") {
      setDisabled(true);
      onStatusChange?.(true);
      return;
    }

    try {
      const value =
        await NativeModules.AlarmBridge?.isBatteryOptimizationDisabled();
      const isDisabled = value === true;
      setDisabled(isDisabled);
      onStatusChange?.(isDisabled);
    } catch (error) {
      setDisabled(false);
      onStatusChange?.(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") checkStatus();
    });
    return () => sub.remove();
  }, []);

  const handleAction = async () => {
    try {
      if (Platform.OS === "android") {
        try {
          await NativeModules.AlarmBridge?.openBatteryOptimizationSettings();
        } catch (_) {
          await Linking.sendIntent(
            "android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS"
          );
        }
      } else {
        await Linking.openSettings();
      }
    } catch (e) {
      Linking.openSettings().catch(() => {});
    }
  };

  return (
    <View
      style={{
        flex: 1,
        width: "100%",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 12,
      }}
    >
      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: 38,
          backgroundColor: "rgba(21, 12, 51, 0.07)",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <Ionicons
          name="battery-charging-outline"
          size={36}
          color={brand.primary}
        />
      </View>

      <Text variant="hero" style={{ textAlign: "center", marginBottom: 10 }}>
        <Text
          variant="inherit"
          style={{ color: brand.primary, fontWeight: "800" }}
        >
          Reliable{" "}
        </Text>
        <Text
          variant="inherit"
          style={{ color: brand.secondary, fontWeight: "800" }}
        >
          Alarms
        </Text>
      </Text>

      <Text
        variant="body"
        tone="secondary"
        style={{
          textAlign: "center",
          maxWidth: 320,
          lineHeight: 21,
          fontSize: 13,
          marginBottom: 24,
        }}
      >
        {t("onboarding.batteryOptimization")}
      </Text>

      {/* Status Pill */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 20,
          backgroundColor: disabled ? "#ECFDF5" : "#FFFBEB",
          borderWidth: 1,
          borderColor: disabled ? "#10B981" : "#FCD34D",
          marginBottom: 26,
        }}
      >
        <Ionicons
          name={disabled ? "checkmark-circle" : "alert-circle-outline"}
          size={16}
          color={disabled ? "#059669" : "#D97706"}
          style={{ marginRight: 6 }}
        />
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: disabled ? "#065F46" : "#B45309",
            fontFamily: "SpaceGrotesk-Bold",
          }}
        >
          {disabled
            ? "Battery Optimization is disabled"
            : "Battery Optimization is enabled"}
        </Text>
      </View>

      {/* Action Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleAction}
        style={{
          width: "100%",
          backgroundColor: disabled ? "#10B981" : brand.primary,
          paddingVertical: 15,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          columnGap: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <Ionicons
          name={disabled ? "checkmark-outline" : "flash-outline"}
          size={18}
          color="#FFFFFF"
        />
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 13,
            fontWeight: "800",
            letterSpacing: 0.8,
            fontFamily: "SpaceGrotesk-Bold",
          }}
        >
          DISABLE BATTERY OPTIMIZATION
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const STEPS = [
  {
    id: 1,
    isHero: true,
  },
  {
    id: 2,
    image: require("../../assets/onboarding/2.png"),
    titlePrimary: "Set ",
    titleSecondary: "Alarms",
    subtitle: "Set smart alarms for suhoor, your own device alarm goes first.",
  },
  {
    id: 3,
    image: require("../../assets/onboarding/3.png"),
    titlePrimary: "Group ",
    titleSecondary: "Wake Up",
    subtitle:
      "Your group members checks if you haven't checked in. They can trigger your alarm until you check in.",
  },
  {
    id: 4,
    image: require("../../assets/onboarding/4.png"),
    titlePrimary: "Wake Up ",
    titleSecondary: "Buzz",
    subtitle: "Send a buzz to people who haven't woken up.",
  },
  {
    id: 5,
    isNotification: true,
  },
  {
    id: 6,
    isLocation: true,
  },
  {
    id: 7,
    isBattery: true,
  },
  {
    id: 8,
    isPin: true,
  },
  {
    id: 9,
    isRoutine: true,
  },
];

const FastingRoutineStep = ({ fastingDefaults, setFastingDefaults }) => {
  const toggle = (key) => {
    setFastingDefaults((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const items = [
    {
      key: "sunnah",
      icon: "moon-outline",
      title: "Sunnah Days",
      desc: "Default to fasting on Mondays and Thursdays",
    },
    {
      key: "whiteDays",
      icon: "sparkles-outline",
      title: "White Days",
      desc: "Default to fasting on 13th, 14th & 15th of the Hijri month",
    },
    {
      key: "ramadan",
      icon: "star-outline",
      title: "Ramadan Fasting",
      desc: "Default to fasting on every day of Ramadan",
    },
    {
      key: "dhulHijjah",
      icon: "heart-outline",
      title: "First 9 Days of Dhul-Hijjah",
      desc: "Default to fasting on first 9 days of Dhul-Hijjah",
    },
  ];

  return (
    <View
      style={{
        flex: 1,
        width: "100%",
        justifyContent: "center",
        paddingHorizontal: 4,
      }}
    >
      {/* Top Header */}
      <View style={{ alignItems: "center", marginBottom: 18 }}>
        <Text variant="hero" style={{ textAlign: "center", marginBottom: 6 }}>
          <Text
            variant="inherit"
            style={{ color: brand.primary, fontWeight: "800" }}
          >
            Flexible{" "}
          </Text>
          <Text
            variant="inherit"
            style={{ color: brand.secondary, fontWeight: "800" }}
          >
            Routines
          </Text>
        </Text>
        <Text
          variant="body"
          tone="secondary"
          style={{
            textAlign: "center",
            maxWidth: 310,
            lineHeight: 18,
            fontSize: 13,
          }}
        >
          Suhoor adapts around your worship schedule. Select your routine now,
          you can always fine-tune this anytime in Settings.
        </Text>
      </View>

      {/* Routine Cards */}
      <View style={{ rowGap: 9, columnGap: 9, marginBottom: 14 }}>
        {items.map((item) => {
          const active = !!fastingDefaults[item.key];
          return (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.75}
              onPress={() => toggle(item.key)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: active ? "#FAFAFB" : "#FFFFFF",
                borderWidth: 1.5,
                borderColor: active ? brand.primary : "#E5E7EB",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  columnGap: 12,
                  flex: 1,
                  marginRight: 10,
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: active
                      ? "rgba(21, 12, 51, 0.08)"
                      : "#F3F4F6",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name={item.icon}
                    size={17}
                    color={active ? brand.primary : "#9CA3AF"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: "SpaceGrotesk-Bold",
                      fontSize: 13,
                      color: brand.primary,
                      marginBottom: 1,
                    }}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Quicksand-Regular",
                      fontSize: 11,
                      color: "#6B7280",
                    }}
                  >
                    {item.desc}
                  </Text>
                </View>
              </View>

              <Switch
                value={active}
                onValueChange={() => toggle(item.key)}
                trackColor={{ false: "#E5E7EB", true: brand.primary }}
                thumbColor="#FFFFFF"
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

/**
 * Step: Set a 4-digit personal alarm dismissal PIN.
 * The PIN is required to dismiss the personal Suhoor alarm overlay,
 * proving the user is truly awake. It is saved to Firestore via profile.
 */
const AlarmPinStep = ({ alarmPin, setAlarmPin, pinError, setPinError }) => {
  const inputRefs = [useRef(), useRef(), useRef(), useRef()];

  const handleDigit = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const next = [...alarmPin];
    next[index] = digit;
    setAlarmPin(next);
    setPinError("");
    if (digit && index < 3) {
      inputRefs[index + 1]?.current?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.nativeEvent?.key === "Backspace" && !alarmPin[index] && index > 0) {
      inputRefs[index - 1]?.current?.focus();
    }
  };

  return (
    <View
      style={{
        flex: 1,
        width: "100%",
        justifyContent: "center",
        paddingHorizontal: 4,
      }}
    >
      <View style={{ alignItems: "center", marginBottom: 24 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: "rgba(21,12,51,0.08)",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Ionicons
            name="lock-closed-outline"
            size={34}
            color={brand.primary}
          />
        </View>
        <Text variant="hero" style={{ textAlign: "center", marginBottom: 8 }}>
          <Text
            variant="inherit"
            style={{ color: brand.primary, fontWeight: "800" }}
          >
            Alarm{" "}
          </Text>
          <Text
            variant="inherit"
            style={{ color: brand.secondary, fontWeight: "800" }}
          >
            PIN
          </Text>
        </Text>
        <Text
          variant="body"
          tone="secondary"
          style={{
            textAlign: "center",
            maxWidth: 300,
            lineHeight: 20,
            fontSize: 13,
          }}
        >
          Set a personal 4-digit PIN. You'll enter this PIN to dismiss your
          Suhoor alarm and prove you're truly awake.
        </Text>
      </View>

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
            ref={inputRefs[i]}
            value={digit}
            onChangeText={(val) => handleDigit(i, val)}
            onKeyPress={(e) => handleKeyDown(i, e)}
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
              borderColor: digit ? brand.primary : "#E5E7EB",
              borderRadius: 12,
              backgroundColor: digit ? "rgba(21,12,51,0.04)" : "#F9FAFB",
              color: brand.primary,
            }}
          />
        ))}
      </View>

      {pinError ? (
        <Text
          style={{
            color: "#EF4444",
            textAlign: "center",
            fontSize: 12,
            marginBottom: 8,
          }}
        >
          {pinError}
        </Text>
      ) : null}

      <Text
        variant="label"
        tone="secondary"
        style={{ textAlign: "center", fontSize: 11, marginTop: 4 }}
      >
        You can change this PIN anytime in Settings.
      </Text>
    </View>
  );
};

export const OnboardingScreen = ({ onComplete }) => {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [alarmPin, setAlarmPin] = useState(["", "", "", ""]);
  const [pinError, setPinError] = useState("");
  const [requirements, setRequirements] = useState({
    notification: false,
    location: false,
    battery: false,
  });
  const [requirementError, setRequirementError] = useState("");
  const [fastingDefaults, setFastingDefaults] = useState({
    sunnah: true,
    whiteDays: true,
    ramadan: true,
    dhulHijjah: true,
  });

  const current = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  const next = async () => {
    if (current.isNotification && !requirements.notification) {
      setRequirementError(
        "Please grant notification permission before continuing."
      );
      return;
    }
    if (current.isLocation && !requirements.location) {
      setRequirementError(
        "Please grant precise location and enable device location before continuing."
      );
      return;
    }
    if (current.isBattery && !requirements.battery) {
      setRequirementError(
        "Please disable battery optimization before continuing."
      );
      return;
    }
    setRequirementError("");

    // Validate PIN before advancing past the PIN step
    if (current.isPin) {
      const pinStr = alarmPin.join("");
      if (pinStr.length < 4 || alarmPin.some((d) => d === "")) {
        setPinError("Please enter all 4 digits of your PIN.");
        return;
      }
      setPinError("");
    }

    if (isLastStep) {
      try {
        const pinStr = alarmPin.join("");
        await AsyncStorage.setItem("suhoor_alarm_pin", pinStr);
        await AsyncStorage.setItem(
          "onboarding_fasting_defaults",
          JSON.stringify(fastingDefaults)
        );
      } catch (e) {
        console.warn("Failed to save onboarding data", e);
      }
      onComplete();
      return;
    }
    setStep((value) => value + 1);
  };

  const back = () => {
    if (step === 0) return;
    setPinError("");
    setStep((value) => value - 1);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: 24,
          paddingBottom: 24,
          paddingTop: 32,
        }}
      >
        {/* Top Bar with Flexed Logo + App Name and Skip button */}
        <View
          style={{
            height: 48,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              columnGap: 12,
            }}
          >
            <Image
              source={require("../../assets/icon-nobg.png")}
              style={{ width: 44, height: 44 }}
              resizeMode="contain"
            />
            <Text
              variant="display"
              style={{
                fontFamily: "Quicksand-Regular",
                fontWeight: "700",
              }}
            >
              Suhoor
            </Text>
          </View>

          {/* {!isLastStep ? (
            <TouchableOpacity
              onPress={onComplete}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Skip onboarding"
              style={{ paddingVertical: 4, paddingHorizontal: 8 }}
            >
              <Text variant="label" tone="secondary" style={{
                fontFamily: 'Quicksand-Regular',
                fontSize: 14,
                fontWeight: '600'
              }}>
                {t('onboarding.skip', 'Skip')}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 48 }} />
          )} */}
        </View>

        {/* Center Content */}
        {current.isHero ? (
          <TypewriterHero />
        ) : current.isNotification ? (
          <NotificationPermissionStep
            onStatusChange={(value) =>
              setRequirements((currentState) => ({
                ...currentState,
                notification: value,
              }))
            }
          />
        ) : current.isLocation ? (
          <LocationPermissionStep
            onStatusChange={(value) =>
              setRequirements((currentState) => ({
                ...currentState,
                location: value,
              }))
            }
          />
        ) : current.isBattery ? (
          <BatteryOptimizationStep
            onStatusChange={(value) =>
              setRequirements((currentState) => ({
                ...currentState,
                battery: value,
              }))
            }
          />
        ) : current.isPin ? (
          <AlarmPinStep
            alarmPin={alarmPin}
            setAlarmPin={setAlarmPin}
            pinError={pinError}
            setPinError={setPinError}
          />
        ) : current.isRoutine ? (
          <FastingRoutineStep
            fastingDefaults={fastingDefaults}
            setFastingDefaults={setFastingDefaults}
          />
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 8,
            }}
          >
            {/* Ambient Background Glow Orbs for dynamic richness */}
            <View
              style={[
                StyleSheet.absoluteFillObject,
                {
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                },
              ]}
              pointerEvents="none"
            >
              <View
                style={{
                  position: "absolute",
                  width: 260,
                  height: 260,
                  borderRadius: 130,
                  backgroundColor: "rgba(249, 168, 38, 0.08)",
                  top: 40,
                  left: -30,
                }}
              />
              <View
                style={{
                  position: "absolute",
                  width: 240,
                  height: 240,
                  borderRadius: 120,
                  backgroundColor: "rgba(0, 194, 168, 0.07)",
                  bottom: 60,
                  right: -20,
                }}
              />
            </View>

            {/* Step Illustration */}
            <View
              style={{
                width: "100%",
                height: 280,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 40,
              }}
            >
              <Image
                source={current.image}
                style={{
                  width: Dimensions.get("window").width - 40,
                  height: 320,
                }}
                resizeMode="contain"
              />
            </View>

            {/* Title with Keyword in Bold Secondary Color */}
            <Text
              variant="hero"
              style={{ textAlign: "center", marginBottom: 8 }}
            >
              <Text
                variant="inherit"
                style={{ color: brand.primary, fontWeight: "700" }}
              >
                {current.titlePrimary}
              </Text>
              <Text
                variant="inherit"
                style={{ color: brand.secondary, fontWeight: "800" }}
              >
                {current.titleSecondary}
              </Text>
            </Text>

            {/* Subtitle in Smaller Size Text */}
            <Text
              variant="bodyLg"
              tone="secondary"
              style={{
                textAlign: "center",
                maxWidth: 310,
                lineHeight: 24,
                fontWeight: "600",
              }}
            >
              {current.subtitle}
            </Text>
          </View>
        )}

        {requirementError ? (
          <Text
            style={{
              color: "#B91C1C",
              textAlign: "center",
              fontSize: 12,
              marginBottom: 8,
            }}
          >
            {requirementError}
          </Text>
        ) : null}

        {/* Progress Indicator */}
        <View
          style={{
            marginVertical: 24,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            columnGap: 8,
          }}
        >
          {STEPS.map((item, index) => (
            <View
              key={item.id}
              style={{
                height: 4,
                borderRadius: 2,
                width: index === step ? 24 : 8,
                backgroundColor: index === step ? brand.primary : "#E5E7EB",
              }}
            />
          ))}
        </View>

        {/* Action Row: Back arrow + Continue */}
        <View
          style={{
            paddingTop: 4,
            flexDirection: "row",
            alignItems: "center",
            columnGap: 12,
          }}
        >
          {step > 0 && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={back}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={{
                width: 52,
                height: 52,
                borderRadius: 8,
                borderWidth: 1.5,
                borderColor: "#E5E7EB",
                backgroundColor: "#FFFFFF",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="arrow-back" size={22} color={brand.primary} />
            </TouchableOpacity>
          )}

          <View style={{ flex: 1 }}>
            <Button
              title={t(
                isLastStep ? "onboarding.getStarted" : "onboarding.next",
                isLastStep ? "Get Started" : "Continue"
              )}
              onPress={next}
              variant="primary"
              style={{ borderRadius: 8 }}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default OnboardingScreen;
